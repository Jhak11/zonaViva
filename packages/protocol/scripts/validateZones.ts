#!/usr/bin/env tsx
// ──────────────────────────────────────────────────────────────────────
//  Script de validación del catálogo de zonas
//  Verifica integridad: sin celdas duplicadas, IDs únicos, formato correcto
// ──────────────────────────────────────────────────────────────────────
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ngeohash from "ngeohash";
import { GRID_PRECISION } from "../src/constants.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface Zone {
  id: string;
  name: string;
  description: string;
  type: "permanent";
  cells: string[];
  color?: string;
}

interface ZoneCatalog {
  version: number;
  gridPrecision: number;
  pilotBounds: [[number, number], [number, number]];
  zones: Zone[];
}

const ZONES_FILE = path.join(__dirname, "../zones/zones.json");

/**
 * Obtiene los 8 vecinos geográficos de una celda
 */
function getNeighbors(geohash: string): string[] {
  try {
    return [
      ngeohash.neighbor(geohash, [0, 1]),
      ngeohash.neighbor(geohash, [0, -1]),
      ngeohash.neighbor(geohash, [1, 0]),
      ngeohash.neighbor(geohash, [-1, 0]),
      ngeohash.neighbor(geohash, [1, 1]),
      ngeohash.neighbor(geohash, [-1, 1]),
      ngeohash.neighbor(geohash, [1, -1]),
      ngeohash.neighbor(geohash, [-1, -1]),
    ];
  } catch {
    return [];
  }
}

/**
 * Encuentra componentes conexos (para verificar regla de cero islas)
 */
function getConnectedComponents(cells: string[]): string[][] {
  const cellSet = new Set(cells);
  const visited = new Set<string>();
  const components: string[][] = [];

  for (const cell of cells) {
    if (visited.has(cell)) continue;
    const component: string[] = [];
    const queue = [cell];
    visited.add(cell);

    while (queue.length > 0) {
      const current = queue.shift()!;
      component.push(current);
      const neighbors = getNeighbors(current);

      for (const neighbor of neighbors) {
        if (cellSet.has(neighbor) && !visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }

    components.push(component);
  }

  return components;
}

/**
 * Valida el formato de un ID de zona (slug)
 */
function isValidZoneId(id: string): boolean {
  return /^[a-z0-9-]+$/.test(id) && id.length >= 3 && id.length <= 64;
}

/**
 * Valida el formato de una celda geohash
 */
function isValidCell(cell: string, precision: number): boolean {
  return /^[0-9b-hjkmnp-z]+$/.test(cell) && cell.length === precision;
}

/**
 * Verifica si una coordenada está dentro de los bounds del piloto
 */
function isWithinBounds(
  lat: number,
  lng: number,
  bounds: [[number, number], [number, number]]
): boolean {
  const [[minLat, minLng], [maxLat, maxLng]] = bounds;
  return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
}

/**
 * Decodifica un geohash a coordenadas (implementación simple)
 */
function decodeGeohashSimple(geohash: string): { lat: number; lng: number } {
  // Implementación simplificada para validación
  // En producción se usa ngeohash
  const base32 = "0123456789bcdefghjkmnpqrstuvwxyz";
  let evenBit = true;
  let latMin = -90, latMax = 90;
  let lngMin = -180, lngMax = 180;

  for (const char of geohash) {
    const idx = base32.indexOf(char);
    if (idx === -1) throw new Error(`Carácter inválido en geohash: ${char}`);

    for (let i = 4; i >= 0; i--) {
      const bit = (idx >> i) & 1;
      if (evenBit) {
        // Longitud
        const lngMid = (lngMin + lngMax) / 2;
        if (bit === 1) {
          lngMin = lngMid;
        } else {
          lngMax = lngMid;
        }
      } else {
        // Latitud
        const latMid = (latMin + latMax) / 2;
        if (bit === 1) {
          latMin = latMid;
        } else {
          latMax = latMid;
        }
      }
      evenBit = !evenBit;
    }
  }

  return {
    lat: (latMin + latMax) / 2,
    lng: (lngMin + lngMax) / 2,
  };
}

async function validateCatalog(): Promise<void> {
  console.log("🔍 Validando catálogo de zonas...\n");

  // 1. Verificar que el archivo existe
  try {
    await fs.access(ZONES_FILE);
  } catch {
    console.error(`❌ Error: No se encuentra el archivo ${ZONES_FILE}`);
    process.exit(1);
  }

  // 2. Leer y parsear el JSON
  let catalog: ZoneCatalog;
  try {
    const content = await fs.readFile(ZONES_FILE, "utf-8");
    catalog = JSON.parse(content);
  } catch (error) {
    console.error(`❌ Error al leer o parsear zones.json:`);
    console.error(error);
    process.exit(1);
  }

  let hasErrors = false;
  const errors: string[] = [];
  const warnings: string[] = [];

  // 3. Validar estructura básica
  if (!catalog.version || typeof catalog.version !== "number") {
    errors.push("El campo 'version' es obligatorio y debe ser un número");
  }

  if (catalog.gridPrecision !== GRID_PRECISION) {
    errors.push(
      `gridPrecision debe ser ${GRID_PRECISION}, encontrado: ${catalog.gridPrecision}`
    );
  }

  if (!catalog.pilotBounds || catalog.pilotBounds.length !== 2) {
    errors.push("pilotBounds debe tener formato [[minLat, minLng], [maxLat, maxLng]]");
  }

  if (!Array.isArray(catalog.zones)) {
    errors.push("El campo 'zones' debe ser un array");
    console.error("\n❌ Errores críticos:");
    errors.forEach((err) => console.error(`   • ${err}`));
    process.exit(1);
  }

  // 4. Validar zonas individuales
  const zoneIds = new Set<string>();
  const allCells = new Map<string, string>(); // cell → zoneId

  for (const zone of catalog.zones) {
    const zoneLabel = `Zona '${zone.id}'`;

    // Validar ID
    if (!isValidZoneId(zone.id)) {
      errors.push(`${zoneLabel}: ID inválido (debe ser slug: a-z, 0-9, guiones)`);
    }

    if (zoneIds.has(zone.id)) {
      errors.push(`${zoneLabel}: ID duplicado`);
    }
    zoneIds.add(zone.id);

    // Validar nombre
    if (!zone.name || typeof zone.name !== "string") {
      errors.push(`${zoneLabel}: 'name' es obligatorio`);
    }

    // Validar descripción
    if (!zone.description || typeof zone.description !== "string") {
      warnings.push(`${zoneLabel}: 'description' debería estar presente`);
    }

    // Validar tipo
    if (zone.type !== "permanent") {
      errors.push(`${zoneLabel}: 'type' debe ser 'permanent'`);
    }

    // Validar color
    if (zone.color && !/^#[0-9a-fA-F]{6}$/.test(zone.color)) {
      warnings.push(`${zoneLabel}: 'color' debe ser un código hexadecimal válido (ej: #f97316)`);
    }

    // Validar celdas
    if (!Array.isArray(zone.cells) || zone.cells.length === 0) {
      errors.push(`${zoneLabel}: debe tener al menos una celda`);
      continue;
    }

    // Validar conexidad topológica (REGLA ESTRICTA: CERO ISLAS)
    const components = getConnectedComponents(zone.cells);
    if (components.length > 1) {
      errors.push(
        `${zoneLabel}: tiene ${components.length} partes desconectadas (islas). Toda zona debe ser un único grafo contiguo.`
      );
    }

    for (const cell of zone.cells) {
      // Validar formato de celda
      if (!isValidCell(cell, catalog.gridPrecision)) {
        errors.push(
          `${zoneLabel}: celda '${cell}' inválida (debe tener ${catalog.gridPrecision} caracteres geohash válidos)`
        );
        continue;
      }

      // Verificar duplicados entre zonas (NO PERMITIDOS)
      if (allCells.has(cell)) {
        errors.push(
          `${zoneLabel}: celda '${cell}' ya pertenece a la zona '${allCells.get(cell)}'. Cada celda debe pertenecer a una sola zona.`
        );
      } else {
        allCells.set(cell, zone.id);
      }

      // Verificar que la celda está dentro de pilotBounds
      try {
        const coords = decodeGeohashSimple(cell);
        if (!isWithinBounds(coords.lat, coords.lng, catalog.pilotBounds)) {
          warnings.push(
            `${zoneLabel}: celda '${cell}' está fuera de pilotBounds (lat: ${coords.lat.toFixed(4)}, lng: ${coords.lng.toFixed(4)})`
          );
        }
      } catch (error) {
        errors.push(`${zoneLabel}: no se pudo decodificar celda '${cell}'`);
      }
    }
  }

  // 5. Reportar resultados
  console.log(`✓ Versión del catálogo: ${catalog.version}`);
  console.log(`✓ Precisión de grilla: ${catalog.gridPrecision}`);
  console.log(`✓ Zonas definidas: ${catalog.zones.length}`);
  console.log(`✓ Total de celdas: ${allCells.size}\n`);

  if (warnings.length > 0) {
    console.log("⚠️  Advertencias:");
    warnings.forEach((warn) => console.log(`   • ${warn}`));
    console.log();
  }

  if (errors.length > 0) {
    hasErrors = true;
    console.error("❌ Errores encontrados:");
    errors.forEach((err) => console.error(`   • ${err}`));
    console.log();
  }

  if (hasErrors) {
    console.error("❌ Validación FALLIDA. Corrige los errores antes de continuar.\n");
    process.exit(1);
  } else {
    console.log("✅ Validación EXITOSA. El catálogo de zonas es válido.\n");
    process.exit(0);
  }
}

// Ejecutar validación
validateCatalog().catch((error) => {
  console.error("❌ Error inesperado durante la validación:");
  console.error(error);
  process.exit(1);
});
