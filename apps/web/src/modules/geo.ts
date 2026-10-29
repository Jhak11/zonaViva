// ──────────────────────────────────────────────────────────────────────
//  Módulo de geolocalización y zonas
//  La comprobación punto-en-zona ocurre LOCALMENTE en el dispositivo.
//  Nunca se envían coordenadas exactas al relay.
// ──────────────────────────────────────────────────────────────────────
import type { Zone } from "@zonaviva/protocol";
import { ZONES } from "@zonaviva/protocol";

// ── Geometría ─────────────────────────────────────────────────────────

/** Distancia en metros entre dos puntos (Haversine) */
export function haversineMeters(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6_371_000; // radio de la Tierra en metros
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Ray-casting: comprueba si un punto está dentro de un polígono */
export function pointInPolygon(
  lat: number,
  lng: number,
  polygon: Array<{ lat: number; lng: number }>
): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng, yi = polygon[i].lat;
    const xj = polygon[j].lng, yj = polygon[j].lat;
    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// ── Detección de zona ─────────────────────────────────────────────────

/**
 * Detecta la zona más cercana y adecuada que contiene las coordenadas dadas.
 * Si el punto cae en la intersección de varias zonas, selecciona la más próxima a su centro.
 * Comprobación puramente local: NO se envía nada al servidor.
 * @returns Zone o null si no está en ninguna zona.
 */
export function detectZone(lat: number, lng: number): Zone | null {
  let closestZone: Zone | null = null;
  let minDistance = Infinity;

  for (const zone of ZONES) {
    if (zone.type === "circle" && zone.center && zone.radiusMeters) {
      const dist = haversineMeters(lat, lng, zone.center.lat, zone.center.lng);
      if (dist <= zone.radiusMeters && dist < minDistance) {
        minDistance = dist;
        closestZone = zone;
      }
    } else if (zone.type === "polygon" && zone.polygon) {
      if (pointInPolygon(lat, lng, zone.polygon)) {
        const dist = haversineMeters(lat, lng, zone.mapCenter.lat, zone.mapCenter.lng);
        if (dist < minDistance) {
          minDistance = dist;
          closestZone = zone;
        }
      }
    }
  }
  return closestZone;
}

/**
 * Devuelve true si las coordenadas están dentro de una zona concreta.
 */
export function isInZone(lat: number, lng: number, zone: Zone): boolean {
  if (zone.type === "circle" && zone.center && zone.radiusMeters) {
    return haversineMeters(lat, lng, zone.center.lat, zone.center.lng) <= zone.radiusMeters;
  }
  if (zone.type === "polygon" && zone.polygon) {
    return pointInPolygon(lat, lng, zone.polygon);
  }
  return false;
}

/** Devuelve todas las zonas disponibles en el catálogo */
export function getAllZones(): Zone[] {
  return ZONES;
}
