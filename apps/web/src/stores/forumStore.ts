// ──────────────────────────────────────────────────────────────────────
//  Store de foros en vivo con Persistencia IndexedDB (Dexie),
//  Sincronización P2P vía Relay y Bandeja de Salida Offline (Iteración 3).
// ──────────────────────────────────────────────────────────────────────
import { create } from "zustand";
import { ulid } from "ulid";
import type { Message, LocalSession, Zone, OutboxMessage } from "@zonaviva/protocol";
import { FORUM_PREFIX_ZONE, MAX_MESSAGE_LENGTH } from "@zonaviva/protocol";
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
} from "@/modules/network";
import { signMessage } from "@/modules/identity";
import { verifyRelaySeal } from "@/modules/relayCrypto";
import {
  saveMessages,
  getForumMessages,
  getMessagesSince,
  ensureForumRecord,
  addOutboxMessage,
  getOutboxMessages,
  removeOutboxMessage,
} from "@/db/storage";

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

  initNetwork: () => void;
  enterForum: (forumId: string, forumName?: string) => Promise<void>;
  leaveCurrentForum: () => void;
  publishMessage: (
    content: string,
    session: LocalSession,
    physicalZone: Zone | null
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

  initNetwork: () => {
    if (get().initialized) return;

    connectNetwork();

    // ── Conexión / Reconexión ─────────────────────────────────────────
    onConnectionChange((connected) => {
      set({ networkConnected: connected });
      if (connected) {
        // Al reconectar, reintentar sincronización del foro activo si existe
        const { activeForumId, messages } = get();
        if (activeForumId) {
          const latestTs = messages.length > 0 ? messages[messages.length - 1].relayTs : 0;
          set({ syncStatus: "syncing" });
          requestForumSync(activeForumId, latestTs);
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
      // Verificar sello del relay
      const isValidSeal = await verifyRelaySeal(getRelayPublicKey(), sealed);
      if (!isValidSeal) {
        console.warn("[Seguridad] Mensaje con sello de relay inválido descartado:", sealed.id);
        return;
      }

      // Guardar en IndexedDB localmente
      await saveMessages([sealed as Message]);

      // Si corresponde al foro activo, insertar y mantener orden canónico
      if (sealed.forumId === get().activeForumId) {
        set((prev) => {
          if (prev.messages.some((m) => m.id === sealed.id)) return prev;
          const updated = [...prev.messages, sealed as Message].sort((a, b) => {
            if (a.relayTs !== b.relayTs) return a.relayTs - b.relayTs;
            return a.id.localeCompare(b.id);
          });
          return { messages: updated };
        });
      }
    });

    // ── Chunks de sincronización de historial recibido ────────────────
    onSyncChunk(async ({ forumId, messages: chunk }) => {
      if (forumId !== get().activeForumId || chunk.length === 0) return;

      // Filtrar mensajes verificando el sello de cada uno
      const verifiedList: Message[] = [];
      const relayKey = getRelayPublicKey();
      for (const m of chunk) {
        const valid = await verifyRelaySeal(relayKey, m);
        if (valid) verifiedList.push(m);
      }

      // Persistir en IndexedDB
      await saveMessages(verifiedList);

      // Combinar y deduplicar en memoria
      set((prev) => {
        const existingIds = new Set(prev.messages.map((m) => m.id));
        const newOnes = verifiedList.filter((m) => !existingIds.has(m.id));
        const merged = [...prev.messages, ...newOnes].sort((a, b) => {
          if (a.relayTs !== b.relayTs) return a.relayTs - b.relayTs;
          return a.id.localeCompare(b.id);
        });
        return { messages: merged, syncStatus: "synced" };
      });
    });

    // ── Aviso de Historial No Disponible ──────────────────────────────
    onSyncUnavailable(({ forumId }) => {
      if (forumId === get().activeForumId) {
        set({ syncStatus: "unavailable" });
      }
    });

    // ── Responder a peticiones de sync de otros pares ─────────────────
    onPeerSyncRequest(async (req) => {
      try {
        const matchingMessages = await getMessagesSince(req.forumId, req.since, 50);
        sendPeerSyncResponse({
          requestId: req.requestId,
          forumId: req.forumId,
          messages: matchingMessages,
          hasMore: matchingMessages.length >= 50,
        });
      } catch {
        // En caso de fallo de lectura, ignorar
      }
    });

    set({ initialized: true });
  },

  enterForum: async (forumId: string, forumName?: string) => {
    get().initNetwork();

    const previousForum = get().activeForumId;
    if (previousForum && previousForum !== forumId) {
      leaveForumRoom(previousForum);
    }

    // 1. Cargar historial local inmediatamente desde IndexedDB (offline-first)
    const localMsgs = await getForumMessages(forumId);
    const localOutbox = await getOutboxMessages(forumId);
    await ensureForumRecord(forumId, forumName ?? forumId);

    set({
      activeForumId: forumId,
      messages: localMsgs,
      outboxMessages: localOutbox,
      syncStatus: localMsgs.length > 0 ? "synced" : "syncing",
      error: null,
    });

    // 2. Unirse a la sala en el relay
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

      // 3. Solicitar historial nuevo que pudiera haberse generado
      const latestLocalTs = localMsgs.length > 0 ? localMsgs[localMsgs.length - 1].relayTs : 0;
      set({ syncStatus: "syncing" });
      requestForumSync(forumId, latestLocalTs);
    } else {
      set({
        syncStatus: localMsgs.length > 0 ? "synced" : "unavailable",
        error: res.error ?? "No fue posible unirse al foro en el relay.",
      });
    }
  },

  leaveCurrentForum: () => {
    const { activeForumId } = get();
    if (activeForumId) {
      leaveForumRoom(activeForumId);
      set({
        activeForumId: null,
        messages: [],
        outboxMessages: [],
        occupancy: 0,
        syncStatus: "idle",
      });
    }
  },

  publishMessage: async (
    content: string,
    session: LocalSession,
    physicalZone: Zone | null
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
}));
