#!/usr/bin/env tsx
import ngeohash from "ngeohash";

// Zonas originales con círculos
const zones = [
  {
    id: "puno-centro",
    center: { lat: -15.8402, lng: -70.0219 },
    radiusMeters: 700,
  },
  {
    id: "puno-puerto",
    center: { lat: -15.8453, lng: -70.0134 },
    radiusMeters: 600,
  },
  {
    id: "puno-mercado",
    center: { lat: -15.8368, lng: -70.0198 },
    radiusMeters: 500,
  },
  {
    id: "puno-laureles",
    center: { lat: -15.8672, lng: -70.0094 },
    radiusMeters: 400,
  },
];

function cellsTouchingCircle(
  centerLat: number,
  centerLng: number,
  radiusMeters: number,
  precision: number
): string[] {
  // Aproximación: 1 grado ≈ 111km
  const latOffset = radiusMeters / 111000;
  const lngOffset = radiusMeters / (111000 * Math.cos((centerLat * Math.PI) / 180));

  const minLat = centerLat - latOffset;
  const minLng = centerLng - lngOffset;
  const maxLat = centerLat + latOffset;
  const maxLng = centerLng + lngOffset;

  const candidateHashes = ngeohash.bboxes(minLat, minLng, maxLat, maxLng, precision);
  
  const touchedCells: string[] = [];
  const seen = new Set<string>();

  for (const hash of candidateHashes) {
    if (seen.has(hash)) continue;
    seen.add(hash);

    const bbox = ngeohash.decode_bbox(hash);
    const [bMinLat, bMinLng, bMaxLat, bMaxLng] = bbox;

    // Punto del rect más cercano al centro
    const closestLat = Math.max(bMinLat, Math.min(bMaxLat, centerLat));
    const closestLng = Math.max(bMinLng, Math.min(bMaxLng, centerLng));

    // Distancia Haversine simplificada
    const φ1 = (centerLat * Math.PI) / 180;
    const φ2 = (closestLat * Math.PI) / 180;
    const Δφ = ((closestLat - centerLat) * Math.PI) / 180;
    const Δλ = ((closestLng - centerLng) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const dist = 6371000 * c;

    if (dist <= radiusMeters) {
      touchedCells.push(hash);
    }
  }

  return touchedCells;
}

for (const zone of zones) {
  const cells = cellsTouchingCircle(
    zone.center.lat,
    zone.center.lng,
    zone.radiusMeters,
    7
  );
  console.log(`\n"${zone.id}": [`);
  cells.forEach((cell, idx) => {
    const comma = idx < cells.length - 1 ? "," : "";
    console.log(`  "${cell}"${comma}`);
  });
  console.log(`]`);
}
