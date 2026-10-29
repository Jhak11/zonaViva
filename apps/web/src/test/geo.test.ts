import { describe, it, expect } from "vitest";
import { haversineMeters, detectZone, isInZone } from "../modules/geo";
import { ZONES } from "@zonaviva/protocol";

describe("Geo Module - Puno Pilot", () => {
  it("calculates distance between two points accurately", () => {
    // Puno Centro (-15.8402, -70.0219) to Mercado Central (-15.8368, -70.0198)
    const dist = haversineMeters(-15.8402, -70.0219, -15.8368, -70.0198);
    // Approximately 440 meters
    expect(dist).toBeGreaterThan(350);
    expect(dist).toBeLessThan(550);
  });

  it("detects 'puno-centro' when inside Plaza Mayor", () => {
    // Exact center coordinate of puno-centro
    const zone = detectZone(-15.8402, -70.0219);
    expect(zone).not.toBeNull();
    expect(zone?.id).toBe("puno-centro");
    expect(zone?.name).toBe("Centro de Puno");
  });

  it("detects 'puno-puerto' when near port / Titicaca dock", () => {
    const zone = detectZone(-15.8453, -70.0134);
    expect(zone).not.toBeNull();
    expect(zone?.id).toBe("puno-puerto");
    expect(zone?.name).toBe("Puerto y Lago Titicaca");
  });

  it("detects 'puno-mercado' when at Mercado Central", () => {
    const zone = detectZone(-15.8368, -70.0198);
    expect(zone).not.toBeNull();
    expect(zone?.id).toBe("puno-mercado");
  });

  it("detects 'puno-laureles' test zone at Jirón Los Laureles", () => {
    const zone = detectZone(-15.8260, -70.0150);
    expect(zone).not.toBeNull();
    expect(zone?.id).toBe("puno-laureles");
    expect(zone?.name).toContain("Los Laureles");
  });

  it("returns null when outside of all predefined zones (e.g. Juliaca / Lima)", () => {
    // Juliaca coordinates (~ -15.498, -70.133)
    const zoneJuliaca = detectZone(-15.498, -70.133);
    expect(zoneJuliaca).toBeNull();

    // Lima coordinates (~ -12.046, -77.042)
    const zoneLima = detectZone(-12.046, -77.042);
    expect(zoneLima).toBeNull();
  });

  it("isInZone validates boundary inclusion properly", () => {
    const centro = ZONES.find((z) => z.id === "puno-centro")!;
    expect(isInZone(-15.8402, -70.0219, centro)).toBe(true);
    // 5 km away
    expect(isInZone(-15.8900, -70.0219, centro)).toBe(false);
  });
});
