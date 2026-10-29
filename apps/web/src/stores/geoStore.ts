// ──────────────────────────────────────────────────────────────────────
//  Store de geolocalización y zona actual
// ──────────────────────────────────────────────────────────────────────
import { create } from "zustand";
import type { Zone } from "@zonaviva/protocol";
import { detectZone } from "@/modules/geo";

export type GeoPermission = "granted" | "denied" | "prompt" | "unavailable";
export type GeoStatus =
  | "idle"
  | "requesting"
  | "watching"
  | "error"
  | "unavailable";

interface GeoState {
  /** Permiso del navegador */
  permission: GeoPermission;
  /** Estado interno del watcher */
  status: GeoStatus;
  /** Zona detectada por GPS (null si fuera de todas las zonas) */
  currentZone: Zone | null;
  /** Zona seleccionada manualmente para explorar (sobrescribe currentZone en lectura) */
  manualZone: Zone | null;
  /** Mensaje de error descriptivo */
  error: string | null;
  /** ID del watchPosition para poder limpiar */
  watchId: number | null;

  /** Inicia el watch de GPS */
  startWatching: () => void;
  /** Para el watch */
  stopWatching: () => void;
  /** Seleccionar zona manualmente (modo exploración) */
  setManualZone: (zone: Zone | null) => void;
  /** Zona efectiva: manual si está definida, si no la del GPS */
  effectiveZone: () => Zone | null;
}

export const useGeoStore = create<GeoState>((set, get) => ({
  permission: "prompt",
  status: "idle",
  currentZone: null,
  manualZone: null,
  error: null,
  watchId: null,

  startWatching: () => {
    if (!navigator.geolocation) {
      set({ permission: "unavailable", status: "unavailable" });
      return;
    }

    set({ status: "requesting" });

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const zone = detectZone(latitude, longitude);
        set({
          status: "watching",
          permission: "granted",
          currentZone: zone,
          error: null,
        });
      },
      (err) => {
        if (err.code === GeolocationPositionError.PERMISSION_DENIED) {
          set({ permission: "denied", status: "error", error: "Permiso de ubicación denegado." });
        } else {
          set({ status: "error", error: "No se pudo obtener la ubicación." });
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15_000,
        maximumAge: 30_000,
      }
    );

    set({ watchId });
  },

  stopWatching: () => {
    const { watchId } = get();
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
    }
    set({ watchId: null, status: "idle" });
  },

  setManualZone: (zone) => {
    set({ manualZone: zone });
  },

  effectiveZone: () => {
    const { manualZone, currentZone } = get();
    return manualZone ?? currentZone;
  },
}));
