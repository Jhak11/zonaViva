// ──────────────────────────────────────────────────────────────────────
//  Store de identidad temporal (alias + claves de sesión ECDSA P-256)
//  Persistido en localStorage con bandera explícita de onboarding.
// ──────────────────────────────────────────────────────────────────────
import { create } from "zustand";
import type { LocalSession } from "@zonaviva/protocol";
import { generateSession, importSession } from "@/modules/identity";

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
        const stored = JSON.parse(raw) as LocalSession;
        const validSession = await importSession(stored);
        set({
          session: validSession,
          isOnboardingCompleted: true,
          isReady: true,
          isLoading: false,
        });
        return;
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSession));
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
      const newSession = await generateSession();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSession));
      set({ session: newSession, isLoading: false });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  setAlias: (alias: string) => {
    const current = get().session;
    if (!current) return;
    const updated = { ...current, alias };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    set({ session: updated });
  },
}));
