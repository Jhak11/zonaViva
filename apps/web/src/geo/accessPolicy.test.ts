import { describe, it, expect } from "vitest";
import {
  isPositionFresh,
  isPositionAccurate,
  getUserCells,
  getAccessibleZones,
  canPublishInZoneForum,
  getLocationStatusMessage,
  type UserPosition,
} from "./accessPolicy";

describe("accessPolicy", () => {
  const now = Date.now();

  const plazaMayorPos: UserPosition = {
    latitude: -15.8402,
    longitude: -70.0278,
    accuracy: 65,
    timestamp: now,
  };

  const mercadoCentralPos: UserPosition = {
    latitude: -15.83749,
    longitude: -70.02654,
    accuracy: 60,
    timestamp: now,
  };

  const juliacaPos: UserPosition = {
    latitude: -15.498,
    longitude: -70.133,
    accuracy: 40,
    timestamp: now,
  };

  it("checks position freshness correctly", () => {
    expect(isPositionFresh(plazaMayorPos)).toBe(true);

    const stalePos: UserPosition = {
      ...plazaMayorPos,
      timestamp: Date.now() - 90_000, // 90 seconds old (> 60s)
    };
    expect(isPositionFresh(stalePos)).toBe(false);
  });

  it("checks position accuracy correctly", () => {
    expect(isPositionAccurate({ ...plazaMayorPos, accuracy: 50 })).toBe(true);
    expect(isPositionAccurate({ ...plazaMayorPos, accuracy: 300 })).toBe(true);
    expect(isPositionAccurate({ ...plazaMayorPos, accuracy: 301 })).toBe(false);
    expect(isPositionAccurate({ ...plazaMayorPos, accuracy: 800 })).toBe(false);
  });

  it("computes user cells touching the precision circle", () => {
    const cells = getUserCells(plazaMayorPos);
    expect(cells.length).toBeGreaterThan(0);
    // Precision 7 geohashes
    expect(cells[0].length).toBe(7);
  });

  it("determines accessible zones from position", () => {
    const zones = getAccessibleZones(plazaMayorPos);
    expect(zones.length).toBeGreaterThan(0);
    expect(zones.some((z) => z.id === "plaza-mayor")).toBe(true);

    const outsideZones = getAccessibleZones(juliacaPos);
    expect(outsideZones.length).toBe(0);
  });

  it("authorizes publishing inside the zone forum", () => {
    const checkPlaza = canPublishInZoneForum(plazaMayorPos, "plaza-mayor");
    expect(checkPlaza.canPublish).toBe(true);
    expect(checkPlaza.detectedZones.some((z) => z.id === "plaza-mayor")).toBe(true);

    const checkMercado = canPublishInZoneForum(mercadoCentralPos, "mercado-central");
    expect(checkMercado.canPublish).toBe(true);
    expect(checkMercado.detectedZones.some((z) => z.id === "mercado-central")).toBe(true);
  });

  it("denies publishing when position is null", () => {
    const check = canPublishInZoneForum(null, "plaza-mayor");
    expect(check.canPublish).toBe(false);
    expect(check.reason).toContain("ubicación");
  });

  it("denies publishing when position is stale", () => {
    const stalePos: UserPosition = {
      ...plazaMayorPos,
      timestamp: Date.now() - 100_000,
    };
    const check = canPublishInZoneForum(stalePos, "plaza-mayor");
    expect(check.canPublish).toBe(false);
    expect(check.reason).toContain("actualizada");
  });

  it("denies publishing when GPS accuracy is poor (>300m)", () => {
    const inaccuratePos: UserPosition = {
      ...plazaMayorPos,
      accuracy: 450,
    };
    const check = canPublishInZoneForum(inaccuratePos, "plaza-mayor");
    expect(check.canPublish).toBe(false);
    expect(check.reason).toContain("insuficiente");
  });

  it("denies publishing when user is physically outside the zone", () => {
    // User is in Plaza Mayor, tries to publish in UNAP (~2km away)
    const check = canPublishInZoneForum(plazaMayorPos, "unap-campus");
    expect(check.canPublish).toBe(false);
    expect(check.reason).toContain("No estás en esta zona");
  });

  it("formats descriptive status messages", () => {
    expect(getLocationStatusMessage(null)).toBe("Ubicación no disponible");

    const stalePos: UserPosition = {
      ...plazaMayorPos,
      timestamp: Date.now() - 120_000,
    };
    expect(getLocationStatusMessage(stalePos)).toContain("desactualizada");

    const poorPos: UserPosition = {
      ...plazaMayorPos,
      accuracy: 500,
    };
    expect(getLocationStatusMessage(poorPos)).toContain("Precisión baja");

    expect(getLocationStatusMessage(plazaMayorPos)).toContain("Ubicación activa");
  });
});
