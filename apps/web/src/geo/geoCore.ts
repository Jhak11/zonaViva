// ──────────────────────────────────────────────────────────────────────
//  Núcleo de geolocalización: funciones puras
//  NO accede a APIs del navegador, solo cálculos matemáticos.
// ──────────────────────────────────────────────────────────────────────
import ngeohash from "ngeohash";
import {
  USER_CIRCLE_MIN_RADIUS,
  USER_CIRCLE_MAX_RADIUS,
  GRID_PRECISION,
} from "@zonaviva/protocol";

/**
 * Radio de la Tierra en metros (aproximación esférica)
 */
const EARTH_RADIUS_METERS = 6371000;

/**
 * Conversión de grados a radianes
 */
function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Convierte coordenadas a geohash de precisión específica
 * @param lat Latitud en grados decimales
 * @param lng Longitud en grados decimales
 * @param precision Precisión del geohash (número de caracteres)
 * @returns Geohash como string
 */
export function coordinatesToGeohash(
  lat: number,
  lng: number,
  precision: number
): string {
  return ngeohash.encode(lat, lng, precision);
}

/**
 * Decodifica un geohash a coordenadas centrales y bbox
 * @param geohash Geohash como string
 * @returns Objeto con latitud, longitud y bbox
 */
export function decodeGeohash(geohash: string): {
  latitude: number;
  longitude: number;
  bbox: [number, number, number, number]; // [minLat, minLng, maxLat, maxLng]
} {
  const decoded = ngeohash.decode(geohash);
  const bbox = ngeohash.decode_bbox(geohash);
  
  return {
    latitude: decoded.latitude,
    longitude: decoded.longitude,
    bbox: [bbox[0], bbox[1], bbox[2], bbox[3]],
  };
}

/**
 * Calcula la distancia entre dos puntos usando la fórmula de Haversine
 * @param lat1 Latitud del punto 1
 * @param lng1 Longitud del punto 1
 * @param lat2 Latitud del punto 2
 * @param lng2 Longitud del punto 2
 * @returns Distancia en metros
 */
export function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const φ1 = toRadians(lat1);
  const φ2 = toRadians(lat2);
  const Δφ = toRadians(lat2 - lat1);
  const Δλ = toRadians(lng2 - lng1);

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

/**
 * Calcula la distancia de un punto a un rectángulo (aproximación plana, válida a escala local)
 * Si el punto está dentro del rectángulo, devuelve 0
 * @param pointLat Latitud del punto
 * @param pointLng Longitud del punto
 * @param rectBbox Bbox del rectángulo [minLat, minLng, maxLat, maxLng]
 * @returns Distancia en metros
 */
export function distanceToRect(
  pointLat: number,
  pointLng: number,
  rectBbox: [number, number, number, number]
): number {
  const [minLat, minLng, maxLat, maxLng] = rectBbox;

  // Si el punto está dentro del rectángulo, distancia = 0
  if (
    pointLat >= minLat &&
    pointLat <= maxLat &&
    pointLng >= minLng &&
    pointLng <= maxLng
  ) {
    return 0;
  }

  // Calcular punto más cercano del rectángulo
  const closestLat = Math.max(minLat, Math.min(maxLat, pointLat));
  const closestLng = Math.max(minLng, Math.min(maxLng, pointLng));

  return distanceMeters(pointLat, pointLng, closestLat, closestLng);
}

/**
 * Calcula el radio efectivo del círculo de precisión basado en la accuracy del GPS
 * Clamp entre USER_CIRCLE_MIN_RADIUS y USER_CIRCLE_MAX_RADIUS
 * @param accuracy Precisión del GPS en metros
 * @returns Radio efectivo en metros
 */
export function calculateEffectiveRadius(accuracy: number): number {
  return Math.max(
    USER_CIRCLE_MIN_RADIUS,
    Math.min(USER_CIRCLE_MAX_RADIUS, accuracy)
  );
}

/**
 * Obtiene el rectángulo que envuelve un círculo
 * Aproximación: 1 grado de latitud ≈ 111km, 1 grado de longitud ≈ 111km * cos(lat)
 * @param centerLat Latitud del centro
 * @param centerLng Longitud del centro
 * @param radiusMeters Radio del círculo en metros
 * @returns Bbox [minLat, minLng, maxLat, maxLng]
 */
function getBoundingBox(
  centerLat: number,
  centerLng: number,
  radiusMeters: number
): [number, number, number, number] {
  const latOffset = radiusMeters / 111000; // 1 grado ≈ 111km
  const lngOffset = radiusMeters / (111000 * Math.cos(toRadians(centerLat)));

  return [
    centerLat - latOffset, // minLat
    centerLng - lngOffset, // minLng
    centerLat + latOffset, // maxLat
    centerLng + lngOffset, // maxLng
  ];
}

/**
 * Obtiene todas las celdas geohash que toca un círculo
 * Algoritmo:
 * 1. Calcula el bbox que envuelve al círculo
 * 2. Obtiene todos los geohashes candidatos dentro del bbox
 * 3. Filtra solo los que intersectan realmente el círculo
 * 
 * @param centerLat Latitud del centro del círculo
 * @param centerLng Longitud del centro del círculo
 * @param radiusMeters Radio del círculo en metros
 * @param precision Precisión del geohash (por defecto GRID_PRECISION = 7)
 * @returns Array de geohashes que toca el círculo
 */
export function cellsTouchingCircle(
  centerLat: number,
  centerLng: number,
  radiusMeters: number,
  precision: number = GRID_PRECISION
): string[] {
  const bbox = getBoundingBox(centerLat, centerLng, radiusMeters);
  const [minLat, minLng, maxLat, maxLng] = bbox;

  // Usar ngeohash.bboxes para obtener todos los geohashes en el área
  const candidateHashes = ngeohash.bboxes(minLat, minLng, maxLat, maxLng, precision);

  // Filtrar solo los que realmente intersectan el círculo
  const touchedCells: string[] = [];
  const seen = new Set<string>();

  for (const hash of candidateHashes) {
    if (seen.has(hash)) continue;
    seen.add(hash);

    const decoded = decodeGeohash(hash);
    const dist = distanceToRect(centerLat, centerLng, decoded.bbox);

    // Si la distancia del centro del círculo al rectángulo es <= radio, intersectan
    if (dist <= radiusMeters) {
      touchedCells.push(hash);
    }
  }

  return touchedCells;
}

/**
 * Obtiene las 8 celdas vecinas de un geohash (para Iteración 5: descubrir foros cercanos)
 * Incluye: N, S, E, W, NE, NW, SE, SW
 * @param geohash Geohash central
 * @returns Array de 8 geohashes vecinos
 */
export function getNeighborGeohashes(geohash: string): string[] {
  const neighbors: string[] = [];

  try {
    neighbors.push(ngeohash.neighbor(geohash, [0, 1]));  // N
    neighbors.push(ngeohash.neighbor(geohash, [0, -1])); // S
    neighbors.push(ngeohash.neighbor(geohash, [1, 0]));  // E
    neighbors.push(ngeohash.neighbor(geohash, [-1, 0])); // W
    neighbors.push(ngeohash.neighbor(geohash, [1, 1]));  // NE
    neighbors.push(ngeohash.neighbor(geohash, [-1, 1])); // NW
    neighbors.push(ngeohash.neighbor(geohash, [1, -1])); // SE
    neighbors.push(ngeohash.neighbor(geohash, [-1, -1])); // SW
  } catch (error) {
    // En los bordes del mundo, algunos vecinos pueden no existir
    console.warn("Error calculando vecinos de geohash:", error);
  }

  return neighbors;
}

/**
 * Valida si un geohash tiene la precisión esperada
 * @param geohash Geohash a validar
 * @param expectedPrecision Precisión esperada
 * @returns true si es válido
 */
export function isValidGeohash(geohash: string, expectedPrecision?: number): boolean {
  if (!geohash || typeof geohash !== "string") return false;
  
  const valid = /^[0-9b-hjkmnp-z]+$/.test(geohash);
  
  if (expectedPrecision !== undefined) {
    return valid && geohash.length === expectedPrecision;
  }
  
  return valid;
}

/**
 * Calcula el área aproximada de una celda geohash en metros cuadrados
 * Útil para mostrar al usuario el tamaño de su zona
 * @param precision Precisión del geohash
 * @returns Área aproximada en m²
 */
export function geohashCellArea(precision: number): number {
  // Valores aproximados según la especificación de geohash
  const areas: Record<number, number> = {
    1: 5_000_000_000_000, // ±2500 km
    2: 625_000_000_000,   // ±630 km
    3: 78_000_000_000,    // ±78 km
    4: 9_800_000_000,     // ±20 km
    5: 1_200_000_000,     // ±5 km
    6: 156_000_000,       // ±1.2 km
    7: 19_500_000,        // ±153 m
    8: 2_400_000,         // ±38 m
    9: 305_000,           // ±10 m
  };

  return areas[precision] ?? 0;
}

/**
 * Formatea un área en m² a texto legible
 * @param areaM2 Área en metros cuadrados
 * @returns String formateado (ej: "1.2 km²" o "150 m²")
 */
export function formatArea(areaM2: number): string {
  if (areaM2 >= 1_000_000) {
    return `${(areaM2 / 1_000_000).toFixed(1)} km²`;
  }
  return `${Math.round(areaM2)} m²`;
}
