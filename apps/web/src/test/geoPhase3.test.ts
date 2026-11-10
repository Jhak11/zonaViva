import { describe, it, expect, beforeEach } from "vitest";
import { getZoneBoundingBox, getZoneCenter, getAllZones, getZoneById } from "@/geo/zoneCatalog";
import { useGeoStore } from "@/stores/geoStore";

describe("Phase 3 - Map & UI Store Integration", () => {
  beforeEach(() => {
    // Reset store state before each test
    useGeoStore.setState({
      permission: "prompt",
      status: "inactive",
      userPosition: null,
      userCells: [],
      detectedZones: [],
      manualZone: null,
      simulatedZone: null,
      error: null,
      followUserPosition: false,
    });
  });

  describe("ZonesLayer Geometry Helpers", () => {
    it("computes bounding box and center for Plaza Mayor", () => {
      const plaza = getZoneById("plaza-mayor")!;
      expect(plaza).toBeDefined();

      const bbox = getZoneBoundingBox(plaza);
      expect(bbox).not.toBeNull();
      const [[minLat, minLng], [maxLat, maxLng]] = bbox!;
      expect(minLat).toBeLessThan(maxLat);
      expect(minLng).toBeLessThan(maxLng);

      // Center should lie within bounding box
      const center = getZoneCenter(plaza);
      expect(center).not.toBeNull();
      const [cLat, cLng] = center!;
      expect(cLat).toBeGreaterThanOrEqual(minLat);
      expect(cLat).toBeLessThanOrEqual(maxLat);
      expect(cLng).toBeGreaterThanOrEqual(minLng);
      expect(cLng).toBeLessThanOrEqual(maxLng);

      // Verify approximate coordinates for Plaza Mayor (~ -15.84, -70.02)
      expect(cLat).toBeCloseTo(-15.84, 1);
      expect(cLng).toBeCloseTo(-70.02, 1);
    });

    it("handles zones with no cells gracefully", () => {
      const emptyZone = {
        id: "empty",
        name: "Empty",
        description: "",
        type: "permanent" as const,
        cells: [],
      };
      expect(getZoneBoundingBox(emptyZone)).toBeNull();
      expect(getZoneCenter(emptyZone)).toBeNull();
    });
  });

  describe("geoStore Phase 3 Actions", () => {
    it("toggles followUserPosition and centers on user", () => {
      const store = useGeoStore.getState();
      expect(store.followUserPosition).toBe(false);

      store.setFollowUserPosition(true);
      expect(useGeoStore.getState().followUserPosition).toBe(true);

      store.toggleFollowUser();
      expect(useGeoStore.getState().followUserPosition).toBe(false);

      store.centerOnUser();
      expect(useGeoStore.getState().followUserPosition).toBe(true);
    });

    it("handles manual zone selection and effectiveZone resolution", () => {
      const zones = getAllZones();
      const plaza = zones.find((z) => z.id === "plaza-mayor")!;
      const central = zones.find((z) => z.id === "mercado-central")!;

      expect(useGeoStore.getState().effectiveZone()).toBeNull();

      // When detectedZones has a zone, it becomes effective
      useGeoStore.setState({ detectedZones: [plaza] });
      expect(useGeoStore.getState().effectiveZone()?.id).toBe("plaza-mayor");

      // Manual selection overrides detected zone
      useGeoStore.getState().setManualZone(central);
      expect(useGeoStore.getState().effectiveZone()?.id).toBe("mercado-central");

      // Clearing manual zone restores detected zone
      useGeoStore.getState().setManualZone(null);
      expect(useGeoStore.getState().effectiveZone()?.id).toBe("plaza-mayor");
    });

    it("simulates GPS position in development mode", () => {
      const unap = getZoneById("unap-campus")!;
      expect(unap).toBeDefined();

      useGeoStore.getState().setSimulatedZone(unap);
      const state = useGeoStore.getState();

      expect(state.simulatedZone?.id).toBe("unap-campus");
      expect(state.detectedZones.length).toBe(1);
      expect(state.detectedZones[0].id).toBe("unap-campus");
      expect(state.userPosition).not.toBeNull();
      expect(state.permission).toBe("granted");
      expect(state.status).toBe("active");

      // Clear simulation
      useGeoStore.getState().setSimulatedZone(null);
      expect(useGeoStore.getState().simulatedZone).toBeNull();
    });

    it("evaluates qualitative accuracy level", () => {
      expect(useGeoStore.getState().getAccuracyLevel()).toBeNull();

      useGeoStore.setState({
        userPosition: {
          latitude: -15.84,
          longitude: -70.02,
          accuracy: 45,
          timestamp: Date.now(),
        },
      });
      expect(useGeoStore.getState().getAccuracyLevel()).toBe("good");

      useGeoStore.setState({
        userPosition: {
          latitude: -15.84,
          longitude: -70.02,
          accuracy: 180,
          timestamp: Date.now(),
        },
      });
      expect(useGeoStore.getState().getAccuracyLevel()).toBe("acceptable");

      useGeoStore.setState({
        userPosition: {
          latitude: -15.84,
          longitude: -70.02,
          accuracy: 400,
          timestamp: Date.now(),
        },
      });
      expect(useGeoStore.getState().getAccuracyLevel()).toBe("poor");
    });

    it("verifies canPublishInZone action against active position", () => {
      const plaza = getZoneById("plaza-mayor")!;

      // No position: cannot publish
      expect(useGeoStore.getState().canPublishInZone("plaza-mayor")).toBe(false);

      // Simulate inside plaza
      useGeoStore.getState().setSimulatedZone(plaza);
      expect(useGeoStore.getState().canPublishInZone("plaza-mayor")).toBe(true);
      expect(useGeoStore.getState().canPublishInZone("unap-campus")).toBe(false);
      expect(useGeoStore.getState().isSimulating()).toBe(true);
      expect(useGeoStore.getState().effectiveZone()?.id).toBe("plaza-mayor");

      // Clear simulation
      useGeoStore.getState().clearSimulation();
      expect(useGeoStore.getState().isSimulating()).toBe(false);
      expect(useGeoStore.getState().canPublishInZone("plaza-mayor")).toBe(false);

      // Simulate specific coordinates (e.g. for user forums)
      useGeoStore.getState().setSimulatedCoordinates({
        latitude: -15.8402,
        longitude: -70.0219,
        name: "Coordenadas Centro Puno",
      });
      expect(useGeoStore.getState().isSimulating()).toBe(true);
      expect(useGeoStore.getState().userPosition?.latitude).toBe(-15.8402);
      expect(useGeoStore.getState().userPosition?.longitude).toBe(-70.0219);

      useGeoStore.getState().clearSimulation();
      expect(useGeoStore.getState().isSimulating()).toBe(false);
    });
  });
});
