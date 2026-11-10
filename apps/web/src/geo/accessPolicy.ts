/**
 * accessPolicy.ts
 * 
 * Reglas de acceso a foros basadas en geolocalización.
 * Decide si un usuario puede leer o publicar en una zona.
 */

import { GRID_PRECISION, MAX_ACCEPTABLE_ACCURACY, MAX_POSITION_AGE } from '@zonaviva/protocol';
import { cellsTouchingCircle, calculateEffectiveRadius } from './geoCore';
import { getZonesByCells, getZoneIdByCell, type Zone } from './zoneCatalog';

/** Posición del usuario con precisión y timestamp */
export interface UserPosition {
  latitude: number;
  longitude: number;
  accuracy: number;      // metros
  timestamp: number;     // Date.now()
}

/** Resultado de verificación de acceso */
export interface AccessCheck {
  canPublish: boolean;
  reason?: string;
  detectedZones: Zone[];
  touchedCells: string[];
}

/**
 * Verifica si una posición es suficientemente fresca.
 * @param position - Posición del usuario
 * @returns true si la posición es reciente (< MAX_POSITION_AGE)
 */
export function isPositionFresh(position: UserPosition): boolean {
  const age = Date.now() - position.timestamp;
  return age < MAX_POSITION_AGE;
}

/**
 * Verifica si una posición tiene precisión aceptable.
 * @param position - Posición del usuario
 * @returns true si accuracy <= MAX_ACCEPTABLE_ACCURACY
 */
export function isPositionAccurate(position: UserPosition): boolean {
  return position.accuracy <= MAX_ACCEPTABLE_ACCURACY;
}

/**
 * Calcula las celdas que toca el círculo de precisión del usuario.
 * @param position - Posición del usuario
 * @returns Array de celdas (geohash)
 */
export function getUserCells(position: UserPosition): string[] {
  const radius = calculateEffectiveRadius(position.accuracy);
  return cellsTouchingCircle(
    position.latitude,
    position.longitude,
    radius,
    GRID_PRECISION
  );
}

/**
 * Obtiene las zonas que el usuario puede acceder desde su posición.
 * @param position - Posición del usuario
 * @returns Array de zonas accesibles
 */
export function getAccessibleZones(position: UserPosition): Zone[] {
  const cells = getUserCells(position);
  return getZonesByCells(cells);
}

/**
 * Verifica si el usuario puede publicar en una zona específica.
 * 
 * Reglas:
 * - La posición debe ser fresca (< MAX_POSITION_AGE)
 * - La posición debe ser precisa (<= MAX_ACCEPTABLE_ACCURACY)
 * - El círculo de precisión del usuario debe tocar al menos una celda de la zona
 * 
 * @param position - Posición del usuario
 * @param zoneId - ID de la zona donde quiere publicar
 * @returns Resultado de la verificación
 */
export function canPublishInZoneForum(
  position: UserPosition | null,
  zoneId: string
): AccessCheck {
  // Sin posición → no puede publicar
  if (!position) {
    return {
      canPublish: false,
      reason: 'No se ha obtenido la ubicación',
      detectedZones: [],
      touchedCells: []
    };
  }

  // Posición antigua → no puede publicar
  if (!isPositionFresh(position)) {
    return {
      canPublish: false,
      reason: 'La ubicación no está actualizada',
      detectedZones: [],
      touchedCells: []
    };
  }

  // Precisión insuficiente → no puede publicar
  if (!isPositionAccurate(position)) {
    return {
      canPublish: false,
      reason: `Precisión insuficiente (${Math.round(position.accuracy)}m)`,
      detectedZones: [],
      touchedCells: []
    };
  }

  // Calcular celdas que toca el círculo del usuario
  const cells = getUserCells(position);
  
  // Verificar si alguna de esas celdas pertenece a la zona objetivo
  const inZone = cells.some((cell) => getZoneIdByCell(cell) === zoneId);
  
  if (!inZone) {
    const accessibleZones = getZonesByCells(cells);
    return {
      canPublish: false,
      reason: 'No estás en esta zona',
      detectedZones: accessibleZones,
      touchedCells: cells
    };
  }

  // Todo OK → puede publicar
  const accessibleZones = getZonesByCells(cells);
  return {
    canPublish: true,
    detectedZones: accessibleZones,
    touchedCells: cells
  };
}

/**
 * Obtiene un mensaje descriptivo del estado de ubicación.
 * @param position - Posición del usuario
 * @returns Mensaje descriptivo
 */
export function getLocationStatusMessage(position: UserPosition | null): string {
  if (!position) {
    return 'Ubicación no disponible';
  }
  
  if (!isPositionFresh(position)) {
    const ageSeconds = Math.round((Date.now() - position.timestamp) / 1000);
    return `Ubicación desactualizada (${ageSeconds}s)`;
  }
  
  if (!isPositionAccurate(position)) {
    return `Precisión baja (±${Math.round(position.accuracy)}m)`;
  }
  
  return `Ubicación activa (±${Math.round(position.accuracy)}m)`;
}
