// ──────────────────────────────────────────────────────────────────────
//  Store de foros en vivo (apps/web/src/stores/forumStore.ts)
//  Gestiona foros activos, mensajes en memoria ordenados por (relayTs, id),
//  número de participantes conectados y reglas de autorización de zona.
// ──────────────────────────────────────────────────────────────────────
import { create } from "zustand";
import { ulid } from "ulid";
import type { Message, LocalSession, Zone } from "@zonaviva/protocol";
import { FORUM_PREFIX_ZONE, MAX_MESSAGE_LENGTH } from "@zonaviva/protocol";
import {
  connectNetwork,
  joinForumRoom,
  leaveForumRoom,
  sendForumMessage,
  onMessageSealed,
  onOccupancyChange,
  onConnectionChange,
} from "@/modules/network";
import { signMessage } from "@/modules/identity";

interface ForumState {
  activeForumId: string | null;
  occupancy: number;
  occupancyByForum: Record<string, number>;
  messages: Message[];
  isSending: boolean;
  networkConnected: boolean;
  error: string | null;
  initialized: boolean;

  initNetwork: () => void;
  enterForum: (forumId: string) => Promise<void>;
  leaveCurrentForum: () => void;
  publishMessage: (
    content: string,
    session: LocalSession,
    physicalZone: Zone | null
  ) => Promise<{ success: boolean; error?: string }>;
}

export const useForumStore = create<ForumState>((set, get) => ({
  activeForumId: null,
  occupancy: 0,
  occupancyByForum: {},
  messages: [],
  isSending: false,
  networkConnected: false,
  error: null,
  initialized: false,

  initNetwork: () => {
    if (get().initialized) return;

    connectNetwork();

    onConnectionChange((connected) => {
      set({ networkConnected: connected });
    });

    onOccupancyChange(({ forumId, count }) => {
      set((state) => ({
        occupancyByForum: { ...state.occupancyByForum, [forumId]: count },
        occupancy: state.activeForumId === forumId ? count : state.occupancy,
      }));
    });

    onMessageSealed((sealed) => {
      const state = get();
      if (sealed.forumId !== state.activeForumId) return;

      // Deduplicar e insertar manteniendo orden canónico (relayTs, id)
      set((prev) => {
        if (prev.messages.some((m) => m.id === sealed.id)) {
          return prev;
        }
        const updated = [...prev.messages, sealed as Message].sort((a, b) => {
          if (a.relayTs !== b.relayTs) {
            return a.relayTs - b.relayTs;
          }
          return a.id.localeCompare(b.id);
        });
        return { messages: updated };
      });
    });

    set({ initialized: true });
  },

  enterForum: async (forumId: string) => {
    get().initNetwork();

    const previousForum = get().activeForumId;
    if (previousForum && previousForum !== forumId) {
      leaveForumRoom(previousForum);
    }

    set({ activeForumId: forumId, messages: [], error: null });

    const res = await joinForumRoom(forumId);
    if (res.ok) {
      set((state) => ({
        occupancy: res.count ?? 1,
        occupancyByForum: {
          ...state.occupancyByForum,
          [forumId]: res.count ?? 1,
        },
      }));
    } else {
      set({ error: res.error ?? "No fue posible unirse al foro." });
    }
  },

  leaveCurrentForum: () => {
    const { activeForumId } = get();
    if (activeForumId) {
      leaveForumRoom(activeForumId);
      set({ activeForumId: null, messages: [], occupancy: 0 });
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

    if (!networkConnected) {
      return {
        success: false,
        error: "Sin conexión al servidor relay. No se puede publicar desconectado.",
      };
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
          error:
            "Solo lectura: debes encontrarte físicamente en esta zona para poder publicar.",
        };
      }
    }

    set({ isSending: true, error: null });

    try {
      const msgId = ulid();
      const clientTs = Date.now();

      // Firma criptográfica del autor sobre el contenido con WebCrypto ECDSA
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
        set({ error: res.error ?? "Error al enviar mensaje" });
        return { success: false, error: res.error };
      }

      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error inesperado al firmar o enviar";
      set({ isSending: false, error: msg });
      return { success: false, error: msg };
    }
  },
}));
