// ──────────────────────────────────────────────────────────────────────
//  Store de identidad temporal (alias + claves de sesión ECDSA P-256)
//  Persistido en localStorage con bandera explícita de onboarding.
// ──────────────────────────────────────────────────────────────────────
import { create } from "zustand";
import type { LocalSession } from "@zonaviva/protocol";
import { generateSession, importSession } from "@/modules/identity";
import { registerIdentityNetwork } from "@/modules/network";
import { resetPersistentE2EEKeyPair } from "@/modules/e2ee";
import { clearAllLocalData } from "@/db/storage";

const STORAGE_KEY = "zonaviva:session";
const ONBOARDING_KEY = "zonaviva:onboarding_completed";

interface IdentityState {
  session: LocalSession | null;
  isOnboardingCompleted: boolean;
  isReady: boolean;
  isLoading: boolean;

  /** Carga la sesión guardada si existe y valida si el onboarding ya se completó */
  initSession: () => Promise<void>;
  /** Completa el onboarding, guarda el alias elegido y crea la sesión */
  completeOnboarding: (chosenAlias: string) => Promise<void>;
  /** Renueva el alias y las claves (nueva identidad temporal) */
  renewSession: () => Promise<void>;
  /** Cambia solo el alias visible */
  setAlias: (alias: string) => void;
}

export const useIdentityStore = create<IdentityState>((set, get) => ({
  session: null,
  isOnboardingCompleted: false,
  isReady: false,
  isLoading: false,

  initSession: async () => {
    set({ isLoading: true });
    try {
      const isCompleted = localStorage.getItem(ONBOARDING_KEY) === "true";
      const raw = localStorage.getItem(STORAGE_KEY);

      if (raw && isCompleted) {
        const stored = JSON.parse(raw);
        const { getSecureKey, saveSecureKey } = await import("@/db/storage");

        let privateKey = await getSecureKey<string>("identity_private_key");

        // Migración transparente: Si la clave privada estaba en localStorage (versión anterior),
        // moverla a IndexedDB y purgarla de localStorage para eliminar la superficie de ataque XSS.
        if (!privateKey && stored.privateKey) {
          privateKey = stored.privateKey;
          await saveSecureKey("identity_private_key", privateKey);
          const sanitized = {
            publicKey: stored.publicKey,
            alias: stored.alias,
            createdAt: stored.createdAt,
          };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
        }

        if (stored.publicKey && privateKey) {
          const fullSession: LocalSession = {
            publicKey: stored.publicKey,
            alias: stored.alias,
            privateKey,
            createdAt: stored.createdAt,
          };
          const validSession = await importSession(fullSession);
          set({
            session: validSession,
            isOnboardingCompleted: true,
            isReady: true,
            isLoading: false,
          });
          return;
        }
      }

      // Si no ha completado el onboarding o no hay sesión guardada
      set({
        session: null,
        isOnboardingCompleted: false,
        isReady: true,
        isLoading: false,
      });
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(ONBOARDING_KEY);
      import("@/db/storage").then(({ removeSecureKey }) => {
        removeSecureKey("identity_private_key").catch(() => {});
      });
      set({
        session: null,
        isOnboardingCompleted: false,
        isReady: true,
        isLoading: false,
      });
    }
  },

  completeOnboarding: async (chosenAlias: string) => {
    set({ isLoading: true });
    try {
      const newSession = await generateSession(chosenAlias);
      const { saveSecureKey } = await import("@/db/storage");

      // 1. Guardar la clave privada de identidad exclusivamente en IndexedDB (no expuesta a XSS síncrono)
      await saveSecureKey("identity_private_key", newSession.privateKey);

      // 2. Guardar en localStorage únicamente la identidad pública
      const publicSession = {
        publicKey: newSession.publicKey,
        alias: newSession.alias,
        createdAt: newSession.createdAt,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(publicSession));
      localStorage.setItem(ONBOARDING_KEY, "true");

      set({
        session: newSession,
        isOnboardingCompleted: true,
        isReady: true,
        isLoading: false,
      });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  renewSession: async () => {
    set({ isLoading: true });
    try {
      // 0. Notificar a los contactos existentes que esta identidad se destruye
      const currentSession = get().session;
      if (currentSession) {
        try {
          const { getDirectPeers } = await import("@/db/storage");
          const { deleteDirectPeerNetwork } = await import("@/modules/network");
          const currentPeers = await getDirectPeers();
          for (const p of currentPeers) {
            deleteDirectPeerNetwork({
              fromPublicKey: currentSession.publicKey,
              toPublicKey: p.peerPublicKey,
            }).catch(() => {});
          }
        } catch {
          // Ignorar fallo de notificación previa
        }
      }

      const newSession = await generateSession();
      const { saveSecureKey } = await import("@/db/storage");

      // 1. Limpiar clave persistente E2EE (ECDH para chats directos)
      resetPersistentE2EEKeyPair();

      // 2. Limpiar todo el historial local en IndexedDB (foros, mensajes, contactos, chats directos, claves viejas)
      await clearAllLocalData();

      // 3. Guardar la nueva clave privada exclusivamente en IndexedDB
      await saveSecureKey("identity_private_key", newSession.privateKey);

      // 4. Guardar únicamente metadatos públicos en localStorage (sin clave privada)
      const publicSession = {
        publicKey: newSession.publicKey,
        alias: newSession.alias,
        createdAt: newSession.createdAt,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(publicSession));

      // 5. Notificar a stores para refrescar su estado en memoria
      const [{ useForumStore }, { useDirectChatStore }] = await Promise.all([
        import("./forumStore"),
        import("./directChatStore"),
      ]);
      useForumStore.getState().refreshMyUserForums().catch(() => {});
      useForumStore.getState().serveAsNode().catch(() => {});
      useDirectChatStore.setState({
        peers: [],
        requests: [],
        unreadTotal: 0,
        activeDirectPeer: null,
        activeMessages: [],
        inAppNotification: null,
      });

      set({ session: newSession, isLoading: false });
      registerIdentityNetwork(newSession.publicKey, newSession.alias).catch(() => {});
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  setAlias: (alias: string) => {
    const current = get().session;
    if (!current) return;
    const updated = { ...current, alias };
    const publicSession = {
      publicKey: updated.publicKey,
      alias: updated.alias,
      createdAt: updated.createdAt,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(publicSession));
    set({ session: updated });
    registerIdentityNetwork(updated.publicKey, alias).catch(() => {});
  },
}));
