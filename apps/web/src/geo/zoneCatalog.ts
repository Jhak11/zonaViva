/**
 * zoneCatalog.ts
 * 
 * Carga y gestiona el catálogo de zonas permanentes.
 * Construye un índice para búsqueda rápida celda → zona.
 */

import type { Zone } from '@zonaviva/protocol';
import zonesData from '@zonaviva/protocol/zones/zones.json';
import zonesIndex from '@zonaviva/protocol/zones/zones.index.json';
import { decodeGeohash } from './geoCore';

/** Catálogo completo de zonas */
export interface ZoneCatalog {
  version: number;
  gridPrecision: number;
  pilotBounds: [[number, number], [number, number]];
  zones: Zone[];
}

/** Índice celda → zoneId */
export type ZoneIndex = Record<string, string>;

// Re-exportar el tipo Zone desde protocol para conveniencia
export type { Zone };

// ── Singleton: catálogo y índice ─────────────────────────────────────

let catalogCache: ZoneCatalog | null = null;
let indexCache: ZoneIndex | null = null;

/**
 * Obtiene el catálogo completo de zonas.
 * Se carga una sola vez (singleton).
 */
export function getCatalog(): ZoneCatalog {
  if (!catalogCache) {
    catalogCache = zonesData as ZoneCatalog;
  }
  return catalogCache;
}

/**
 * Obtiene el índice celda → zoneId.
 * Se carga una sola vez (singleton).
 */
export function getZoneIndex(): ZoneIndex {
  if (!indexCache) {
    indexCache = zonesIndex as ZoneIndex;
  }
  return indexCache;
}

/**
 * Obtiene el ID de zona al que pertenece una celda.
 * @param geohash - Celda (geohash de precisión 7)
 * @returns ID de zona o undefined si la celda no pertenece a ninguna zona
 */
export function getZoneIdByCell(geohash: string): string | undefined {
  const index = getZoneIndex();
  return index[geohash];
}

/**
 * Obtiene los detalles de una zona por su ID.
 * @param zoneId - ID de la zona
 * @returns Zona o undefined si no existe
 */
export function getZoneById(zoneId: string): Zone | undefined {
  const catalog = getCatalog();
  return catalog.zones.find((z) => z.id === zoneId);
}

/**
 * Obtiene todas las zonas permanentes.
 * @returns Array de zonas
 */
export function getAllZones(): Zone[] {
  const catalog = getCatalog();
  return catalog.zones;
}

/**
 * Obtiene las zonas a las que pertenecen un conjunto de celdas.
 * @param geohashes - Array de celdas (geohash)
 * @returns Array de zonas únicas (sin duplicados)
 */
export function getZonesByCells(geohashes: string[]): Zone[] {
  const zoneIds = new Set<string>();
  
  for (const cell of geohashes) {
    const zoneId = getZoneIdByCell(cell);
    if (zoneId) {
      zoneIds.add(zoneId);
    }
  }
  
  return Array.from(zoneIds)
    .map((id) => getZoneById(id))
    .filter((z): z is Zone => z !== undefined);
}

/**
 * Verifica si una celda pertenece a alguna zona.
 * @param geohash - Celda (geohash de precisión 7)
 * @returns true si la celda está asignada a una zona
 */
export function isCellInZone(geohash: string): boolean {
  return getZoneIdByCell(geohash) !== undefined;
}

/**
 * Obtiene información de los límites del área piloto.
 * @returns Bounds [[minLat, minLng], [maxLat, maxLng]]
 */
export function getPilotBounds(): [[number, number], [number, number]] {
  const catalog = getCatalog();
  return catalog.pilotBounds;
}

/**
 * Verifica si unas coordenadas están dentro del área piloto.
 * @param lat - Latitud
 * @param lng - Longitud
 * @returns true si está dentro del área piloto
 */
export function isInPilotArea(lat: number, lng: number): boolean {
  const [[minLat, minLng], [maxLat, maxLng]] = getPilotBounds();
  return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
}

/**
 * Calcula la caja envolvente (Bounding Box) de una zona a partir de sus celdas geohash
 */
export function getZoneBoundingBox(zone: Zone): [[number, number], [number, number]] | null {
  if (!zone.cells || zone.cells.length === 0) return null;
  let minLat = Infinity;
  let minLng = Infinity;
  let maxLat = -Infinity;
  let maxLng = -Infinity;

  for (const cell of zone.cells) {
    const { bbox } = decodeGeohash(cell);
    if (bbox[0] < minLat) minLat = bbox[0];
    if (bbox[1] < minLng) minLng = bbox[1];
    if (bbox[2] > maxLat) maxLat = bbox[2];
    if (bbox[3] > maxLng) maxLng = bbox[3];
  }

  return [
    [minLat, minLng],
    [maxLat, maxLng],
  ];
}

/**
 * Calcula el centro geográfico aproximado de una zona a partir de sus celdas
 */
export function getZoneCenter(zone: Zone): [number, number] | null {
  const bbox = getZoneBoundingBox(zone);
  if (!bbox) return null;
  return [(bbox[0][0] + bbox[1][0]) / 2, (bbox[0][1] + bbox[1][1]) / 2];
}
