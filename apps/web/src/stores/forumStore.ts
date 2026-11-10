// ──────────────────────────────────────────────────────────────────────
//  Store de foros en vivo con Persistencia IndexedDB (Dexie),
//  Sincronización P2P vía Relay y Bandeja de Salida Offline (Iteración 3).
//  Iteración 3 mejorada: retención 3d, auto-descarga, nodo activo (≤5 foros),
//  salir del chat vs salir del foro, gestión desde Ajustes.
// ──────────────────────────────────────────────────────────────────────
import { create } from "zustand";
import { ulid } from "ulid";
import type { Message, LocalSession, Zone, OutboxMessage, TemporaryForum, Forum } from "@zonaviva/protocol";
import {
  FORUM_PREFIX_ZONE,
  FORUM_PREFIX_USER,
  MAX_MESSAGE_LENGTH,
  MAX_SERVED_FORUMS,
  SYNC_CHUNK_SIZE,
} from "@zonaviva/protocol";
import {
  connectNetwork,
  joinForumRoom,
  leaveForumRoom,
  sendForumMessage,
  requestForumSync,
  sendPeerSyncResponse,
  reportHasHistory,
  onMessageSealed,
  onOccupancyChange,
  onConnectionChange,
  onSyncChunk,
  onSyncUnavailable,
  onPeerSyncRequest,
  getRelayPublicKey,
  createTemporaryForumNetwork,
  announceUserForumsNetwork,
  fetchActiveUserForums,
  joinUserForumNetwork,
  leaveUserForumPermanentlyNetwork,
} from "@/modules/network";
import { signMessage, verifySignature } from "@/modules/identity";
import { verifyRelaySeal } from "@/modules/relayCrypto";
import {
  saveMessages,
  getForumMessages,
  getMessagesSince,
  ensureForumRecord,
  addOutboxMessage,
  getOutboxMessages,
  removeOutboxMessage,
  deleteForumAndMessages,
  deleteAllForumsAndMessages,
  getLocalForumList,
  getForumsToServe,
  mergeMessageLists,
  pruneAllOldMessages,
  RETENTION_MS,
  saveUserForum,
  getParticipatingUserForums,
  markForumAsRead,
  leaveUserForumPermanently as leaveUserForumInStorage,
} from "@/db/storage";
import { distanceMeters } from "@/geo/geoCore";

export type SyncStatus = "idle" | "syncing" | "synced" | "unavailable";

interface ForumState {
  activeForumId: string | null;
  occupancy: number;
  occupancyByForum: Record<string, number>;
  messages: Message[];
  outboxMessages: OutboxMessage[];
  syncStatus: SyncStatus;
  isSending: boolean;
  networkConnected: boolean;
  error: string | null;
  initialized: boolean;

  /**
   * IDs de los foros en los que tenemos copia local guardada.
   * Se usa para saber a qué salas re-unirnos al reconectar y servir como nodo.
   */
  subscribedForums: string[];
  /** Salas del relay en las que estamos sirviendo historial */
  servedForumIds: string[];

  // ── Foros Temporales de Usuario (Iteración 5) ───────────────────────
  nearbyUserForums: TemporaryForum[];
  myUserForums: Array<Forum & { messageCount: number; unreadCount: number }>;
  isFetchingNearby: boolean;

  fetchNearbyUserForums: (userPos?: { latitude: number; longitude: number } | null) => Promise<void>;
  refreshMyUserForums: () => Promise<void>;
  createTemporaryForum: (params: {
    name: string;
    description: string;
    radius: number;
    latitude: number;
    longitude: number;
    session: LocalSession;
  }) => Promise<{ success: boolean; forumId?: string; error?: string }>;
  leaveUserForum: (forumId: string) => Promise<void>;

  initNetwork: () => void;
  enterForum: (forumId: string, forumName?: string) => Promise<void>;
  /** Solo navega fuera del chat — mantiene copia y suscripción en el relay */
  leaveCurrentForum: () => void;
  /** Borra datos locales del foro y abandona la sala del relay */
  leaveForumPermanently: (forumId: string) => Promise<void>;
  /** Borra datos locales de TODOS los foros */
  leaveAllForums: () => Promise<void>;
  /** Recarga la lista de foros suscritos desde IndexedDB */
  refreshSubscribedForums: () => Promise<void>;
  /**
   * Al conectar/reconectar, se une a las salas de los foros suscritos (máx 5)
   * y reporta al relay que tiene historial local.
   */
  serveAsNode: () => Promise<void>;
  publishMessage: (
    content: string,
    session: LocalSession,
    physicalZone?: Zone | null,
    isPhysicallyInsideUserForum?: boolean
  ) => Promise<{ success: boolean; error?: string; queued?: boolean }>;
  flushOutbox: (session: LocalSession) => Promise<void>;
}

export const useForumStore = create<ForumState>((set, get) => ({
  activeForumId: null,
  occupancy: 0,
  occupancyByForum: {},
  messages: [],
  outboxMessages: [],
  syncStatus: "idle",
  isSending: false,
  networkConnected: false,
  error: null,
  initialized: false,
  subscribedForums: [],
  servedForumIds: [],
  nearbyUserForums: [],
  myUserForums: [],
  isFetchingNearby: false,

  initNetwork: () => {
    if (get().initialized) return;

    connectNetwork();

    // ── Conexión / Reconexión ─────────────────────────────────────────
    onConnectionChange((connected) => {
      set({ networkConnected: connected });
      if (connected) {
        // Re-servir como nodo en todos los foros suscritos
        get().serveAsNode();
        get().refreshMyUserForums();

        // Al reconectar, pedir la ventana de retención completa para recuperar huecos
        const { activeForumId } = get();
        if (activeForumId) {
          set({ syncStatus: "syncing" });
          requestForumSync(activeForumId, Date.now() - RETENTION_MS);
        }
      }
    });

    // ── Ocupación de salas ───────────────────────────────────────────
    onOccupancyChange(({ forumId, count }) => {
      set((state) => ({
        occupancyByForum: { ...state.occupancyByForum, [forumId]: count },
        occupancy: state.activeForumId === forumId ? count : state.occupancy,
      }));
    });

    // ── Mensajes sellados en tiempo real ─────────────────────────────
    onMessageSealed(async (sealed) => {
      // 1. Verificar sello criptográfico del relay
      const isValidSeal = await verifyRelaySeal(getRelayPublicKey(), sealed);
      if (!isValidSeal) {
        console.warn("[Seguridad] Mensaje con sello de relay inválido descartado:", sealed.id);
        return;
      }

      // 2. Verificar firma ECDSA del autor (Zero-Trust End-to-End)
      const isAuthorValid = await verifySignature(sealed.authorKey, sealed.content, sealed.sig);
      if (!isAuthorValid) {
        console.warn("[Seguridad] Mensaje descartado: firma del autor inválida o alterada:", sealed.id);
        return;
      }

      await saveMessages([sealed as Message]);

      if (sealed.forumId === get().activeForumId) {
        set((prev) => ({
          messages: mergeMessageLists(prev.messages, [sealed as Message]),
        }));
        await markForumAsRead(sealed.forumId, sealed.relayTs);
      } else {
        // Mensaje recibido para un foro en segundo plano: actualizar notificaciones de no leídos
        get().refreshMyUserForums();
      }

      reportHasHistory(sealed.forumId, 1);
    });

    // ── Chunks de sincronización de historial recibido ────────────────
    onSyncChunk(async ({ forumId, messages: chunk, hasMore }) => {
      const isActive = forumId === get().activeForumId;

      if (chunk.length === 0) {
        if (isActive) {
          set({
            syncStatus: get().messages.length > 0 ? "synced" : "unavailable",
          });
        }
        return;
      }

      const verifiedList: Message[] = [];
      const relayKey = getRelayPublicKey();
      for (const m of chunk) {
        // 1. Verificar sello de relay
        const validRelay = await verifyRelaySeal(relayKey, m);
        if (!validRelay) {
          console.warn("[Seguridad] Mensaje de sincronización con sello de relay inválido descartado:", m.id);
          continue;
        }

        // 2. Verificar firma ECDSA del autor (Zero-Trust End-to-End)
        const validAuthor = await verifySignature(m.authorKey, m.content, m.sig);
        if (!validAuthor) {
          console.warn("[Seguridad] Mensaje de sincronización con firma de autor inválida descartado:", m.id);
          continue;
        }

        verifiedList.push(m);
      }

      const ordered = mergeMessageLists(verifiedList);
      await saveMessages(ordered);

      if (isActive) {
        set((prev) => ({
          messages: mergeMessageLists(prev.messages, ordered),
          syncStatus: hasMore ? "syncing" : "synced",
        }));
      }

      if (hasMore && ordered.length > 0) {
        requestForumSync(forumId, ordered[ordered.length - 1].relayTs);
      }

      if (verifiedList.length > 0) {
        reportHasHistory(forumId, verifiedList.length);
      }
    });

    // ── Aviso de Historial No Disponible ──────────────────────────────
    onSyncUnavailable(({ forumId }) => {
      if (forumId !== get().activeForumId) return;
      const { messages, syncStatus } = get();
      if (syncStatus === "synced" || messages.length > 0) {
        set({ syncStatus: "synced" });
        return;
      }
      if (syncStatus === "syncing") {
        set({ syncStatus: "unavailable" });
      }
    });

    // ── Responder a peticiones de sync de otros pares ─────────────────
    // Respondemos para CUALQUIER foro del que tengamos copia local, no solo el activo
    onPeerSyncRequest(async (req) => {
      try {
        const matchingMessages = await getMessagesSince(req.forumId, req.since, SYNC_CHUNK_SIZE);
        sendPeerSyncResponse({
          requestId: req.requestId,
          forumId: req.forumId,
          messages: matchingMessages,
          hasMore: matchingMessages.length >= SYNC_CHUNK_SIZE,
        });
      } catch {
        // En caso de fallo de lectura, ignorar
      }
    });

    // Inicializar lista de foros suscritos y servir como nodo
    get()
      .refreshSubscribedForums()
      .then(() => get().serveAsNode());

    // Limpiar mensajes viejos al iniciar (retención 3 días)
    pruneAllOldMessages().catch(() => {});

    set({ initialized: true });
  },

  refreshSubscribedForums: async () => {
    try {
      const forumList = await getLocalForumList();
      const ids = forumList.map((f) => f.id);
      set({ subscribedForums: ids });
    } catch {
      // Ignorar
    }
  },

  serveAsNode: async () => {
    const { networkConnected, activeForumId, servedForumIds } = get();
    if (!networkConnected) return;

    const forumsToServe = await getForumsToServe(MAX_SERVED_FORUMS, activeForumId);

    for (const fid of servedForumIds) {
      if (!forumsToServe.includes(fid) && fid !== activeForumId) {
        leaveForumRoom(fid);
      }
    }

    for (const fid of forumsToServe) {
      try {
        await joinForumRoom(fid);
        const msgs = await getForumMessages(fid);
        if (msgs.length > 0) {
          reportHasHistory(fid, msgs.length);
        }
      } catch {
        // Ignorar errores individuales
      }
    }

    set({ servedForumIds: forumsToServe });
  },

  enterForum: async (forumId: string, forumName?: string) => {
    get().initNetwork();

    // 1. Cargar historial local inmediatamente desde IndexedDB (offline-first)
    const localMsgs = await getForumMessages(forumId);
    const localOutbox = await getOutboxMessages(forumId);
    await ensureForumRecord(forumId, forumName ?? forumId);
    await markForumAsRead(forumId);
    void get().refreshMyUserForums();

    set({
      activeForumId: forumId,
      messages: localMsgs,
      outboxMessages: localOutbox,
      syncStatus: localMsgs.length > 0 ? "synced" : "syncing",
      error: null,
    });

    // 2. Unirse a la sala en el relay
    if (forumId.startsWith(FORUM_PREFIX_USER)) {
      joinUserForumNetwork(forumId).catch(() => {});
    }
    const res = await joinForumRoom(forumId);
    if (res.ok) {
      set((state) => ({
        occupancy: res.count ?? 1,
        occupancyByForum: { ...state.occupancyByForum, [forumId]: res.count ?? 1 },
      }));

      // Reportar al relay que tenemos copias locales
      if (localMsgs.length > 0) {
        reportHasHistory(forumId, localMsgs.length);
      }

      // Pedir desde el corte de 3 días para fusionar copias partidas (1–100 + 101–130)
      set({ syncStatus: "syncing" });
      requestForumSync(forumId, Date.now() - RETENTION_MS);

      await get().refreshSubscribedForums();
      await get().serveAsNode();
    } else {
      set({
        syncStatus: localMsgs.length > 0 ? "synced" : "unavailable",
        error: res.error ?? "No fue posible unirse al foro en el relay.",
      });
    }
  },

  /**
   * Salir del chat — solo navega fuera de la vista.
   * Mantiene la copia local y la suscripción en el relay (el nodo sigue activo).
   */
  leaveCurrentForum: () => {
    set({
      activeForumId: null,
      messages: [],
      outboxMessages: [],
      occupancy: 0,
      syncStatus: "idle",
    });
    void get().serveAsNode();
  },

  /**
   * Salir del foro permanentemente — borra datos locales y abandona la sala del relay.
   */
  leaveForumPermanently: async (forumId: string) => {
    // 1. Salir de la sala del relay
    leaveForumRoom(forumId);

    // 2. Borrar datos locales
    await deleteForumAndMessages(forumId);

    // 3. Limpiar estado en memoria si es el foro activo
    if (get().activeForumId === forumId) {
      set({
        activeForumId: null,
        messages: [],
        outboxMessages: [],
        occupancy: 0,
        syncStatus: "idle",
        error: null,
      });
    }

    set((state) => ({
      servedForumIds: state.servedForumIds.filter((id) => id !== forumId),
    }));
    await get().refreshSubscribedForums();
    await get().serveAsNode();
    await get().refreshMyUserForums();
  },

  /**
   * Salir de TODOS los foros — borra todos los datos locales y abandona todas las salas.
   */
  leaveAllForums: async () => {
    const rooms = new Set([...get().subscribedForums, ...get().servedForumIds]);
    const activeId = get().activeForumId;
    if (activeId) rooms.add(activeId);

    for (const fid of rooms) {
      leaveForumRoom(fid);
    }

    // Borrar todos los datos locales
    await deleteAllForumsAndMessages();

    // Limpiar estado en memoria
    set({
      activeForumId: null,
      messages: [],
      outboxMessages: [],
      occupancy: 0,
      syncStatus: "idle",
      subscribedForums: [],
      servedForumIds: [],
      error: null,
    });
  },

  publishMessage: async (
    content: string,
    session: LocalSession,
    physicalZone?: Zone | null,
    isPhysicallyInsideUserForum?: boolean
  ) => {
    const { activeForumId, networkConnected } = get();

    if (!activeForumId) {
      return { success: false, error: "No hay un foro activo." };
    }

    const trimmed = content.trim();
    if (!trimmed || trimmed.length > MAX_MESSAGE_LENGTH) {
      return {
        success: false,
        error: `El mensaje debe tener entre 1 y ${MAX_MESSAGE_LENGTH} caracteres.`,
      };
    }

    // Comprobación de regla geográfica: solo dentro de la zona se puede publicar
    if (activeForumId.startsWith(FORUM_PREFIX_ZONE)) {
      const targetZoneId = activeForumId.slice(FORUM_PREFIX_ZONE.length);
      if (!physicalZone || physicalZone.id !== targetZoneId) {
        return {
          success: false,
          error: "Solo lectura: debes estar físicamente en esta zona para poder publicar.",
        };
      }
    }

    // Comprobación de regla geográfica para foros temporales de usuario:
    if (activeForumId.startsWith(FORUM_PREFIX_USER)) {
      if (!isPhysicallyInsideUserForum) {
        return {
          success: false,
          error: "Solo lectura: debes estar dentro del ámbito físico del foro para poder publicar.",
        };
      }
    }

    const msgId = ulid();
    const clientTs = Date.now();

    // ── Modo sin conexión: Guardar en bandeja de salida (Outbox) ──────
    if (!networkConnected) {
      const outboxItem: OutboxMessage = {
        id: msgId,
        forumId: activeForumId,
        content: trimmed,
        clientTs,
        retries: 0,
      };

      await addOutboxMessage(outboxItem);
      set((prev) => ({
        outboxMessages: [...prev.outboxMessages, outboxItem],
      }));

      return {
        success: true,
        queued: true,
      };
    }

    // ── Modo conectado: Firmar y enviar al Relay ───────────────────────
    set({ isSending: true, error: null });

    try {
      const sig = await signMessage(session.privateKey, trimmed);

      const payload = {
        id: msgId,
        forumId: activeForumId,
        alias: session.alias,
        authorKey: session.publicKey,
        content: trimmed,
        clientTs,
        sig,
      };

      const res = await sendForumMessage(payload);
      set({ isSending: false });

      if (!res.ok) {
        // Si falló por error transitorio de red, enviar a bandeja de salida
        const outboxItem: OutboxMessage = {
          id: msgId,
          forumId: activeForumId,
          content: trimmed,
          clientTs,
          retries: 0,
        };
        await addOutboxMessage(outboxItem);
        set((prev) => ({
          outboxMessages: [...prev.outboxMessages, outboxItem],
        }));
        return { success: true, queued: true };
      }

      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error inesperado al enviar";
      set({ isSending: false, error: msg });
      return { success: false, error: msg };
    }
  },

  // ── Vaciar y retransmitir bandeja de salida al reconectar ──────────
  flushOutbox: async (session: LocalSession) => {
    const { activeForumId, networkConnected } = get();
    if (!networkConnected || !activeForumId) return;

    const pending = await getOutboxMessages(activeForumId);
    if (pending.length === 0) return;

    for (const item of pending) {
      try {
        const sig = await signMessage(session.privateKey, item.content);
        const payload = {
          id: item.id,
          forumId: item.forumId,
          alias: session.alias,
          authorKey: session.publicKey,
          content: item.content,
          clientTs: item.clientTs,
          sig,
        };

        const res = await sendForumMessage(payload);
        if (res.ok) {
          await removeOutboxMessage(item.id);
          set((prev) => ({
            outboxMessages: prev.outboxMessages.filter((o) => o.id !== item.id),
          }));
        }
      } catch {
        // Reintentará en la siguiente reconexión
      }
    }
  },

  // ── Foros Temporales de Usuario (Iteración 5) ───────────────────────

  fetchNearbyUserForums: async (userPos) => {
    set({ isFetchingNearby: true });
    try {
      if (!userPos) {
        // Sin señal de ubicación GPS no se muestran foros como 'cercanos'
        set({ nearbyUserForums: [], isFetchingNearby: false });
        return;
      }
      const activeForums = await fetchActiveUserForums();
      // Filtrar aquellos foros cuyo círculo cubre la posición actual del usuario
      const filtered = activeForums.filter((f) => {
        const dist = distanceMeters(userPos.latitude, userPos.longitude, f.latitude, f.longitude);
        return dist <= f.radius + 50; // tolerancia de GPS
      });
      set({ nearbyUserForums: filtered, isFetchingNearby: false });
    } catch {
      set({ isFetchingNearby: false });
    }
  },

  refreshMyUserForums: async () => {
    try {
      const myForums = await getParticipatingUserForums();
      set({ myUserForums: myForums });

      // Anunciar al relay la presencia en foros temporales de usuario (N > 0)
      const userAnnounce = myForums.filter((f) => f.type === "user" || f.id.startsWith("user:"));
      if (get().networkConnected && userAnnounce.length > 0) {
        const announcement: TemporaryForum[] = userAnnounce.map((f) => ({
          id: f.id,
          type: "user",
          name: f.name,
          description: f.description || "",
          latitude: f.latitude || 0,
          longitude: f.longitude || 0,
          radius: f.radius || 200,
          createdAt: f.createdAt,
          creatorKey: f.creatorKey || "",
        }));
        announceUserForumsNetwork(announcement).catch(() => {});
      }
    } catch {
      // Ignorar errores de carga
    }
  },

  createTemporaryForum: async (params) => {
    const forumId = `user:${ulid()}`;
    const forumData: TemporaryForum = {
      id: forumId,
      type: "user",
      name: params.name,
      description: params.description,
      latitude: params.latitude,
      longitude: params.longitude,
      radius: params.radius,
      createdAt: Date.now(),
      creatorKey: params.session.publicKey,
      participantCount: 1,
    };

    // 1. Guardar localmente en IndexedDB
    await saveUserForum(forumData, true);

    // 2. Registrar en el relay
    const res = await createTemporaryForumNetwork(forumData);
    if (!res.ok) {
      console.warn("[relay] Error al registrar foro en relay:", res.error);
    }

    // 3. Actualizar listas locales
    await get().refreshMyUserForums();
    await get().refreshSubscribedForums();

    return { success: true, forumId };
  },

  leaveUserForum: async (forumId: string) => {
    // 1. Notificar al relay (resta participante y si N=0 el relay purga el foro)
    await leaveUserForumPermanentlyNetwork(forumId);

    // 2. Eliminar de IndexedDB local
    await leaveUserForumInStorage(forumId);

    // 3. Salir de sala socket
    leaveForumRoom(forumId);

    // 4. Actualizar estado
    await get().refreshMyUserForums();
    await get().refreshSubscribedForums();
  },
}));
