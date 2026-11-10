import fs from "fs/promises";
import path from "path";

async function fetchAllPOIs() {
  const osmIds = [
    "W245233061", // Mercado Central
    "W622487966", // Mercado Unión y Dignidad
    "W434335516", // Mercado Bellavista
    "W23782595",  // Plaza Mayor
    "W23782585",  // Parque Pino
    "W335293216", // UNAP
  ];

  console.log("Descargando polígonos GeoJSON desde OpenStreetMap Nominatim...");
  const url = `https://nominatim.openstreetmap.org/lookup?osm_ids=${osmIds.join(",")}&format=geojson&polygon_geojson=1`;
  const res = await fetch(url, {
    headers: { "User-Agent": "ZonaViva-Puno-App/1.0" },
  });

  if (!res.ok) {
    throw new Error(`Error HTTP ${res.status}`);
  }

  const geojson = await res.json();
  console.log(`Descargados ${geojson.features?.length || 0} polígonos.`);

  const outputDir = path.resolve("packages/protocol/data");
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(
    path.join(outputDir, "osm_sources.json"),
    JSON.stringify(geojson, null, 2)
  );

  console.log("Guardado en packages/protocol/data/osm_sources.json");
}

fetchAllPOIs().catch(console.error);
