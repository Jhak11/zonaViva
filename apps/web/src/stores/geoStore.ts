// ──────────────────────────────────────────────────────────────────────
//  Store de geolocalización y zona actual
// ──────────────────────────────────────────────────────────────────────
import { create } from "zustand";
import type { Zone } from "@zonaviva/protocol";
import { 
  startWatchingPosition, 
  stopWatchingPosition, 
  getLocationServiceStatus,
  requestLocationPermission,
  type LocationServiceStatus 
} from "@/geo/locationService";
import { 
  getAccessibleZones, 
  getUserCells,
  canPublishInZoneForum,
  type UserPosition 
} from "@/geo/accessPolicy";
import { decodeGeohash } from "@/geo/geoCore";
import { getZoneCenter } from "@/geo/zoneCatalog";

export type GeoPermission = "granted" | "denied" | "prompt" | "unavailable";
export type AccuracyLevel = "good" | "acceptable" | "poor";

interface GeoState {
  /** Permiso del navegador */
  permission: GeoPermission;
  /** Estado del servicio de ubicación */
  status: LocationServiceStatus;
  /** Posición actual del usuario con precisión y timestamp */
  userPosition: UserPosition | null;
  /** Celdas que toca el círculo de precisión del usuario */
  userCells: string[];
  /** Zonas detectadas (donde el usuario puede publicar) */
  detectedZones: Zone[];
  /** Zona seleccionada manualmente para explorar */
  manualZone: Zone | null;
  /** Zona simulada para pruebas locales de desarrollo */
  simulatedZone: Zone | null;
  /** Coordenadas simuladas personalizadas (ej. foros temporales circulares) */
  simulatedCoordinates: { latitude: number; longitude: number; name?: string } | null;
  /** Mensaje de error descriptivo */
  error: string | null;
  /** Modo "Centrar en mí" (el mapa sigue la posición del usuario) */
  followUserPosition: boolean;

  /** Inicia el watch de GPS */
  startWatching: () => void;
  /** Para el watch */
  stopWatching: () => void;
  /** Solicita explícitamente permisos de geolocalización al navegador */
  requestPermission: () => Promise<boolean>;
  /** Seleccionar zona manualmente (modo exploración) */
  setManualZone: (zone: Zone | null) => void;
  /** Simular ubicación GPS en una zona para pruebas de proximidad */
  setSimulatedZone: (zone: Zone | null) => void;
  /** Simular coordenadas GPS específicas (para foros de usuario u otras ubicaciones) */
  setSimulatedCoordinates: (coords: { latitude: number; longitude: number; name?: string } | null) => void;
  /** Quitar cualquier simulación activa y reactivar GPS real */
  clearSimulation: () => void;
  /** Comprueba si el modo simulación está actualmente activo */
  isSimulating: () => boolean;
  /** Activar/desactivar modo "Centrar en mí" */
  setFollowUserPosition: (follow: boolean) => void;
  /** Alternar modo "Centrar en mí" */
  toggleFollowUser: () => void;
  /** Centrar en la posición del usuario */
  centerOnUser: () => void;
  /** Zona efectiva: simulada si existe, si no manual, si no la detectada */
  effectiveZone: () => Zone | null;
  /** Consulta si el usuario puede publicar en una zona específica */
  canPublishInZone: (zoneId: string) => boolean;
  /** Obtiene el nivel de precisión cualitativo */
  getAccuracyLevel: () => AccuracyLevel | null;
}

export const useGeoStore = create<GeoState>((set, get) => ({
  permission: "prompt",
  status: "inactive",
  userPosition: null,
  userCells: [],
  detectedZones: [],
  manualZone: null,
  simulatedZone: null,
  simulatedCoordinates: null,
  error: null,
  followUserPosition: false,

  startWatching: () => {
    // Si hay una simulación activa, no iniciar GPS real que la sobreescriba
    if (get().simulatedZone || get().simulatedCoordinates) {
      set({
        permission: "granted",
        status: "active",
        error: null,
      });
      return;
    }

    startWatchingPosition(
      (position) => {
        // Si se activó una simulación mientras llegaba la actualización, ignorar
        if (get().simulatedZone || get().simulatedCoordinates) return;

        // Calcular celdas y zonas desde la nueva posición
        const cells = getUserCells(position);
        const zones = getAccessibleZones(position);
        
        set({
          status: getLocationServiceStatus(),
          permission: "granted",
          userPosition: position,
          userCells: cells,
          detectedZones: zones,
          error: null,
        });
      },
      (error) => {
        if (get().simulatedZone || get().simulatedCoordinates) return;

        const status = getLocationServiceStatus();
        
        let errorMessage = "Error al obtener ubicación";
        if (error.code === error.PERMISSION_DENIED) {
          set({ permission: "denied" });
          errorMessage = "Permiso de ubicación denegado";
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          errorMessage = "Ubicación no disponible";
        } else if (error.code === error.TIMEOUT) {
          errorMessage = "Timeout al obtener ubicación";
        }
        
        set({ 
          status,
          error: errorMessage
        });
      }
    );
  },

  stopWatching: () => {
    stopWatchingPosition();
    set({ 
      status: "inactive",
      userPosition: null,
      userCells: [],
      detectedZones: [],
      error: null
    });
  },

  requestPermission: async () => {
    // Si hay simulación, quitarla primero para volver a GPS real
    if (get().simulatedZone || get().simulatedCoordinates) {
      get().clearSimulation();
    }
    stopWatchingPosition();
    set({ status: "requesting" });
    try {
      const granted = await requestLocationPermission();
      if (granted) {
        set({ permission: "granted", status: "active", error: null });
        get().startWatching();
        return true;
      } else {
        set({ permission: "denied", status: "denied", error: "Permiso de ubicación denegado en el navegador." });
        return false;
      }
    } catch {
      set({ status: "error", error: "Error al solicitar permiso de ubicación." });
      return false;
    }
  },

  setManualZone: (zone) => {
    set({ manualZone: zone });
  },

  setSimulatedZone: (zone) => {
    if (zone) {
      // Detener el watch real de GPS para que no sobreescriba las coordenadas simuladas
      stopWatchingPosition();

      // Centro geográfico de la zona
      let simulatedPosition: UserPosition | null = null;
      const center = getZoneCenter(zone);
      if (center) {
        simulatedPosition = {
          latitude: center[0],
          longitude: center[1],
          accuracy: 15,
          timestamp: Date.now(),
        };
      } else if (zone.cells && zone.cells.length > 0) {
        const decoded = decodeGeohash(zone.cells[0]);
        simulatedPosition = {
          latitude: decoded.latitude,
          longitude: decoded.longitude,
          accuracy: 15,
          timestamp: Date.now(),
        };
      }

      set({
        simulatedZone: zone,
        simulatedCoordinates: null,
        manualZone: null,
        detectedZones: [zone],
        userPosition: simulatedPosition,
        userCells: zone.cells ? [...zone.cells] : [],
        permission: "granted",
        status: "active",
        error: null,
      });
    } else {
      get().clearSimulation();
    }
  },

  setSimulatedCoordinates: (coords) => {
    if (coords) {
      stopWatchingPosition();

      const simulatedPosition: UserPosition = {
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: 15,
        timestamp: Date.now(),
      };
      const cells = getUserCells(simulatedPosition);
      const zones = getAccessibleZones(simulatedPosition);

      set({
        simulatedCoordinates: coords,
        simulatedZone: zones[0] ?? null,
        manualZone: null,
        detectedZones: zones,
        userPosition: simulatedPosition,
        userCells: cells,
        permission: "granted",
        status: "active",
        error: null,
      });
    } else {
      get().clearSimulation();
    }
  },

  clearSimulation: () => {
    set({
      simulatedZone: null,
      simulatedCoordinates: null,
      manualZone: null,
      userPosition: null,
      userCells: [],
      detectedZones: [],
    });
    get().startWatching();
  },

  isSimulating: () => {
    const { simulatedZone, simulatedCoordinates } = get();
    return Boolean(simulatedZone || simulatedCoordinates);
  },

  setFollowUserPosition: (follow) => {
    set({ followUserPosition: follow });
  },

  toggleFollowUser: () => {
    set((state) => ({ followUserPosition: !state.followUserPosition }));
  },

  centerOnUser: () => {
    set({ followUserPosition: true });
  },

  effectiveZone: () => {
    const { simulatedZone, manualZone, detectedZones } = get();
    return simulatedZone ?? manualZone ?? detectedZones[0] ?? null;
  },

  canPublishInZone: (zoneId: string) => {
    const { simulatedZone, userPosition } = get();
    if (simulatedZone?.id === zoneId) return true;
    return canPublishInZoneForum(userPosition, zoneId).canPublish;
  },

  getAccuracyLevel: () => {
    const { userPosition } = get();
    if (!userPosition) return null;
    if (userPosition.accuracy < 100) return "good";
    if (userPosition.accuracy <= 300) return "acceptable";
    return "poor";
  },
}));
