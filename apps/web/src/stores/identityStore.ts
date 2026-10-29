// ──────────────────────────────────────────────────────────────────────
//  Store de identidad temporal (alias + claves de sesión ECDSA P-256)
//  Persistido en localStorage hasta renovación manual.
// ──────────────────────────────────────────────────────────────────────
import { create } from "zustand";
import type { LocalSession } from "@zonaviva/protocol";
import { generateSession, exportSession, importSession } from "@/modules/identity";

const STORAGE_KEY = "zonaviva:session";

interface IdentityState {
  session: LocalSession | null;
  isLoading: boolean;
  /** Carga la sesión guardada o crea una nueva */
  initSession: () => Promise<void>;
  /** Renueva el alias y las claves (borra la sesión anterior) */
  renewSession: () => Promise<void>;
  /** Cambia solo el alias visible */
  setAlias: (alias: string) => void;
}

export const useIdentityStore = create<IdentityState>((set, get) => ({
  session: null,
  isLoading: false,

  initSession: async () => {
    set({ isLoading: true });
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const stored = JSON.parse(raw) as LocalSession;
        // Re-importar claves para validar integridad
        const session = await importSession(stored);
        set({ session, isLoading: false });
        return;
      }
    } catch {
      // Sesión corrupta → generar nueva
      localStorage.removeItem(STORAGE_KEY);
    }

    const session = await generateSession();
    const exported = await exportSession(session);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(exported));
    set({ session: exported, isLoading: false });
  },

  renewSession: async () => {
    set({ isLoading: true });
    localStorage.removeItem(STORAGE_KEY);
    const session = await generateSession();
    const exported = await exportSession(session);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(exported));
    set({ session: exported, isLoading: false });
  },

  setAlias: (alias: string) => {
    const current = get().session;
    if (!current) return;
    const updated = { ...current, alias };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    set({ session: updated });
  },
}));
