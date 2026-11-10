import { describe, it, expect } from "vitest";
import {
  getCatalog,
  getZoneIndex,
  getZoneIdByCell,
  getZoneById,
  getAllZones,
  getZonesByCells,
  isCellInZone,
  getPilotBounds,
  isInPilotArea,
} from "./zoneCatalog";

describe("zoneCatalog", () => {
  it("loads the complete catalog correctly", () => {
    const catalog = getCatalog();
    expect(catalog).toBeDefined();
    expect(catalog.version).toBe(1);
    expect(catalog.gridPrecision).toBe(7);
    expect(catalog.zones.length).toBe(6);
    expect(catalog.pilotBounds).toEqual([
      [-15.86, -70.035],
      [-15.815, -70.005],
    ]);
  });

  it("builds the cell-to-zone index with O(1) lookup", () => {
    const index = getZoneIndex();
    expect(index).toBeDefined();
    // Known cell from mercado-central: '6mnjysb'
    expect(index["6mnjysb"]).toBe("mercado-central");
    // Known cell from parque-pino: '6mnjykz'
    expect(index["6mnjykz"]).toBe("parque-pino");
    // Known cell from unap-campus: '6mnjywx'
    expect(index["6mnjywx"]).toBe("unap-campus");
  });

  it("retrieves zoneId by cell correctly", () => {
    expect(getZoneIdByCell("6mnjysb")).toBe("mercado-central");
    expect(getZoneIdByCell("6mnjysk")).toBe("mercado-union");
    expect(getZoneIdByCell("6mnjytd")).toBe("mercado-bellavista");
    expect(getZoneIdByCell("6mnjykr")).toBe("plaza-mayor");
    expect(getZoneIdByCell("6mnjykz")).toBe("parque-pino");
    expect(getZoneIdByCell("6mnjywx")).toBe("unap-campus");
    // Unknown cell outside zones
    expect(getZoneIdByCell("zzzzzzz")).toBeUndefined();
  });

  it("retrieves zone details by zoneId", () => {
    const central = getZoneById("mercado-central");
    expect(central).toBeDefined();
    expect(central?.name).toBe("Mercado Central");
    expect(central?.color).toBe("#f97316");
    expect(central?.cells.length).toBe(4);

    const unap = getZoneById("unap-campus");
    expect(unap).toBeDefined();
    expect(unap?.name).toContain("Universidad Nacional");
    expect(unap?.color).toBe("#0284c7");
    expect(unap?.cells.length).toBe(26);

    const nonExistent = getZoneById("inexistente");
    expect(nonExistent).toBeUndefined();
  });

  it("returns all 6 zones with colors", () => {
    const zones = getAllZones();
    expect(zones.length).toBe(6);
    const ids = zones.map((z) => z.id);
    expect(ids).toContain("mercado-central");
    expect(ids).toContain("mercado-union");
    expect(ids).toContain("mercado-bellavista");
    expect(ids).toContain("plaza-mayor");
    expect(ids).toContain("parque-pino");
    expect(ids).toContain("unap-campus");

    for (const z of zones) {
      expect(z.color).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it("retrieves unique zones for an array of cells", () => {
    const cells = ["6mnjysb", "6mnjys8", "6mnjykz", "celda-inexistente"];
    const matched = getZonesByCells(cells);
    expect(matched.length).toBe(2);
    const matchedIds = matched.map((z) => z.id);
    expect(matchedIds).toContain("mercado-central");
    expect(matchedIds).toContain("parque-pino");
  });

  it("verifies if a cell belongs to any zone", () => {
    expect(isCellInZone("6mnjysb")).toBe(true);
    expect(isCellInZone("unknown-cell")).toBe(false);
  });

  it("validates coordinates inside and outside pilot area", () => {
    const bounds = getPilotBounds();
    expect(bounds).toBeDefined();

    // Inside Puno Plaza Mayor (-15.8402, -70.0278)
    expect(isInPilotArea(-15.8402, -70.0278)).toBe(true);

    // Outside (Juliaca)
    expect(isInPilotArea(-15.498, -70.133)).toBe(false);

    // Outside (Lima)
    expect(isInPilotArea(-12.046, -77.042)).toBe(false);
  });
});
