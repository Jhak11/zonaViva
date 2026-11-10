import { describe, it, expect } from "vitest";
import { distanceMeters, coordinatesToGeohash } from "@/geo/geoCore";
import { getAccessibleZones } from "@/geo/accessPolicy";
import { getZoneIdByCell, getZoneById } from "@/geo/zoneCatalog";

function detectZone(lat: number, lng: number) {
  const exactCell = coordinatesToGeohash(lat, lng, 7);
  const exactZoneId = getZoneIdByCell(exactCell);
  if (exactZoneId) {
    const zone = getZoneById(exactZoneId);
    if (zone) return zone;
  }

  const zones = getAccessibleZones({
    latitude: lat,
    longitude: lng,
    accuracy: 50,
    timestamp: Date.now(),
  });
  return zones[0] ?? null;
}

describe("Geo Module - Puno Pilot", () => {
  it("calculates distance between two points accurately", () => {
    // Puno Centro (-15.8402, -70.0219) to Mercado Central (-15.8368, -70.0198)
    const dist = distanceMeters(-15.8402, -70.0219, -15.8368, -70.0198);
    // Approximately 440 meters
    expect(dist).toBeGreaterThan(350);
    expect(dist).toBeLessThan(550);
  });

  // LEGACY TEST - Comentado porque ahora las zonas usan celdas geohash
  // Las coordenadas exactas pueden caer en diferentes celdas
  it("detects 'mercado-central' when at Mercado Central", () => {
    const zone = detectZone(-15.83749, -70.02654);
    expect(zone).not.toBeNull();
    expect(zone?.id).toBe("mercado-central");
    expect(zone?.name).toBe("Mercado Central");
  });

  it("detects 'plaza-mayor' when at Plaza Mayor de Puno", () => {
    const zone = detectZone(-15.8402, -70.0278);
    expect(zone).not.toBeNull();
    expect(zone?.id).toBe("plaza-mayor");
    expect(zone?.name).toContain("Plaza Mayor");
  });

  it("detects 'unap-campus' when at Universidad Nacional del Altiplano", () => {
    const zone = detectZone(-15.824, -70.016);
    expect(zone).not.toBeNull();
    expect(zone?.id).toBe("unap-campus");
    expect(zone?.name).toContain("Universidad Nacional");
  });

  it("detects 'parque-pino' when at Parque Pino", () => {
    const zone = detectZone(-15.83777, -70.02802);
    expect(zone).not.toBeNull();
    expect(zone?.id).toBe("parque-pino");
    expect(zone?.name).toBe("Parque Pino");
  });

  it("returns null when outside of all predefined zones (e.g. Juliaca / Lima)", () => {
    // Juliaca coordinates (~ -15.498, -70.133)
    const zoneJuliaca = detectZone(-15.498, -70.133);
    expect(zoneJuliaca).toBeNull();

    // Lima coordinates (~ -12.046, -77.042)
    const zoneLima = detectZone(-12.046, -77.042);
    expect(zoneLima).toBeNull();
  });
});
