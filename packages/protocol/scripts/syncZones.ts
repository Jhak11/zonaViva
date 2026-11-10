/**
 * syncZones.ts
 * 
 * Sincroniza zones.ts con zones.json
 * Regenera el código TypeScript estático desde el JSON
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const zonesJsonPath = join(__dirname, "../zones/zones.json");
const zonesTsPath = join(__dirname, "../src/zones.ts");

interface Zone {
  id: string;
  name: string;
  description: string;
  type: string;
  cells: string[];
  color?: string;
}

interface ZoneCatalog {
  version: number;
  gridPrecision: number;
  pilotBounds: [[number, number], [number, number]];
  zones: Zone[];
}

console.log("🔄 Sincronizando zones.ts desde zones.json...");

// Leer zones.json
const catalog = JSON.parse(readFileSync(zonesJsonPath, "utf-8")) as ZoneCatalog;

// Generar código TypeScript
const code = `// ──────────────────────────────────────────────────────────────────────
//  Catálogo de zonas – Definido estáticamente desde zones.json
//  Identificadores (id) son ESTABLES: no cambiarán entre versiones.
//
//  NOTA: Este archivo se regenera automáticamente con el script syncZones.ts
//        No editar manualmente - los cambios se perderán.
// ──────────────────────────────────────────────────────────────────────
import type { Zone } from "./types.js";

export const ZONES: Zone[] = ${JSON.stringify(catalog.zones, null, 2)};

/** Mapa rápido por ID para búsquedas O(1) */
export const ZONES_BY_ID: Record<string, Zone> = Object.fromEntries(
  ZONES.map((z) => [z.id, z])
);
`;

// Escribir zones.ts
writeFileSync(zonesTsPath, code, "utf-8");

console.log(`✅ zones.ts actualizado (${catalog.zones.length} zonas)`);
