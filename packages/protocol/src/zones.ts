// ──────────────────────────────────────────────────────────────────────
//  Catálogo de zonas – Iteración 1 piloto: Puno, Perú
//  Identificadores (id) son ESTABLES: no cambiarán entre versiones.
// ──────────────────────────────────────────────────────────────────────
import type { Zone } from "./types.js";

export const ZONES: Zone[] = [
  {
    id: "puno-centro",
    name: "Centro de Puno",
    description: "Plaza Mayor, Catedral, jirón Lima y alrededores del centro histórico",
    type: "circle",
    center: { lat: -15.8402, lng: -70.0219 },
    radiusMeters: 700,
    mapCenter: { lat: -15.8402, lng: -70.0219 },
    mapZoom: 15,
  },
  {
    id: "puno-puerto",
    name: "Puerto y Lago Titicaca",
    description: "Muelle turístico, embarcadero y orilla del lago Titicaca",
    type: "circle",
    center: { lat: -15.8453, lng: -70.0134 },
    radiusMeters: 600,
    mapCenter: { lat: -15.8453, lng: -70.0134 },
    mapZoom: 15,
  },
  {
    id: "puno-mercado",
    name: "Mercado Central",
    description: "Mercado Central de Puno y zona comercial aledaña",
    type: "circle",
    center: { lat: -15.8368, lng: -70.0198 },
    radiusMeters: 500,
    mapCenter: { lat: -15.8368, lng: -70.0198 },
    mapZoom: 16,
  },
  {
    id: "puno-laureles",
    name: "Jirón Los Laureles (Pruebas)",
    description: "Zona permanente en Jr. Los Laureles para pruebas de proximidad y desarrollo",
    type: "circle",
    center: { lat: -15.8260, lng: -70.0150 },
    radiusMeters: 400,
    mapCenter: { lat: -15.8260, lng: -70.0150 },
    mapZoom: 16,
  },
];

/** Mapa rápido por ID para búsquedas O(1) */
export const ZONES_BY_ID: Record<string, Zone> = Object.fromEntries(
  ZONES.map((z) => [z.id, z])
);
