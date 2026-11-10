// ──────────────────────────────────────────────────────────────────────
//  Gestor de persistencia local y sincronización (IndexedDB)
//  Implementa política de recorte para no saturar memoria en el navegador.
// ──────────────────────────────────────────────────────────────────────
import { db } from "./index";
import type {
  Message,
  Forum,
  OutboxMessage,
  TemporaryForum,
  DirectPeer,
  DirectRequest,
  DirectMessage,
} from "@zonaviva/protocol";
import {
  MESSAGE_RETENTION_MS,
  DIRECT_REQUEST_COOLDOWN_MS,
  DIRECT_REQUEST_EXPIRATION_MS,
  ZONES_BY_ID,
  FORUM_PREFIX_ZONE,
} from "@zonaviva/protocol";

const MAX_MESSAGES_PER_FORUM = 500;

/** Mensajes con más de 3 días se descartan automáticamente */
export const RETENTION_MS = MESSAGE_RETENTION_MS;

export function compareMessagesCanonical(a: Message, b: Message): number {
  if (a.relayTs !== b.relayTs) return a.relayTs - b.relayTs;
  return a.id.localeCompare(b.id);
}

/**
 * Fusiona copias de historial (caso 1–100 + 101–130 → 1–130),
 * descarta caducados y elimina duplicados por id.
 */
export function mergeMessageLists(...lists: Message[][]): Message[] {
  const cutoff = Date.now() - RETENTION_MS;
  const byId = new Map<string, Message>();
  for (const list of lists) {
    for (const message of list) {
      if (message.relayTs >= cutoff) {
        byId.set(message.id, message);
      }
    }
  }
  return Array.from(byId.values()).sort(compareMessagesCanonical);
}

/**
 * Elimina mensajes más viejos que RETENTION_MS del foro indicado.
 * @returns Número de mensajes eliminados.
 */
export async function pruneOldMessages(forumId: string): Promise<number> {
  const cutoff = Date.now() - RETENTION_MS;
  return db.messages
    .where("[forumId+relayTs]")
    .between([forumId, 0], [forumId, cutoff], true, false)
    .delete();
}

/**
 * Elimina mensajes más viejos que RETENTION_MS de TODOS los foros.
 * @returns Total de mensajes eliminados.
 */
export async function pruneAllOldMessages(): Promise<number> {
  const cutoff = Date.now() - RETENTION_MS;
  return db.messages.where("relayTs").below(cutoff).delete();
}

/**
 * Borra el foro y todos sus mensajes (y outbox) de IndexedDB.
 */
export async function deleteForumAndMessages(forumId: string): Promise<void> {
  await db.transaction("rw", db.messages, db.forums, db.outbox, async () => {
    await db.messages.where("forumId").equals(forumId).delete();
    await db.outbox.where("forumId").equals(forumId).delete();
    await db.forums.delete(forumId);
  });
}

/**
 * Borra TODOS los foros y sus mensajes de IndexedDB.
 */
export async function deleteAllForumsAndMessages(): Promise<void> {
  await db.transaction("rw", db.messages, db.forums, db.outbox, async () => {
    await db.messages.clear();
    await db.forums.clear();
    await db.outbox.clear();
  });
}

/**
 * Guarda mensajes sellados en IndexedDB de forma deduplicada,
 * filtrando primero los mensajes más viejos que RETENTION_MS,
 * y recorta los mensajes más antiguos si supera el límite de 500.
 */
export async function saveMessages(messages: Message[]): Promise<void> {
  if (messages.length === 0) return;

  // Filtrar mensajes con más de 3 días antes de guardar
  const cutoff = Date.now() - RETENTION_MS;
  const fresh = messages.filter((m) => m.relayTs >= cutoff);
  if (fresh.length === 0) return;

  await db.transaction("rw", db.messages, db.forums, async () => {
    // Upsert masivo (solo mensajes frescos)
    await db.messages.bulkPut(fresh);

    // Agrupar por foros para actualizar metadata y aplicar recorte
    const forumIds = Array.from(new Set(fresh.map((m) => m.forumId)));

    for (const forumId of forumIds) {
      const forumMsgs = await db.messages
        .where("forumId")
        .equals(forumId)
        .sortBy("relayTs");

      // Política de recorte: mantener los últimos 500 mensajes
      if (forumMsgs.length > MAX_MESSAGES_PER_FORUM) {
        const excess = forumMsgs.length - MAX_MESSAGES_PER_FORUM;
        const toDeleteIds = forumMsgs.slice(0, excess).map((m) => m.id);
        await db.messages.bulkDelete(toDeleteIds);
      }

      // Actualizar lastSyncRelayTs y marcar participación activa en el registro del foro
      const latestMsg = forumMsgs[forumMsgs.length - 1];
      if (latestMsg) {
        const existing = await db.forums.get(forumId);
        const hasMessages = forumMsgs.length > 0;
        if (existing) {
          await db.forums.update(forumId, {
            lastSyncRelayTs: Math.max(existing.lastSyncRelayTs, latestMsg.relayTs),
            lastContactAt: Date.now(),
            isParticipant: hasMessages,
          });
        } else {
          const isZone = forumId.startsWith(FORUM_PREFIX_ZONE);
          let forumName = forumId;
          if (isZone) {
            const zId = forumId.slice(FORUM_PREFIX_ZONE.length);
            forumName = ZONES_BY_ID[zId]?.name || forumId;
          }
          await db.forums.put({
            id: forumId,
            type: isZone ? "zone" : "user",
            name: forumName,
            createdAt: latestMsg.relayTs,
            lastSyncRelayTs: latestMsg.relayTs,
            lastContactAt: Date.now(),
            isParticipant: hasMessages,
          });
        }
      }
    }
  });
}

/**
 * Obtiene todos los mensajes de un foro ordenados canónicamente por (relayTs, id)
 */
export async function getForumMessages(forumId: string): Promise<Message[]> {
  await pruneOldMessages(forumId);
  const messages = await db.messages.where("forumId").equals(forumId).sortBy("relayTs");
  return messages.sort(compareMessagesCanonical);
}

/**
 * Obtiene los mensajes con relayTs > since para responder a peticiones de sync P2P.
 * Nunca sirve mensajes fuera de la ventana de retención.
 */
export async function getMessagesSince(
  forumId: string,
  since: number,
  limit = 50
): Promise<Message[]> {
  const cutoff = Date.now() - RETENTION_MS;
  const fromTs = Math.max(since + 1, cutoff);
  return db.messages
    .where("[forumId+relayTs]")
    .between([forumId, fromTs], [forumId, Infinity])
    .limit(limit)
    .toArray();
}

/**
 * Registra un foro en la base de datos local
 */
export async function ensureForumRecord(
  forumId: string,
  name: string,
  type?: "zone" | "user"
): Promise<Forum> {
  const isZone = forumId.startsWith(FORUM_PREFIX_ZONE);
  const detectedType = type || (isZone ? "zone" : "user");
  const msgCount = await db.messages.where("forumId").equals(forumId).count();
  const existing = await db.forums.get(forumId);
  if (existing) {
    await db.forums.update(forumId, {
      lastContactAt: Date.now(),
      isParticipant: msgCount > 0,
    });
    return { ...existing, lastContactAt: Date.now(), isParticipant: msgCount > 0 };
  }

  const newForum: Forum = {
    id: forumId,
    type: detectedType,
    name,
    createdAt: Date.now(),
    lastSyncRelayTs: 0,
    lastContactAt: Date.now(),
    isParticipant: msgCount > 0,
  };

  await db.forums.put(newForum);
  return newForum;
}

// ── Bandeja de Salida (Outbox para mensajes sin conexión) ──────────────

export async function addOutboxMessage(msg: OutboxMessage): Promise<void> {
  await db.outbox.put(msg);
}

export async function getOutboxMessages(forumId?: string): Promise<OutboxMessage[]> {
  if (forumId) {
    return db.outbox.where("forumId").equals(forumId).sortBy("clientTs");
  }
  return db.outbox.toArray();
}

export async function removeOutboxMessage(id: string): Promise<void> {
  await db.outbox.delete(id);
}

// ── Consultas de listas de foros locales ──────────────────────────────

/**
 * Obtiene la lista de todos los foros con copia local, junto con el número de mensajes de cada uno.
 */
export async function getLocalForumList(): Promise<Array<Forum & { messageCount: number }>> {
  const forums = await db.forums.toArray();
  const results = await Promise.all(
    forums.map(async (forum) => {
      const count = await db.messages.where("forumId").equals(forum.id).count();
      return { ...forum, messageCount: count };
    })
  );
  return results.sort((a, b) => b.lastContactAt - a.lastContactAt);
}

/**
 * Foros con copia local que este dispositivo puede servir como nodo.
 * Prioriza el foro activo y luego los más recientes, hasta `max`.
 */
export async function getForumsToServe(
  max: number,
  preferForumId?: string | null
): Promise<string[]> {
  const list = await getLocalForumList();
  const withCopy = list.filter((forum) => forum.messageCount > 0);
  const ids = withCopy.map((forum) => forum.id);
  if (preferForumId) {
    return [preferForumId, ...ids.filter((id) => id !== preferForumId)].slice(0, max);
  }
  return ids.slice(0, max);
}

// ── Estadísticas y Limpieza de Almacenamiento ──────────────────────────

export async function getStorageStats(): Promise<{
  messageCount: number;
  forumCount: number;
  outboxCount: number;
  isPersistent: boolean;
}> {
  const [messageCount, forumCount, outboxCount, isPersistent] = await Promise.all([
    db.messages.count(),
    db.forums.count(),
    db.outbox.count(),
    navigator.storage && navigator.storage.persisted
      ? navigator.storage.persisted()
      : Promise.resolve(false),
  ]);

  return { messageCount, forumCount, outboxCount, isPersistent };
}

export async function clearForumData(forumId: string): Promise<void> {
  await db.transaction("rw", db.messages, db.forums, db.outbox, async () => {
    await db.messages.where("forumId").equals(forumId).delete();
    await db.outbox.where("forumId").equals(forumId).delete();
    await db.forums.delete(forumId);
  });
}

export async function clearAllLocalData(): Promise<void> {
  await db.transaction(
    "rw",
    [
      db.messages,
      db.forums,
      db.outbox,
      db.directPeers,
      db.directRequests,
      db.directMessages,
      db.secureKeys,
    ],
    async () => {
      await db.messages.clear();
      await db.forums.clear();
      await db.outbox.clear();
      await db.directPeers.clear();
      await db.directRequests.clear();
      await db.directMessages.clear();
      await db.secureKeys.clear();
    }
  );
}

/**
 * Solicita almacenamiento persistente al navegador (evita que el navegador limpie la caché)
 */
export async function requestStoragePersistence(): Promise<boolean> {
  if (navigator.storage && navigator.storage.persist) {
    return await navigator.storage.persist();
  }
  return false;
}

// ── Gestión de Foros Temporales de Usuario (Iteración 5) ──────────────

/**
 * Guarda o actualiza un foro temporal de usuario en IndexedDB marcándolo como participante.
 */
export async function saveUserForum(
  forum: TemporaryForum,
  isParticipant: boolean = true
): Promise<Forum> {
  const existing = await db.forums.get(forum.id);
  const now = Date.now();
  const record: Forum = {
    id: forum.id,
    type: "user",
    name: forum.name,
    description: forum.description,
    latitude: forum.latitude,
    longitude: forum.longitude,
    radius: forum.radius,
    creatorKey: forum.creatorKey,
    createdAt: forum.createdAt || now,
    lastSyncRelayTs: existing?.lastSyncRelayTs ?? 0,
    lastContactAt: now,
    isParticipant,
    joinedAt: existing?.joinedAt ?? now,
    lastReadRelayTs: existing?.lastReadRelayTs ?? 0,
  };
  await db.forums.put(record);
  return record;
}

/**
 * Obtiene todos los foros (temporales de usuario y zonas permanentes) donde el usuario participa.
 * Regla de participación estricta: solo se considera participante si ha guardado al menos un mensaje localmente.
 */
export async function getParticipatingUserForums(): Promise<
  Array<Forum & { messageCount: number; unreadCount: number }>
> {
  const all = await db.forums.toArray();

  const results = await Promise.all(
    all.map(async (forum) => {
      const messageCount = await db.messages.where("forumId").equals(forum.id).count();
      // Solo aparece si se ha guardado al menos un mensaje en este dispositivo
      if (messageCount === 0) return null;
      const lastRead = forum.lastReadRelayTs ?? 0;
      const unreadCount = await db.messages
        .where("[forumId+relayTs]")
        .between([forum.id, lastRead + 1], [forum.id, Infinity], true, true)
        .count();
      return { ...forum, isParticipant: true, messageCount, unreadCount };
    })
  );

  const participating = results.filter((f): f is NonNullable<typeof f> => f !== null);
  return participating.sort((a, b) => (b.lastContactAt || 0) - (a.lastContactAt || 0));
}

/**
 * Actualiza el timestamp del último mensaje leído para limpiar las notificaciones visuales.
 */
export async function markForumAsRead(forumId: string, readRelayTs?: number): Promise<void> {
  const forum = await db.forums.get(forumId);
  if (!forum) return;

  let targetTs = readRelayTs;
  if (targetTs === undefined) {
    const latestMsg = await db.messages
      .where("forumId")
      .equals(forumId)
      .reverse()
      .sortBy("relayTs")
      .then((msgs) => msgs[0]);
    targetTs = latestMsg?.relayTs ?? Date.now();
  }

  await db.forums.update(forumId, {
    lastReadRelayTs: targetTs,
    lastContactAt: Date.now(),
  });
}

/**
 * Deja de participar en un foro de usuario y elimina su copia local de IndexedDB.
 */
export async function leaveUserForumPermanently(forumId: string): Promise<void> {
  await deleteForumAndMessages(forumId);
}

// ── Gestión de Pares Permanentes y Solicitudes Directas ───────────────

/**
 * Guarda o actualiza un contacto permanente en la libreta local.
 */
export async function saveDirectPeer(peer: DirectPeer): Promise<void> {
  const existing = await db.directPeers.get(peer.peerPublicKey);
  await db.directPeers.put({
    ...peer,
    unreadCount: existing?.unreadCount ?? peer.unreadCount ?? 0,
    lastInteractionTs: peer.lastInteractionTs || existing?.lastInteractionTs || Date.now(),
  });
}

/**
 * Obtiene todos los pares permanentes ordenados por última interacción.
 */
export async function getDirectPeers(): Promise<DirectPeer[]> {
  const peers = await db.directPeers.toArray();
  return peers.sort((a, b) => (b.lastInteractionTs || 0) - (a.lastInteractionTs || 0));
}

/**
 * Obtiene un par permanente por su clave pública.
 */
export async function getDirectPeer(peerPublicKey: string): Promise<DirectPeer | undefined> {
  return await db.directPeers.get(peerPublicKey);
}

/**
 * Actualiza el alias visible de un par permanente si éste lo modificó.
 */
export async function updateDirectPeerAlias(peerPublicKey: string, alias: string): Promise<void> {
  const peer = await db.directPeers.get(peerPublicKey);
  if (peer) {
    await db.directPeers.update(peerPublicKey, { alias });
  }
}

/**
 * Marca a un par permanente como eliminado cuando dicho usuario renueva o borra su perfil.
 * Esto preserva el historial de chat para que el usuario pueda enterarse y decidir cuándo borrarlo.
 */
export async function markDirectPeerAsDeleted(peerPublicKey: string): Promise<void> {
  const peer = await db.directPeers.get(peerPublicKey);
  if (peer) {
    await db.directPeers.update(peerPublicKey, { isDeletedByPeer: true });
  }
}

/**
 * Elimina un par permanente y todo su historial de mensajes directos y solicitudes.
 */
export async function deleteDirectPeerAndMessages(peerPublicKey: string): Promise<void> {
  const peer = await db.directPeers.get(peerPublicKey);
  await db.transaction(
    "rw",
    [db.directPeers, db.directMessages, db.directRequests],
    async () => {
      if (peer?.channelId) {
        await db.directMessages.where("channelId").equals(peer.channelId).delete();
      }
      await db.directPeers.delete(peerPublicKey);
      // Resetear estado eliminando solicitudes aceptadas o salientes de la relación eliminada,
      // protegiendo solicitudes entrantes pendientes nuevas que hayan llegado recientemente
      const reqs = await db.directRequests.where("peerPublicKey").equals(peerPublicKey).toArray();
      for (const r of reqs) {
        if (r.status === "accepted" || r.direction === "outgoing") {
          await db.directRequests.delete(r.id);
        }
      }
    }
  );
}

/**
 * Guarda o actualiza una solicitud directa en IndexedDB.
 */
export async function saveDirectRequest(request: DirectRequest): Promise<void> {
  await db.directRequests.put(request);
}

/**
 * Obtiene todas las solicitudes directas guardadas.
 * Evalúa automáticamente y marca como expiradas aquellas pendientes con más de 48 horas.
 */
export async function getDirectRequests(): Promise<DirectRequest[]> {
  const requests = await db.directRequests.toArray();
  const now = Date.now();
  for (const req of requests) {
    if (req.status === "pending" && now - req.createdAt > DIRECT_REQUEST_EXPIRATION_MS) {
      req.status = "expired";
      await db.directRequests.update(req.id, { status: "expired" });
    }
  }
  return requests.sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Actualiza el estado de una solicitud directa.
 */
export async function updateDirectRequestStatus(
  id: string,
  status: "pending" | "accepted" | "rejected" | "expired",
  cooldownUntil?: number
): Promise<void> {
  await db.directRequests.update(id, { status, cooldownUntil });
}

/**
 * Elimina una solicitud directa de IndexedDB.
 */
export async function deleteDirectRequest(id: string): Promise<void> {
  await db.directRequests.delete(id);
}

/**
 * Obtiene la solicitud activa más reciente asociada a un par.
 */
export async function getDirectRequestForPeer(peerPublicKey: string): Promise<DirectRequest | undefined> {
  const requests = await db.directRequests
    .where("peerPublicKey")
    .equals(peerPublicKey)
    .reverse()
    .sortBy("createdAt");
  return requests[0];
}

/**
 * Verifica si podemos enviar una solicitud directa a un par o si está en cooldown de 24h.
 * Aplica regla asimétrica: solo hay cooldown si NOSOTROS le enviamos una solicitud y fue rechazada.
 */
export async function checkRequestCooldown(
  peerPublicKey: string
): Promise<{ canRequest: boolean; cooldownRemainingMs: number; status?: string }> {
  const existingPeer = await db.directPeers.get(peerPublicKey);
  if (existingPeer) {
    return { canRequest: false, cooldownRemainingMs: 0, status: "accepted" };
  }

  const existingReq = await getDirectRequestForPeer(peerPublicKey);
  if (!existingReq) {
    return { canRequest: true, cooldownRemainingMs: 0 };
  }

  // Si ya es contacto permanente o ya fue aceptada
  if (existingReq.status === "accepted") {
    return { canRequest: false, cooldownRemainingMs: 0, status: "accepted" };
  }

  // Si hay una solicitud pendiente
  if (existingReq.status === "pending") {
    const now = Date.now();
    if (now - existingReq.createdAt > DIRECT_REQUEST_EXPIRATION_MS) {
      existingReq.status = "expired";
      await db.directRequests.update(existingReq.id, { status: "expired" });
      return { canRequest: true, cooldownRemainingMs: 0, status: "expired" };
    }
    return { canRequest: false, cooldownRemainingMs: 0, status: "pending" };
  }

  // Si ya expiró (más de 48h sin respuesta o perfil abandonado)
  if (existingReq.status === "expired") {
    return { canRequest: true, cooldownRemainingMs: 0, status: "expired" };
  }

  // Si fue rechazada
  if (existingReq.status === "rejected") {
    // Si fue saliente (nosotros enviamos y nos rechazaron), aplica cooldown de 24h
    if (existingReq.direction === "outgoing") {
      const now = Date.now();
      const cooldownUntil = existingReq.cooldownUntil ?? existingReq.createdAt + DIRECT_REQUEST_COOLDOWN_MS;
      if (now < cooldownUntil) {
        return {
          canRequest: false,
          cooldownRemainingMs: cooldownUntil - now,
          status: "rejected",
        };
      }
      // El cooldown de 24 horas ya expiró: reseteamos el estado para permitir volver a enviar
      await db.directRequests.delete(existingReq.id);
      return { canRequest: true, cooldownRemainingMs: 0 };
    }

    // Regla asimétrica: Si el usuario fue quien recibió y rechazó, el usuario SÍ puede enviar solicitud
    return { canRequest: true, cooldownRemainingMs: 0 };
  }

  return { canRequest: true, cooldownRemainingMs: 0 };
}

/**
 * Guarda un mensaje directo descifrado y actualiza metadata del par.
 */
export async function saveDirectMessage(msg: DirectMessage): Promise<void> {
  await db.transaction("rw", db.directMessages, db.directPeers, async () => {
    await db.directMessages.put(msg);

    const peerKey = msg.isOutgoing ? msg.toPublicKey : msg.fromPublicKey;
    const peer = await db.directPeers.get(peerKey);
    if (peer) {
      await db.directPeers.update(peerKey, {
        lastInteractionTs: msg.clientTs,
        lastMessagePreview: msg.content.slice(0, 60),
        unreadCount: msg.isOutgoing ? peer.unreadCount : (peer.unreadCount ?? 0) + 1,
      });
    }
  });
}

/**
 * Obtiene los mensajes directos de un canal en orden cronológico.
 */
export async function getDirectMessages(channelId: string): Promise<DirectMessage[]> {
  return await db.directMessages
    .where("channelId")
    .equals(channelId)
    .sortBy("clientTs");
}

/**
 * Marca un chat directo como leído (resetea unreadCount a 0).
 */
export async function markDirectChatAsRead(channelId: string): Promise<void> {
  const peers = await db.directPeers.where("channelId").equals(channelId).toArray();
  for (const peer of peers) {
    await db.directPeers.update(peer.peerPublicKey, { unreadCount: 0 });
  }
}

// ── Almacenamiento seguro de claves criptográficas (IndexedDB / Mitigación XSS) ──

export async function saveSecureKey(id: string, keyData: any): Promise<void> {
  await db.secureKeys.put({ id, keyData, createdAt: Date.now() });
}

export async function getSecureKey<T = any>(id: string): Promise<T | null> {
  const record = await db.secureKeys.get(id);
  return record ? (record.keyData as T) : null;
}

export async function removeSecureKey(id: string): Promise<void> {
  await db.secureKeys.delete(id);
}

