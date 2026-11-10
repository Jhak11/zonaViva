#!/usr/bin/env tsx
// ──────────────────────────────────────────────────────────────────────
//  Script de generación de archivos derivados del catálogo de zonas
//  Genera: zones.index.json y zones.geo.json
// ──────────────────────────────────────────────────────────────────────
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ngeohash from "ngeohash";

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

interface ZoneCatalogIndex {
  [cellGeohash: string]: string; // cellGeohash → zoneId
}

interface GeoJSONFeature {
  type: "Feature";
  properties: {
    id: string;
    name: string;
    description: string;
    color?: string;
  };
  geometry: {
    type: "Polygon";
    coordinates: number[][][]; // [[[lng, lat], ...]]
  };
}

interface GeoJSONFeatureCollection {
  type: "FeatureCollection";
  features: GeoJSONFeature[];
}

const ZONES_DIR = path.join(__dirname, "../zones");
const ZONES_FILE = path.join(ZONES_DIR, "zones.json");
const INDEX_FILE = path.join(ZONES_DIR, "zones.index.json");
const GEOJSON_FILE = path.join(ZONES_DIR, "zones.geo.json");

/**
 * Convierte una celda geohash en un polígono (rectángulo)
 */
function geohashToPolygon(geohash: string): number[][] {
  const bbox = ngeohash.decode_bbox(geohash);
  const [minLat, minLng, maxLat, maxLng] = bbox;

  // GeoJSON usa [lng, lat] (no [lat, lng])
  // Polígono cerrado: primer y último punto son iguales
  return [
    [minLng, minLat], // Esquina inferior izquierda
    [maxLng, minLat], // Esquina inferior derecha
    [maxLng, maxLat], // Esquina superior derecha
    [minLng, maxLat], // Esquina superior izquierda
    [minLng, minLat], // Cerrar polígono
  ];
}

/**
 * Crea un MultiPolygon a partir de múltiples celdas
 * Por simplicidad, cada celda es un polígono separado
 * (Una optimización futura podría fusionar celdas contiguas)
 */
function cellsToMultiPolygon(cells: string[]): number[][][] {
  const polygons: number[][][] = [];

  for (const cell of cells) {
    const polygon = geohashToPolygon(cell);
    polygons.push([polygon]); // Cada polígono se envuelve en un array
  }

  // Para simplificar, devolvemos el primer polígono como Polygon
  // Si hay múltiples celdas no contiguas, idealmente sería un MultiPolygon
  // Por ahora, las unimos todas en un solo polígono con múltiples anillos
  // (no es geométricamente correcto, pero funciona para visualización básica)
  
  return polygons.flat();
}

/**
 * Genera el archivo zones.index.json
 */
async function generateIndex(catalog: ZoneCatalog): Promise<void> {
  console.log("📇 Generando zones.index.json...");

  const index: ZoneCatalogIndex = {};

  for (const zone of catalog.zones) {
    for (const cell of zone.cells) {
      if (index[cell]) {
        // Esta celda ya fue asignada en una iteración anterior
        // No debería pasar si validateZones pasó, pero por si acaso
        console.warn(
          `⚠️  Celda '${cell}' en zona '${zone.id}' ya estaba asignada a '${index[cell]}' (se sobrescribirá)`
        );
      }
      index[cell] = zone.id;
    }
  }

  await fs.writeFile(INDEX_FILE, JSON.stringify(index, null, 2), "utf-8");

  console.log(`   ✓ Generado ${Object.keys(index).length} entradas`);
  console.log(`   ✓ Guardado en: ${INDEX_FILE}\n`);
}

/**
 * Genera el archivo zones.geo.json para visualización en Leaflet
 */
async function generateGeoJSON(catalog: ZoneCatalog): Promise<void> {
  console.log("🗺️  Generando zones.geo.json...");

  const features: GeoJSONFeature[] = [];

  for (const zone of catalog.zones) {
    // Por simplicidad, creamos un polígono por cada celda
    // Una mejora futura sería fusionar celdas contiguas en un solo polígono
    const coordinates: number[][][] = [];

    for (const cell of zone.cells) {
      const polygon = geohashToPolygon(cell);
      coordinates.push([polygon]); // Cada celda es un polígono independiente
    }

    // Como tenemos múltiples celdas, usamos MultiPolygon
    // Pero para simplificar la visualización, creamos features individuales
    for (const cell of zone.cells) {
      const polygon = geohashToPolygon(cell);
      
      features.push({
        type: "Feature",
        properties: {
          id: zone.id,
          name: zone.name,
          description: zone.description,
          color: zone.color,
        },
        geometry: {
          type: "Polygon",
          coordinates: [polygon], // Un solo anillo exterior
        },
      });
    }
  }

  const geoJSON: GeoJSONFeatureCollection = {
    type: "FeatureCollection",
    features,
  };

  await fs.writeFile(GEOJSON_FILE, JSON.stringify(geoJSON, null, 2), "utf-8");

  console.log(`   ✓ Generado ${features.length} features`);
  console.log(`   ✓ Guardado en: ${GEOJSON_FILE}\n`);
}

/**
 * Función principal
 */
async function generate(): Promise<void> {
  console.log("🔧 Generando archivos derivados del catálogo de zonas\n");

  // 1. Verificar que zones.json existe
  try {
    await fs.access(ZONES_FILE);
  } catch {
    console.error(`❌ Error: No se encuentra ${ZONES_FILE}`);
    console.error("   Ejecuta primero 'pnpm zones:validate' para verificar el catálogo.");
    process.exit(1);
  }

  // 2. Leer zones.json
  let catalog: ZoneCatalog;
  try {
    const content = await fs.readFile(ZONES_FILE, "utf-8");
    catalog = JSON.parse(content);
  } catch (error) {
    console.error(`❌ Error al leer zones.json:`);
    console.error(error);
    process.exit(1);
  }

  // 3. Crear directorio zones si no existe
  try {
    await fs.mkdir(ZONES_DIR, { recursive: true });
  } catch (error) {
    // Ignorar si ya existe
  }

  // 4. Generar archivos
  try {
    await generateIndex(catalog);
    await generateGeoJSON(catalog);
  } catch (error) {
    console.error("❌ Error durante la generación:");
    console.error(error);
    process.exit(1);
  }

  console.log("✅ Archivos generados exitosamente.\n");
}

// Ejecutar
generate().catch((error) => {
  console.error("❌ Error inesperado:");
  console.error(error);
  process.exit(1);
});
