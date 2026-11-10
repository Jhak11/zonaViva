// ──────────────────────────────────────────────────────────────────────
//  ZoneMap.tsx - Mapa interactivo con zonas y geolocalización (Fase 3)
// ──────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import type { Zone } from "@zonaviva/protocol";
import {
  MAP_TILES_URL,
  MAP_TILES_ATTRIBUTION,
  MAP_DEFAULT_ZOOM,
  MAP_MIN_ZOOM,
  MAP_MAX_ZOOM,
} from "@zonaviva/protocol";
import { useGeoStore } from "@/stores/geoStore";
import { useForumStore } from "@/stores/forumStore";
import { getAllZones, getPilotBounds } from "@/geo/zoneCatalog";
import ZonesLayer, { getZoneBoundingBox, getZoneCenter } from "@/components/ZonesLayer";
import UserPositionLayer from "@/components/UserPositionLayer";
import UserForumsLayer from "@/components/UserForumsLayer";
import GeoStatusBadge from "@/components/GeoStatusBadge";
import type { LatLngBoundsExpression, Map as LeafletMap } from "leaflet";

// Centro por defecto: Puno, Perú
const DEFAULT_CENTER_PUNO: [number, number] = [-15.8402, -70.0219];

export interface ZoneMapProps {
  /** Zonas a visualizar (por defecto carga todas las del catálogo) */
  zones?: Zone[];
  /** Zona actualmente activa o seleccionada */
  activeZone?: Zone | null;
  /** Callback al hacer click en una zona */
  onZoneClick?: (zone: Zone) => void;
  /** Mostrar u ocultar la capa de posición de usuario */
  showUserPosition?: boolean;
  /** Mostrar u ocultar la capa de celdas de zonas */
  showZones?: boolean;
  /** Mostrar u ocultar la capa de foros de usuarios (círculos) */
  showUserForums?: boolean;
  /** Callback al hacer click en un foro de usuario */
  onUserForumClick?: (forumId: string) => void;
  /** Mostrar u ocultar el badge flotante de estado */
  showStatusBadge?: boolean;
  /** Clases CSS adicionales para el contenedor del mapa */
  className?: string;
}

export default function ZoneMap({
  zones: zonesProp,
  activeZone: activeZoneProp,
  onZoneClick,
  showUserPosition = true,
  showZones = true,
  showUserForums = true,
  onUserForumClick,
  showStatusBadge = true,
  className = "w-full h-full",
}: ZoneMapProps) {
  const [map, setMap] = useState<LeafletMap | null>(null);

  const {
    userPosition,
    detectedZones,
    status,
    permission,
    followUserPosition,
    setFollowUserPosition,
    centerOnUser,
    effectiveZone: getEffectiveZone,
  } = useGeoStore();

  const { nearbyUserForums, myUserForums } = useForumStore();

  const zones = zonesProp ?? getAllZones();
  const activeZone = activeZoneProp !== undefined ? activeZoneProp : getEffectiveZone();

  // Bounding box permitido del área piloto (con margen de seguridad)
  const maxBounds = useMemo<LatLngBoundsExpression>(() => {
    const [[minLat, minLng], [maxLat, maxLng]] = getPilotBounds();
    return [
      [minLat - 0.05, minLng - 0.05],
      [maxLat + 0.05, maxLng + 0.05],
    ];
  }, []);

  // IDs de zonas detectadas físicamente donde se puede publicar
  const detectedZoneIds = useMemo(() => {
    return detectedZones.map((z) => z.id);
  }, [detectedZones]);

  // Centro inicial del mapa
  const initialCenter = useMemo<[number, number]>(() => {
    if (activeZone) {
      const center = getZoneCenter(activeZone);
      if (center) return center;
    }
    return DEFAULT_CENTER_PUNO;
  }, [activeZone]);

  const handleCenterOnUser = () => {
    if (userPosition) {
      if (map) {
        map.panTo([userPosition.latitude, userPosition.longitude], {
          animate: true,
          duration: 0.8,
        });
      }
      centerOnUser();
    }
  };

  const handleResetView = () => {
    if (!map) return;
    const [[minLat, minLng], [maxLat, maxLng]] = getPilotBounds();
    map.fitBounds(
      [
        [minLat, minLng],
        [maxLat, maxLng],
      ],
      {
        padding: [20, 20],
        animate: true,
        duration: 0.8,
      }
    );
  };

  return (
    <div className={`relative ${className}`}>
      <MapContainer
        center={initialCenter}
        zoom={MAP_DEFAULT_ZOOM}
        minZoom={MAP_MIN_ZOOM}
        maxZoom={MAP_MAX_ZOOM}
        maxBounds={maxBounds}
        maxBoundsViscosity={0.8}
        className="w-full h-full"
        zoomControl={false}
        attributionControl={true}
      >
        <TileLayer
          attribution={MAP_TILES_ATTRIBUTION}
          url={MAP_TILES_URL}
        />

        {/* Captura la instancia del mapa para los controles flotantes externos */}
        <MapInstanceBridge onMapReady={setMap} />

        {/* 1. Capa de celdas geohash por zona */}
        {showZones && (
          <ZonesLayer
            zones={zones}
            activeZone={activeZone}
            detectedZoneIds={detectedZoneIds}
            onZoneClick={onZoneClick}
          />
        )}

        {/* 2. Capa de foros temporales de usuario (círculos) */}
        {showUserForums && (
          <UserForumsLayer
            nearbyForums={nearbyUserForums}
            myForums={myUserForums}
            userPosition={userPosition}
            onForumClick={onUserForumClick}
          />
        )}

        {/* 2. Capa de ubicación y precisión del usuario */}
        {showUserPosition && (
          <UserPositionLayer
            position={userPosition}
            followUser={followUserPosition}
            onUserDrag={() => setFollowUserPosition(false)}
          />
        )}

        {/* 3. Controlador de navegación y pan automático */}
        <MapNavigationController
          activeZone={activeZone}
          followUser={followUserPosition}
          userPosition={userPosition}
        />
      </MapContainer>

      {/* ── Overlays flotantes de interfaz ── */}

      {/* Badge de estado GPS / Zonas en la esquina superior derecha */}
      {showStatusBadge && (
        <div className="absolute top-3 right-3 z-[400] pointer-events-auto">
          <GeoStatusBadge
            status={status}
            permission={permission}
            userPosition={userPosition}
            detectedZones={detectedZones}
            onClick={userPosition ? handleCenterOnUser : undefined}
          />
        </div>
      )}

      {/* Botón flotante: "Centrar en mí" */}
      {showUserPosition && userPosition && (
        <button
          type="button"
          onClick={handleCenterOnUser}
          className={`absolute bottom-4 right-4 z-[400] w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center shadow-lg backdrop-blur-md transition-all active:scale-95 ${
            followUserPosition
              ? "bg-brand-500 text-white ring-4 ring-brand-500/30 shadow-brand-500/30"
              : "bg-surface-1/90 hover:bg-surface-1 text-slate-300 hover:text-white border border-surface-2"
          }`}
          title={followUserPosition ? "Siguiendo tu ubicación" : "Centrar en mi ubicación"}
        >
          <svg
            className={`w-5 h-5 ${followUserPosition ? "animate-pulse" : ""}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v3m0 14v3M2 12h3m14 0h3" />
          </svg>
        </button>
      )}

      {/* Botón flotante: "Restablecer vista a Puno" */}
      <button
        type="button"
        onClick={handleResetView}
        className="absolute bottom-4 left-4 z-[400] px-2.5 py-1.5 rounded-lg bg-surface-1/90 hover:bg-surface-1 border border-surface-2 text-[11px] font-medium text-slate-300 hover:text-white shadow-md backdrop-blur-md transition-all active:scale-95 flex items-center gap-1.5"
        title="Ajustar vista al área del piloto Puno"
      >
        <span>🗺️</span>
        <span className="hidden sm:inline">Ver todo</span> Puno
      </button>
    </div>
  );
}

// ── Puente para capturar la instancia del mapa sin violar el contexto de Leaflet ──

function MapInstanceBridge({ onMapReady }: { onMapReady: (map: LeafletMap) => void }) {
  const map = useMap();
  useEffect(() => {
    onMapReady(map);
  }, [map, onMapReady]);
  return null;
}

// ── Controlador de navegación automático ─────────────────────────────

interface MapNavigationControllerProps {
  activeZone: Zone | null;
  followUser: boolean;
  userPosition: { latitude: number; longitude: number } | null;
}

function MapNavigationController({
  activeZone,
  followUser,
  userPosition,
}: MapNavigationControllerProps) {
  const map = useMap();
  const prevZoneIdRef = useRef<string | null>(null);

  // Auto-pan cuando cambia la zona activa (si no estamos siguiendo al usuario)
  useEffect(() => {
    if (!activeZone) return;

    // Solo animar si la zona cambió
    if (prevZoneIdRef.current !== activeZone.id) {
      prevZoneIdRef.current = activeZone.id;

      if (!followUser) {
        const bounds = getZoneBoundingBox(activeZone);
        if (bounds) {
          map.fitBounds(bounds, {
            padding: [40, 40],
            maxZoom: 16,
            animate: true,
            duration: 0.8,
          });
        }
      }
    }
  }, [activeZone?.id, followUser, map]);

  // Si se activa "followUser" manualmente
  useEffect(() => {
    if (followUser && userPosition) {
      map.panTo([userPosition.latitude, userPosition.longitude], {
        animate: true,
        duration: 0.8,
      });
    }
  }, [followUser, userPosition, map]);

  return null;
}
