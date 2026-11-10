// ──────────────────────────────────────────────────────────────────────
//  Store de Pares Permanentes y Chat Directo E2EE (apps/web/src/stores/directChatStore.ts)
//  - Contactos guardados sin limitación geográfica
//  - Cifrado de extremo a extremo (ECDH + AES-GCM-256)
//  - Solicitudes con saludo y cooldown asimétrico de 24 horas tras rechazo
//  - Almacenamiento local en IndexedDB (cero persistencia en relay)
// ──────────────────────────────────────────────────────────────────────
import { create } from "zustand";
import type {
  DirectPeer,
  DirectRequest,
  DirectMessage,
  SendDirectRequestPayload,
  RespondDirectRequestPayload,
  DirectMsgPayload,
} from "@zonaviva/protocol";
import { DIRECT_REQUEST_COOLDOWN_MS, MAX_DIRECT_PEERS_PER_CLIENT } from "@zonaviva/protocol";
import { db } from "@/db";
import {
  saveDirectPeer,
  getDirectPeers,
  getDirectPeer,
  updateDirectPeerAlias,
  markDirectPeerAsDeleted,
  deleteDirectPeerAndMessages,
  saveDirectRequest,
  getDirectRequests,
  getDirectRequestForPeer,
  updateDirectRequestStatus,
  deleteDirectRequest,
  checkRequestCooldown,
  saveDirectMessage,
  getDirectMessages,
  markDirectChatAsRead,
} from "@/db/storage";
import {
  getOrCreatePersistentE2EEKeyPair,
  deriveDirectSharedKey,
  encryptMessage,
  decryptMessage,
  getDirectChannelId,
} from "@/modules/e2ee";
import {
  registerIdentityNetwork,
  sendDirectRequestNetwork,
  respondDirectRequestNetwork,
  sendDirectMsgNetwork,
  onDirectRequestReceived,
  onDirectRequestAccepted,
  onDirectRequestRejected,
  onDirectMsgReceived,
  deleteDirectPeerNetwork,
  onDirectPeerDeleted,
  cancelDirectRequestNetwork,
  onConnectionChange,
} from "@/modules/network";
import { useIdentityStore } from "./identityStore";

interface DirectChatState {
  peers: DirectPeer[];
  requests: DirectRequest[];
  unreadTotal: number;
  activeDirectPeer: DirectPeer | null;
  activeMessages: DirectMessage[];
  isLoading: boolean;
  isSending: boolean;
  isInitialized: boolean;

  /** Inicializa oyentes de red y carga datos de IndexedDB */
  initDirectStore: () => Promise<void>;
  /** Recarga la lista de pares y solicitudes desde IndexedDB */
  loadData: () => Promise<void>;
  /** Envía una solicitud de contacto permanente */
  sendRequest: (
    toPublicKey: string,
    toAlias: string,
    introMessage?: string,
    sourceForumName?: string,
    allowResend?: boolean
  ) => Promise<{ ok: boolean; error?: string }>;
  /** Responde a una solicitud directa recibida (aceptar o rechazar) */
  respondRequest: (
    requestId: string,
    action: "accept" | "reject"
  ) => Promise<{ ok: boolean; error?: string }>;
  /** Cancela o descarta una solicitud (entrante o saliente) y limpia el estado local */
  cancelRequest: (requestId: string) => Promise<void>;
  /** Abre un chat directo guardado */
  openDirectChat: (peerPublicKey: string) => Promise<void>;
  /** Cierra la conversación directa activa */
  closeDirectChat: () => void;
  /** Envía un mensaje directo cifrado con E2EE al par activo */
  sendMessage: (content: string) => Promise<boolean>;
  /** Elimina un contacto permanente y todo su historial local */
  deletePeer: (peerPublicKey: string) => Promise<void>;
  /** Consulta el estado o cooldown de solicitud con un usuario */
  checkCooldown: (
    peerPublicKey: string
  ) => Promise<{ canRequest: boolean; cooldownRemainingMs: number; status?: string }>;
  /** Notificación en pantalla de solicitud directa entrante */
  inAppNotification: { title: string; message: string; requestId?: string } | null;
  clearInAppNotification: () => void;
}

let cleanupListeners: (() => void)[] = [];
let initDirectStorePromise: Promise<void> | null = null;

export const useDirectChatStore = create<DirectChatState>((set, get) => ({
  peers: [],
  requests: [],
  unreadTotal: 0,
  activeDirectPeer: null,
  activeMessages: [],
  isLoading: false,
  isSending: false,
  isInitialized: false,
  inAppNotification: null,
  clearInAppNotification: () => set({ inAppNotification: null }),

  initDirectStore: async () => {
    if (get().isInitialized) return;
    if (initDirectStorePromise) return initDirectStorePromise;

    initDirectStorePromise = (async () => {
      try {
        set({ isLoading: true });

        // Cargar datos locales de IndexedDB
        await get().loadData();

        // Limpiar suscripciones previas si las hubiera
        cleanupListeners.forEach((fn) => fn());
        cleanupListeners = [];

        // Registrar identidad en el relay si hay sesión activa
        const registerWithRelay = async () => {
          const session = useIdentityStore.getState().session;
          if (session) {
            try {
              await registerIdentityNetwork(session.publicKey, session.alias);
            } catch {
              // Reintentará al reconectar
            }
          }
        };
        await registerWithRelay();

    // 1. Oyente de reconexión de red: re-registrar identidad
    cleanupListeners.push(
      onConnectionChange((connected) => {
        if (connected) {
          registerWithRelay();
        }
      })
    );

    // 2. Oyente de solicitudes directas recibidas
    cleanupListeners.push(
      onDirectRequestReceived(async (payload: SendDirectRequestPayload) => {
        const mySession = useIdentityStore.getState().session;
        if (!mySession || payload.toPublicKey !== mySession.publicKey) return;

        const newReq: DirectRequest = {
          id: payload.id,
          peerPublicKey: payload.fromPublicKey,
          peerAlias: payload.fromAlias,
          direction: "incoming",
          status: "pending",
          introMessage: payload.introMessage,
          sourceForumName: payload.sourceForumName,
          e2eePublicKey: payload.e2eePublicKey,
          createdAt: payload.createdAt || Date.now(),
        };

        // Si ya teníamos una solicitud previa de este mismo par, eliminarla para refrescar
        await db.directRequests.where("peerPublicKey").equals(payload.fromPublicKey).delete();
        await saveDirectRequest(newReq);
        await get().loadData();

        // Notificación visual en pantalla (toast interactivo)
        set({
          inAppNotification: {
            title: "Nueva solicitud de contacto",
            message: `${payload.fromAlias} te ha enviado una solicitud de chat directo.`,
            requestId: payload.id,
          },
        });
      })
    );

    // 3. Oyente de solicitud aceptada por el par
    cleanupListeners.push(
      onDirectRequestAccepted(async (payload: RespondDirectRequestPayload) => {
        const mySession = useIdentityStore.getState().session;
        if (!mySession || payload.toPublicKey !== mySession.publicKey) return;

        if (payload.e2eePublicKey) {
          const channelId = getDirectChannelId(mySession.publicKey, payload.fromPublicKey);
          await saveDirectPeer({
            peerPublicKey: payload.fromPublicKey,
            alias: payload.peerAlias || "Contacto",
            channelId,
            e2eePublicKey: payload.e2eePublicKey,
            createdAt: Date.now(),
            lastInteractionTs: Date.now(),
            unreadCount: 0,
          });
        }

        // Una vez aceptada, desaparece de la lista de solicitudes
        await db.directRequests.delete(payload.requestId);
        await get().loadData();
      })
    );

    // 4. Oyente de solicitud rechazada por el par (cooldown asimétrico de 24h)
    cleanupListeners.push(
      onDirectRequestRejected(async (payload: RespondDirectRequestPayload) => {
        const mySession = useIdentityStore.getState().session;
        if (!mySession || payload.toPublicKey !== mySession.publicKey) return;

        const cooldownUntil = Date.now() + DIRECT_REQUEST_COOLDOWN_MS;
        await updateDirectRequestStatus(payload.requestId, "rejected", cooldownUntil);
        await get().loadData();
      })
    );

    // 5. Oyente de mensajes directos cifrados recibidos
    cleanupListeners.push(
      onDirectMsgReceived(async (payload: DirectMsgPayload) => {
        const mySession = useIdentityStore.getState().session;
        if (!mySession || payload.toPublicKey !== mySession.publicKey) return;

        const peer = await getDirectPeer(payload.fromPublicKey);
        if (!peer) {
          // Si aún no lo tenemos guardado como contacto, no se puede descifrar de forma segura
          return;
        }

        try {
          const myKeyPair = await getOrCreatePersistentE2EEKeyPair();
          const sharedKey = await deriveDirectSharedKey(myKeyPair.privateKey, peer.e2eePublicKey);
          const plaintext = await decryptMessage(payload.ciphertext, payload.nonce, sharedKey);

          // Si el alias del par cambió, actualizarlo automáticamente
          if (payload.fromAlias && payload.fromAlias !== peer.alias) {
            await updateDirectPeerAlias(peer.peerPublicKey, payload.fromAlias);
          }

          const directMsg: DirectMessage = {
            id: payload.id,
            channelId: payload.channelId,
            fromPublicKey: payload.fromPublicKey,
            toPublicKey: payload.toPublicKey,
            fromAlias: payload.fromAlias,
            content: plaintext,
            clientTs: payload.clientTs,
            isOutgoing: false,
          };

          await saveDirectMessage(directMsg);

          // Si el chat con este par está abierto actualmente en pantalla
          const currentActive = get().activeDirectPeer;
          if (currentActive && currentActive.peerPublicKey === peer.peerPublicKey) {
            set((state) => {
              if (state.activeMessages.some((m) => m.id === directMsg.id)) {
                return state;
              }
              return {
                activeMessages: [...state.activeMessages, directMsg],
              };
            });
            await markDirectChatAsRead(peer.channelId);
          }

          await get().loadData();
        } catch (err) {
          console.error("[directChatStore] Error al descifrar mensaje directo:", err);
        }
      })
    );

    // 6. Oyente de eliminación o renovación de identidad del par
    cleanupListeners.push(
      onDirectPeerDeleted(async ({ peerPublicKey }) => {
        // En lugar de borrar silenciosamente el chat, marcamos al par como inactivo/eliminado
        // para notificar al usuario con advertencia clara y recomendarle borrar el chat
        await markDirectPeerAsDeleted(peerPublicKey);
        await get().loadData();
        if (get().activeDirectPeer?.peerPublicKey === peerPublicKey) {
          const updated = await getDirectPeer(peerPublicKey);
          if (updated) set({ activeDirectPeer: updated });
        }
      })
    );

        set({ isInitialized: true, isLoading: false });
      } finally {
        initDirectStorePromise = null;
      }
    })();

    return initDirectStorePromise;
  },

  loadData: async () => {
    const peers = await getDirectPeers();
    const requests = await getDirectRequests();
    const unreadTotal = peers.reduce((acc, p) => acc + (p.unreadCount || 0), 0);
    set({ peers, requests, unreadTotal });
  },

  checkCooldown: async (peerPublicKey: string) => {
    return await checkRequestCooldown(peerPublicKey);
  },

  sendRequest: async (toPublicKey, toAlias, introMessage, sourceForumName, allowResend = false) => {
    const session = useIdentityStore.getState().session;
    if (!session) {
      return { ok: false, error: "Debes inicializar tu identidad" };
    }
    if (session.publicKey === toPublicKey) {
      return { ok: false, error: "No puedes solicitarte a ti mismo" };
    }

    if (get().peers.length >= MAX_DIRECT_PEERS_PER_CLIENT) {
      return {
        ok: false,
        error: `Has alcanzado el límite máximo de ${MAX_DIRECT_PEERS_PER_CLIENT} contactos guardados.`,
      };
    }

    // Verificar cooldown previo
    const cooldownInfo = await checkRequestCooldown(toPublicKey);
    if (!cooldownInfo.canRequest) {
      if (cooldownInfo.status === "accepted") {
        return { ok: false, error: "Ya es un contacto guardado" };
      }
      if (cooldownInfo.status === "pending" && !allowResend) {
        return { ok: false, error: "Ya tienes una solicitud pendiente con este usuario" };
      }
      if (cooldownInfo.status === "rejected") {
        const hoursLeft = Math.ceil(cooldownInfo.cooldownRemainingMs / (1000 * 60 * 60));
        return {
          ok: false,
          error: `Solicitud rechazada. Podrás reintentar en ${hoursLeft} hora(s)`,
        };
      }
    }

    // Si ya existía solicitud saliente pendiente y permitimos reenvío, limpiar la anterior
    const oldReq = await getDirectRequestForPeer(toPublicKey);
    if (oldReq && oldReq.direction === "outgoing") {
      await db.directRequests.delete(oldReq.id);
    }

    set({ isSending: true });
    try {
      const myKeyPair = await getOrCreatePersistentE2EEKeyPair();
      const requestId = "req_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);

      const payload: SendDirectRequestPayload = {
        id: requestId,
        fromPublicKey: session.publicKey,
        fromAlias: session.alias,
        toPublicKey,
        introMessage: introMessage?.trim() || undefined,
        sourceForumName: sourceForumName?.trim() || undefined,
        e2eePublicKey: myKeyPair.publicKey,
        createdAt: Date.now(),
      };

      await sendDirectRequestNetwork(payload);

      // Guardar solicitud saliente localmente
      const directReq: DirectRequest = {
        id: requestId,
        peerPublicKey: toPublicKey,
        peerAlias: toAlias,
        direction: "outgoing",
        status: "pending",
        introMessage: payload.introMessage,
        sourceForumName: payload.sourceForumName,
        e2eePublicKey: myKeyPair.publicKey,
        createdAt: payload.createdAt,
      };
      await saveDirectRequest(directReq);
      await get().loadData();

      set({ isSending: false });
      return { ok: true };
    } catch (err) {
      set({ isSending: false });
      const errorMsg = err instanceof Error ? err.message : "Error al enviar la solicitud";
      return { ok: false, error: errorMsg };
    }
  },

  respondRequest: async (requestId, action) => {
    const session = useIdentityStore.getState().session;
    if (!session) return { ok: false, error: "Sesión no disponible" };

    const req = get().requests.find((r) => r.id === requestId);
    if (!req) return { ok: false, error: "Solicitud no encontrada" };

    set({ isSending: true });
    try {
      let myE2eePubKey: string | undefined;
      if (action === "accept") {
        const myKeyPair = await getOrCreatePersistentE2EEKeyPair();
        myE2eePubKey = myKeyPair.publicKey;
      }

      const resPayload: RespondDirectRequestPayload = {
        requestId,
        action,
        fromPublicKey: session.publicKey,
        toPublicKey: req.peerPublicKey,
        peerAlias: session.alias,
        e2eePublicKey: myE2eePubKey,
      };

      await respondDirectRequestNetwork(resPayload);

      if (action === "accept") {
        if (get().peers.length >= MAX_DIRECT_PEERS_PER_CLIENT) {
          set({ isSending: false });
          return {
            ok: false,
            error: `Has alcanzado el límite de contactos (${MAX_DIRECT_PEERS_PER_CLIENT}). Elimina alguno para aceptar.`,
          };
        }

        const channelId = getDirectChannelId(session.publicKey, req.peerPublicKey);
        await saveDirectPeer({
          peerPublicKey: req.peerPublicKey,
          alias: req.peerAlias,
          channelId,
          e2eePublicKey: req.e2eePublicKey,
          createdAt: Date.now(),
          lastInteractionTs: Date.now(),
          unreadCount: 0,
        });

        // Una vez aceptada, desaparece de la lista de solicitudes
        await db.directRequests.delete(requestId);
      } else {
        // Rechazada: el receptor que rechaza NO entra en cooldown (regla asimétrica)
        await updateDirectRequestStatus(requestId, "rejected");
      }

      await get().loadData();
      set({ isSending: false });
      return { ok: true };
    } catch (err) {
      set({ isSending: false });
      const errorMsg = err instanceof Error ? err.message : "Error al responder solicitud";
      return { ok: false, error: errorMsg };
    }
  },

  openDirectChat: async (peerPublicKey) => {
    const peer = await getDirectPeer(peerPublicKey);
    if (!peer) return;

    const messages = await getDirectMessages(peer.channelId);
    await markDirectChatAsRead(peer.channelId);

    set({
      activeDirectPeer: peer,
      activeMessages: messages,
    });
    await get().loadData();
  },

  closeDirectChat: () => {
    set({ activeDirectPeer: null, activeMessages: [] });
  },

  sendMessage: async (content: string) => {
    const activePeer = get().activeDirectPeer;
    const session = useIdentityStore.getState().session;
    if (!activePeer || !session || !content.trim()) return false;
    if (activePeer.isDeletedByPeer) return false;

    set({ isSending: true });
    try {
      const myKeyPair = await getOrCreatePersistentE2EEKeyPair();
      const sharedKey = await deriveDirectSharedKey(myKeyPair.privateKey, activePeer.e2eePublicKey);
      const { ciphertext, nonce } = await encryptMessage(content.trim(), sharedKey);

      const msgId = "dmsg_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
      const now = Date.now();

      const payload: DirectMsgPayload = {
        id: msgId,
        channelId: activePeer.channelId,
        toPublicKey: activePeer.peerPublicKey,
        fromPublicKey: session.publicKey,
        fromAlias: session.alias,
        ciphertext,
        nonce,
        clientTs: now,
      };

      // Enviar por red
      await sendDirectMsgNetwork(payload);

      // Guardar localmente
      const localMsg: DirectMessage = {
        id: msgId,
        channelId: activePeer.channelId,
        fromPublicKey: session.publicKey,
        toPublicKey: activePeer.peerPublicKey,
        fromAlias: session.alias,
        content: content.trim(),
        clientTs: now,
        isOutgoing: true,
      };

      await saveDirectMessage(localMsg);

      set((state) => ({
        activeMessages: [...state.activeMessages, localMsg],
        isSending: false,
      }));

      await get().loadData();
      return true;
    } catch (err) {
      console.error("[directChatStore] Error al enviar mensaje directo:", err);
      set({ isSending: false });
      return false;
    }
  },

  deletePeer: async (peerPublicKey: string) => {
    const session = useIdentityStore.getState().session;
    if (session) {
      deleteDirectPeerNetwork({
        fromPublicKey: session.publicKey,
        toPublicKey: peerPublicKey,
      }).catch(() => {});
    }
    await deleteDirectPeerAndMessages(peerPublicKey);
    if (get().activeDirectPeer?.peerPublicKey === peerPublicKey) {
      get().closeDirectChat();
    }
    await get().loadData();
  },

  cancelRequest: async (requestId: string) => {
    const req = get().requests.find((r) => r.id === requestId);
    await deleteDirectRequest(requestId);
    if (req && req.direction === "outgoing") {
      cancelDirectRequestNetwork({ requestId, toPublicKey: req.peerPublicKey }).catch(() => {});
    }
    await get().loadData();
  },
}));
