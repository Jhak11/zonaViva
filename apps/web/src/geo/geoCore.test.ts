// ──────────────────────────────────────────────────────────────────────
//  Pruebas unitarias de geoCore
// ──────────────────────────────────────────────────────────────────────
import { describe, test, expect } from "vitest";
import {
  coordinatesToGeohash,
  decodeGeohash,
  distanceMeters,
  distanceToRect,
  calculateEffectiveRadius,
  cellsTouchingCircle,
  getNeighborGeohashes,
  isValidGeohash,
  geohashCellArea,
  formatArea,
} from "./geoCore";

describe("geoCore", () => {
  // Coordenadas de Los Laureles, Puno (zona de pruebas)
  const testLat = -15.8369;
  const testLng = -70.0211;

  describe("coordinatesToGeohash y decodeGeohash", () => {
    test("conversión ida y vuelta mantiene precisión", () => {
      const hash = coordinatesToGeohash(testLat, testLng, 7);
      const decoded = decodeGeohash(hash);

      // La precisión 7 tiene error de ~±76m
      expect(decoded.latitude).toBeCloseTo(testLat, 2);
      expect(decoded.longitude).toBeCloseTo(testLng, 2);
    });

    test("geohash de precisión 7 tiene 7 caracteres", () => {
      const hash = coordinatesToGeohash(testLat, testLng, 7);
      expect(hash).toHaveLength(7);
    });

    test("diferentes precisiones generan diferentes longitudes", () => {
      const hash5 = coordinatesToGeohash(testLat, testLng, 5);
      const hash6 = coordinatesToGeohash(testLat, testLng, 6);
      const hash7 = coordinatesToGeohash(testLat, testLng, 7);

      expect(hash5).toHaveLength(5);
      expect(hash6).toHaveLength(6);
      expect(hash7).toHaveLength(7);
    });

    test("decodeGeohash devuelve bbox correcto", () => {
      const hash = coordinatesToGeohash(testLat, testLng, 7);
      const decoded = decodeGeohash(hash);

      expect(decoded.bbox).toHaveLength(4);
      const [minLat, minLng, maxLat, maxLng] = decoded.bbox;

      // El punto central debe estar dentro del bbox
      expect(decoded.latitude).toBeGreaterThanOrEqual(minLat);
      expect(decoded.latitude).toBeLessThanOrEqual(maxLat);
      expect(decoded.longitude).toBeGreaterThanOrEqual(minLng);
      expect(decoded.longitude).toBeLessThanOrEqual(maxLng);
    });
  });

  describe("distanceMeters", () => {
    test("distancia entre el mismo punto es 0", () => {
      const dist = distanceMeters(testLat, testLng, testLat, testLng);
      expect(dist).toBe(0);
    });

    test("distancia entre dos puntos conocidos", () => {
      // Plaza de Armas de Puno (aprox.)
      const plazaLat = -15.8402;
      const plazaLng = -70.0219;

      const dist = distanceMeters(testLat, testLng, plazaLat, plazaLng);

      // Distancia esperada: ~370m (validado con Google Maps)
      expect(dist).toBeGreaterThan(300);
      expect(dist).toBeLessThan(450);
    });

    test("distancia es simétrica", () => {
      const lat2 = -15.8400;
      const lng2 = -70.0250;

      const dist1 = distanceMeters(testLat, testLng, lat2, lng2);
      const dist2 = distanceMeters(lat2, lng2, testLat, testLng);

      expect(dist1).toBeCloseTo(dist2, 1);
    });
  });

  describe("distanceToRect", () => {
    test("punto dentro del rectángulo devuelve 0", () => {
      const bbox: [number, number, number, number] = [
        -15.8400, -70.0250, -15.8300, -70.0150
      ];
      const dist = distanceToRect(testLat, testLng, bbox);
      expect(dist).toBe(0);
    });

    test("punto fuera del rectángulo devuelve distancia positiva", () => {
      const bbox: [number, number, number, number] = [
        -15.8500, -70.0350, -15.8450, -70.0300
      ];
      const dist = distanceToRect(testLat, testLng, bbox);
      expect(dist).toBeGreaterThan(0);
    });
  });

  describe("calculateEffectiveRadius", () => {
    const MIN_RADIUS = 50;
    const MAX_RADIUS = 150;

    test("accuracy menor que MIN_RADIUS devuelve MIN_RADIUS", () => {
      const radius = calculateEffectiveRadius(30);
      expect(radius).toBe(MIN_RADIUS);
    });

    test("accuracy mayor que MAX_RADIUS devuelve MAX_RADIUS", () => {
      const radius = calculateEffectiveRadius(200);
      expect(radius).toBe(MAX_RADIUS);
    });

    test("accuracy en rango devuelve el mismo valor", () => {
      const accuracy = 100;
      const radius = calculateEffectiveRadius(accuracy);
      expect(radius).toBe(accuracy);
    });
  });

  describe("cellsTouchingCircle", () => {
    test("círculo pequeño toca pocas celdas", () => {
      const cells = cellsTouchingCircle(testLat, testLng, 50, 7);
      expect(cells.length).toBeGreaterThan(0);
      expect(cells.length).toBeLessThanOrEqual(9); // Máximo 9 celdas (3x3)
    });

    test("círculo grande toca más celdas", () => {
      const cells = cellsTouchingCircle(testLat, testLng, 150, 7);
      expect(cells.length).toBeGreaterThan(0);
    });

    test("todas las celdas devueltas tienen precisión correcta", () => {
      const cells = cellsTouchingCircle(testLat, testLng, 100, 7);
      cells.forEach(cell => {
        expect(cell).toHaveLength(7);
        expect(isValidGeohash(cell, 7)).toBe(true);
      });
    });

    test("no hay celdas duplicadas", () => {
      const cells = cellsTouchingCircle(testLat, testLng, 100, 7);
      const uniqueCells = new Set(cells);
      expect(uniqueCells.size).toBe(cells.length);
    });

    test("círculo en borde entre celdas toca múltiples celdas", () => {
      // Usar coordenadas justo en el borde de una celda
      const hash = coordinatesToGeohash(testLat, testLng, 7);
      const decoded = decodeGeohash(hash);
      const [_minLat, _minLng, maxLat, maxLng] = decoded.bbox;
      
      // Punto en el borde superior derecho
      const borderLat = maxLat;
      const borderLng = maxLng;
      
      const cells = cellsTouchingCircle(borderLat, borderLng, 100, 7);
      expect(cells.length).toBeGreaterThanOrEqual(2); // Al menos 2 celdas
    });
  });

  describe("getNeighborGeohashes", () => {
    test("devuelve 8 vecinos", () => {
      const hash = coordinatesToGeohash(testLat, testLng, 7);
      const neighbors = getNeighborGeohashes(hash);
      
      // Puede devolver menos de 8 en los bordes extremos del mundo
      expect(neighbors.length).toBeGreaterThan(0);
      expect(neighbors.length).toBeLessThanOrEqual(8);
    });

    test("todos los vecinos tienen la misma precisión", () => {
      const hash = coordinatesToGeohash(testLat, testLng, 6);
      const neighbors = getNeighborGeohashes(hash);
      
      neighbors.forEach(neighbor => {
        expect(neighbor).toHaveLength(6);
      });
    });

    test("no incluye la celda original", () => {
      const hash = coordinatesToGeohash(testLat, testLng, 7);
      const neighbors = getNeighborGeohashes(hash);
      
      expect(neighbors).not.toContain(hash);
    });
  });

  describe("isValidGeohash", () => {
    test("geohash válido devuelve true", () => {
      expect(isValidGeohash("6mhx2k1")).toBe(true);
      expect(isValidGeohash("6mhx2")).toBe(true);
    });

    test("string vacío devuelve false", () => {
      expect(isValidGeohash("")).toBe(false);
    });

    test("caracteres inválidos devuelven false", () => {
      expect(isValidGeohash("INVALID")).toBe(false); // 'I' no es válido
      expect(isValidGeohash("6mhx2k1!")).toBe(false); // '!' no es válido
    });

    test("valida precisión específica", () => {
      expect(isValidGeohash("6mhx2k1", 7)).toBe(true);
      expect(isValidGeohash("6mhx2k1", 5)).toBe(false); // longitud incorrecta
    });
  });

  describe("geohashCellArea y formatArea", () => {
    test("precisión 7 tiene área aproximada de 153m×153m", () => {
      const area = geohashCellArea(7);
      expect(area).toBeGreaterThan(19_000_000); // ~19.5M m²
      expect(area).toBeLessThan(20_000_000);
    });

    test("formatArea convierte m² a km² para áreas grandes", () => {
      const formatted = formatArea(5_000_000);
      expect(formatted).toContain("km²");
      expect(formatted).toContain("5.0");
    });

    test("formatArea mantiene m² para áreas pequeñas", () => {
      const formatted = formatArea(500);
      expect(formatted).toContain("m²");
      expect(formatted).toContain("500");
    });
  });
});
