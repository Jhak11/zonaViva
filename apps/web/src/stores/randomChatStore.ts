// ──────────────────────────────────────────────────────────────────────
//  Store de Chat Aleatorio Efímero (E2EE)
//  Estado estrictamente en memoria (RAM) - Cero persistencia en disco/IndexedDB.
//  Al salir, cerrar o recargar la pestaña, todas las claves y mensajes se destruyen.
// ──────────────────────────────────────────────────────────────────────
import { create } from "zustand";
import { ulid } from "ulid";
import {
  generateEphemeralKeyPair,
  exportPublicKey,
  importPublicKey,
  deriveSharedKey,
  computeVerificationCode,
  encryptMessage,
  decryptMessage,
} from "@/modules/e2ee";
import {
  queueChat,
  cancelQueue,
  sendChatMessage,
  leaveChat as networkLeaveChat,
  onMatched,
  onChatMsg,
  onPeerLeft,
  onQueueTimeout,
  onQueueCancelled,
  joinChatLobby,
  leaveChatLobby,
  onChatScopeActive,
} from "@/modules/network";

export type ChatStatus = "idle" | "searching" | "matched" | "ended";

export interface EphemeralChatMessage {
  id: string;
  sender: "me" | "peer";
  text: string;
  ts: number;
}

interface RandomChatState {
  status: ChatStatus;
  zoneId: string | null;
  roomId: string | null;
  keyPair: CryptoKeyPair | null;
  myPublicKeyB64: string | null;
  peerPublicKeyB64: string | null;
  aesKey: CryptoKey | null;
  securityCode: string | null;
  messages: EphemeralChatMessage[];
  errorMessage: string | null;
  listenersAttached: boolean;
  activeScopes: Set<string>;

  // Acciones
  initListeners: () => void;
  enterLobby: () => Promise<void>;
  leaveLobby: () => void;
  startSearch: (zoneId: string) => Promise<void>;
  cancelSearch: () => void;
  sendMessage: (text: string) => Promise<boolean>;
  leaveChat: () => void;
  nextChat: () => Promise<void>;
  reset: () => void;
}

export const useRandomChatStore = create<RandomChatState>((set, get) => ({
  status: "idle",
  zoneId: null,
  roomId: null,
  keyPair: null,
  myPublicKeyB64: null,
  peerPublicKeyB64: null,
  aesKey: null,
  securityCode: null,
  messages: [],
  errorMessage: null,
  listenersAttached: false,
  activeScopes: new Set<string>(),

  enterLobby: async () => {
    get().initListeners();
    try {
      const scopes = await joinChatLobby();
      set({ activeScopes: new Set(scopes) });
    } catch {
      // Ignorar
    }
  },

  leaveLobby: () => {
    leaveChatLobby();
  },

  initListeners: () => {
    if (get().listenersAttached) return;

    onMatched(async ({ roomId, peerPublicKey }) => {
      try {
        const { keyPair, myPublicKeyB64 } = get();
        if (!keyPair || !myPublicKeyB64) {
          console.error("[ChatStore] Claves locales no disponibles al recibir matched");
          return;
        }

        const peerKey = await importPublicKey(peerPublicKey);
        const aesKey = await deriveSharedKey(keyPair.privateKey, peerKey);
        const securityCode = await computeVerificationCode(myPublicKeyB64, peerPublicKey);

        set({
          status: "matched",
          roomId,
          peerPublicKeyB64: peerPublicKey,
          aesKey,
          securityCode,
          errorMessage: null,
          messages: [],
        });
      } catch (err) {
        console.error("[ChatStore] Error al establecer túnel cifrado:", err);
        set({
          status: "idle",
          errorMessage: "Error al establecer conexión segura con el interlocutor.",
        });
      }
    });

    onChatMsg(async ({ roomId, ciphertext, nonce }) => {
      const { roomId: currentRoomId, aesKey, messages } = get();
      if (roomId !== currentRoomId || !aesKey) return;

      try {
        const plaintext = await decryptMessage(ciphertext, nonce, aesKey);
        const incomingMsg: EphemeralChatMessage = {
          id: ulid(),
          sender: "peer",
          text: plaintext,
          ts: Date.now(),
        };

        set({ messages: [...messages, incomingMsg] });
      } catch (err) {
        console.error("[ChatStore] Error al descifrar mensaje entrante:", err);
      }
    });

    onPeerLeft(({ roomId }) => {
      const { roomId: currentRoomId } = get();
      if (roomId === currentRoomId) {
        set({
          status: "ended",
          aesKey: null, // Destruir clave de cifrado
        });
      }
    });

    onQueueTimeout(() => {
      set({
        status: "idle",
        errorMessage: "No hay nadie disponible ahora en esta zona. Intenta más tarde o selecciona otra zona.",
      });
    });

    onQueueCancelled(() => {
      set({
        status: "idle",
        errorMessage: null,
      });
    });

    onChatScopeActive(({ scopeId, active }) => {
      const current = new Set(get().activeScopes);
      if (active) {
        current.add(scopeId);
      } else {
        current.delete(scopeId);
      }
      set({ activeScopes: current });
    });

    set({ listenersAttached: true });
  },

  startSearch: async (zoneId: string) => {
    get().initListeners();

    try {
      // 1. Limpiar estado previo
      set({
        status: "searching",
        zoneId,
        roomId: null,
        keyPair: null,
        myPublicKeyB64: null,
        peerPublicKeyB64: null,
        aesKey: null,
        securityCode: null,
        messages: [],
        errorMessage: null,
      });

      // 2. Generar nuevo par de claves efímeras para esta sesión
      const keyPair = await generateEphemeralKeyPair();
      const myPublicKeyB64 = await exportPublicKey(keyPair.publicKey);

      set({ keyPair, myPublicKeyB64 });

      // 3. Registrarse en la cola de emparejamiento del relay
      const res = await queueChat(zoneId, myPublicKeyB64);
      if (!res.ok) {
        set({
          status: "idle",
          errorMessage: res.error || "No se pudo conectar a la sala de espera.",
        });
      }
    } catch (err) {
      console.error("[ChatStore] Error al iniciar búsqueda:", err);
      set({
        status: "idle",
        errorMessage: "Error criptográfico al iniciar la sesión.",
      });
    }
  },

  cancelSearch: () => {
    cancelQueue();
    get().reset();
  },

  sendMessage: async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return false;

    const { status, roomId, aesKey, messages } = get();
    if (status !== "matched" || !roomId || !aesKey) return false;

    try {
      const { ciphertext, nonce } = await encryptMessage(trimmed, aesKey);
      sendChatMessage(roomId, ciphertext, nonce);

      const myMsg: EphemeralChatMessage = {
        id: ulid(),
        sender: "me",
        text: trimmed,
        ts: Date.now(),
      };

      set({ messages: [...messages, myMsg] });
      return true;
    } catch (err) {
      console.error("[ChatStore] Error al cifrar mensaje saliente:", err);
      return false;
    }
  },

  leaveChat: () => {
    const { roomId } = get();
    if (roomId) {
      networkLeaveChat(roomId);
    }
    get().reset();
  },

  nextChat: async () => {
    const { roomId, zoneId } = get();
    if (roomId) {
      networkLeaveChat(roomId);
    }
    const currentZone = zoneId ?? "plaza-mayor";
    await get().startSearch(currentZone);
  },

  reset: () => {
    set({
      status: "idle",
      zoneId: null,
      roomId: null,
      keyPair: null,
      myPublicKeyB64: null,
      peerPublicKeyB64: null,
      aesKey: null,
      securityCode: null,
      messages: [],
      errorMessage: null,
    });
  },
}));
