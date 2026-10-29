// ──────────────────────────────────────────────────────────────────────
//  Gestor de persistencia local y sincronización (IndexedDB)
//  Implementa política de recorte para no saturar memoria en el navegador.
// ──────────────────────────────────────────────────────────────────────
import { db } from "./index";
import type { Message, Forum, OutboxMessage } from "@zonaviva/protocol";

const MAX_MESSAGES_PER_FORUM = 500;

/**
 * Guarda mensajes sellados en IndexedDB de forma deduplicada
 * y recorta los mensajes más antiguos si supera el límite de 500.
 */
export async function saveMessages(messages: Message[]): Promise<void> {
  if (messages.length === 0) return;

  await db.transaction("rw", db.messages, db.forums, async () => {
    // Upsert masivo
    await db.messages.bulkPut(messages);

    // Agrupar por foros para actualizar metadata y aplicar recorte
    const forumIds = Array.from(new Set(messages.map((m) => m.forumId)));

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

      // Actualizar lastSyncRelayTs en el registro del foro
      const latestMsg = forumMsgs[forumMsgs.length - 1];
      if (latestMsg) {
        const existing = await db.forums.get(forumId);
        if (existing) {
          await db.forums.update(forumId, {
            lastSyncRelayTs: Math.max(existing.lastSyncRelayTs, latestMsg.relayTs),
            lastContactAt: Date.now(),
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
  return db.messages
    .where("forumId")
    .equals(forumId)
    .sortBy("relayTs");
}

/**
 * Obtiene los mensajes con relayTs > since para responder a peticiones de sync P2P
 */
export async function getMessagesSince(
  forumId: string,
  since: number,
  limit = 50
): Promise<Message[]> {
  return db.messages
    .where("[forumId+relayTs]")
    .between([forumId, since + 1], [forumId, Infinity])
    .limit(limit)
    .toArray();
}

/**
 * Registra un foro en la base de datos local
 */
export async function ensureForumRecord(
  forumId: string,
  name: string,
  type: "zone" | "user" = "zone"
): Promise<Forum> {
  const existing = await db.forums.get(forumId);
  if (existing) {
    await db.forums.update(forumId, { lastContactAt: Date.now() });
    return { ...existing, lastContactAt: Date.now() };
  }

  const newForum: Forum = {
    id: forumId,
    type,
    name,
    createdAt: Date.now(),
    lastSyncRelayTs: 0,
    lastContactAt: Date.now(),
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
  await db.transaction("rw", db.messages, db.forums, db.outbox, async () => {
    await db.messages.clear();
    await db.forums.clear();
    await db.outbox.clear();
  });
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
