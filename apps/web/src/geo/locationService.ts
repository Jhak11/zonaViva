/**
 * locationService.ts
 * 
 * Servicio de geolocalización del navegador.
 * Único punto de acceso a la Geolocation API.
 * Emite actualizaciones solo cuando hay cambio significativo.
 */

import { MIN_MOVEMENT_THRESHOLD } from '@zonaviva/protocol';
import { distanceMeters } from './geoCore';
import type { UserPosition } from './accessPolicy';

/** Callback para actualizaciones de posición */
export type PositionCallback = (position: UserPosition) => void;

/** Callback para errores de geolocalización */
export type ErrorCallback = (error: GeolocationPositionError) => void;

/** Estado del servicio de ubicación */
export type LocationServiceStatus = 
  | 'inactive'        // No se ha iniciado
  | 'requesting'      // Solicitando permiso
  | 'active'          // Activo y funcionando
  | 'denied'          // Permiso denegado
  | 'unavailable'     // API no disponible
  | 'error';          // Error desconocido

interface WatchState {
  watchId: number | null;
  lastPosition: UserPosition | null;
  status: LocationServiceStatus;
  onUpdate: PositionCallback | null;
  onError: ErrorCallback | null;
}

// ── Estado interno ───────────────────────────────────────────────────

const state: WatchState = {
  watchId: null,
  lastPosition: null,
  status: 'inactive',
  onUpdate: null,
  onError: null
};

// ── Helpers internos ─────────────────────────────────────────────────

function hasMovedSignificantly(
  prev: UserPosition,
  curr: GeolocationPosition
): boolean {
  const distance = distanceMeters(
    prev.latitude,
    prev.longitude,
    curr.coords.latitude,
    curr.coords.longitude
  );
  
  return distance >= MIN_MOVEMENT_THRESHOLD;
}

function toUserPosition(position: GeolocationPosition): UserPosition {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy,
    timestamp: position.timestamp
  };
}

// ── API pública ──────────────────────────────────────────────────────

/**
 * Verifica si la API de Geolocation está disponible.
 * @returns true si está disponible
 */
export function isGeolocationAvailable(): boolean {
  return 'geolocation' in navigator;
}

/**
 * Obtiene el estado actual del servicio.
 * @returns Estado actual
 */
export function getLocationServiceStatus(): LocationServiceStatus {
  return state.status;
}

/**
 * Obtiene la última posición conocida.
 * @returns Última posición o null si no hay
 */
export function getLastKnownPosition(): UserPosition | null {
  return state.lastPosition;
}

/**
 * Inicia el seguimiento de ubicación.
 * 
 * Comportamiento:
 * - Solicita permiso la primera vez
 * - Emite actualizaciones solo si el usuario se movió >= MIN_MOVEMENT_THRESHOLD
 * - Mantiene watchPosition activo hasta que se llame a stopWatching()
 * 
 * @param onUpdate - Callback para actualizaciones de posición
 * @param onError - Callback para errores
 */
export function startWatchingPosition(
  onUpdate: PositionCallback,
  onError: ErrorCallback
): void {
  if (!isGeolocationAvailable()) {
    state.status = 'unavailable';
    onError({
      code: 2,
      message: 'API de Geolocation no disponible',
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3
    } as GeolocationPositionError);
    return;
  }

  // Si ya está activo, solo actualizar callbacks
  if (state.watchId !== null) {
    state.onUpdate = onUpdate;
    state.onError = onError;
    return;
  }

  state.status = 'requesting';
  state.onUpdate = onUpdate;
  state.onError = onError;

  // Configuración de watchPosition
  const options: PositionOptions = {
    enableHighAccuracy: true,
    maximumAge: 0,           // Siempre pedir posición fresca
    timeout: 10000           // 10 segundos de timeout
  };

  state.watchId = navigator.geolocation.watchPosition(
    (position) => {
      state.status = 'active';
      
      const newPosition = toUserPosition(position);
      
      // Primera posición → siempre emitir
      if (!state.lastPosition) {
        state.lastPosition = newPosition;
        state.onUpdate?.(newPosition);
        return;
      }
      
      // Posición subsiguiente → emitir solo si hay movimiento significativo
      if (hasMovedSignificantly(state.lastPosition, position)) {
        state.lastPosition = newPosition;
        state.onUpdate?.(newPosition);
      }
      
      // Si no hay movimiento significativo, actualizar timestamp silenciosamente
      // (para mantener la posición fresca)
      state.lastPosition = newPosition;
    },
    (error) => {
      // Mapear errores
      if (error.code === error.PERMISSION_DENIED) {
        state.status = 'denied';
      } else {
        state.status = 'error';
      }
      
      state.onError?.(error);
    },
    options
  );
}

/**
 * Detiene el seguimiento de ubicación.
 */
export function stopWatchingPosition(): void {
  if (state.watchId !== null) {
    navigator.geolocation.clearWatch(state.watchId);
    state.watchId = null;
    state.status = 'inactive';
    state.onUpdate = null;
    state.onError = null;
  }
}

/**
 * Solicita una posición única (sin seguimiento continuo).
 * Útil para verificar permisos sin iniciar watchPosition.
 * 
 * @returns Promise con la posición o error
 */
export function getCurrentPosition(): Promise<UserPosition> {
  return new Promise((resolve, reject) => {
    if (!isGeolocationAvailable()) {
      reject(new Error('API de Geolocation no disponible'));
      return;
    }

    const options: PositionOptions = {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 10000
    };

    navigator.geolocation.getCurrentPosition(
      (position) => resolve(toUserPosition(position)),
      (error) => reject(error),
      options
    );
  });
}

/**
 * Solicita permiso de geolocalización sin iniciar seguimiento.
 * Útil para mostrar un botón "Activar ubicación" antes de watchPosition.
 * 
 * @returns Promise que resuelve true si el permiso fue concedido
 */
export async function requestLocationPermission(): Promise<boolean> {
  try {
    await getCurrentPosition();
    return true;
  } catch (error) {
    if (error instanceof GeolocationPositionError) {
      return error.code !== error.PERMISSION_DENIED;
    }
    return false;
  }
}
