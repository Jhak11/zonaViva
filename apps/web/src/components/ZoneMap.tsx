// ──────────────────────────────────────────────────────────────────────
//  Mapa interactivo con zonas (Leaflet + react-leaflet)
//  Se carga de forma diferida para no bloquear el bundle principal.
// ──────────────────────────────────────────────────────────────────────
import { MapContainer, TileLayer, Circle, Polygon, Popup, useMap } from "react-leaflet";
import type { Zone } from "@zonaviva/protocol";
import { useGeoStore } from "@/stores/geoStore";
import { useEffect } from "react";

// Centro por defecto: Puno, Perú
const DEFAULT_CENTER: [number, number] = [-15.8402, -70.0219];
const DEFAULT_ZOOM = 14;

interface ZoneMapProps {
  zones: Zone[];
  activeZone: Zone | null;
  onZoneClick: (zone: Zone) => void;
}

export default function ZoneMap({ zones, activeZone, onZoneClick }: ZoneMapProps) {
  return (
    <MapContainer
      center={activeZone ? [activeZone.mapCenter.lat, activeZone.mapCenter.lng] : DEFAULT_CENTER}
      zoom={activeZone?.mapZoom ?? DEFAULT_ZOOM}
      className="w-full h-full"
      zoomControl={false}
      attributionControl={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Marcador de posición del usuario */}
      <UserLocationMarker />

      {/* Zonas del catálogo */}
      {zones.map((zone) => (
        <ZoneOverlay
          key={zone.id}
          zone={zone}
          isActive={activeZone?.id === zone.id}
          onClick={() => onZoneClick(zone)}
        />
      ))}

      {/* Centrado automático cuando cambia la zona activa */}
      {activeZone && <PanToZone zone={activeZone} />}
    </MapContainer>
  );
}

// ── Marcador de posición del usuario ─────────────────────────────────

function UserLocationMarker() {
  const { status } = useGeoStore();

  // En esta iteración mostramos el punto GPS si está disponible.
  // NOTA: las coordenadas exactas NUNCA se envían al relay; solo se usan aquí localmente.
  if (status !== "watching") return null;

  // Usamos el store para obtener la zona, no las coordenadas exactas, para el marcador.
  // El marcador visual se coloca en el centro de la zona detectada (privacidad por diseño).
  return null; // Se implementará con LatLng local en Iteración 2
}

// ── Overlay de zona individual ─────────────────────────────────────────

interface ZoneOverlayProps {
  zone: Zone;
  isActive: boolean;
  onClick: () => void;
}

function ZoneOverlay({ zone, isActive, onClick }: ZoneOverlayProps) {
  const color = isActive ? "#0ea5e9" : "#334155";
  const fillOpacity = isActive ? 0.25 : 0.15;

  if (zone.type === "circle" && zone.center && zone.radiusMeters) {
    return (
      <Circle
        center={[zone.center.lat, zone.center.lng]}
        radius={zone.radiusMeters}
        pathOptions={{
          color,
          fillColor: color,
          fillOpacity,
          weight: isActive ? 2 : 1,
        }}
        eventHandlers={{ click: onClick }}
      >
        <Popup>
          <div className="text-sm">
            <strong>{zone.name}</strong>
            <p className="text-gray-600 mt-1">{zone.description}</p>
          </div>
        </Popup>
      </Circle>
    );
  }

  if (zone.type === "polygon" && zone.polygon) {
    return (
      <Polygon
        positions={zone.polygon.map((p) => [p.lat, p.lng])}
        pathOptions={{
          color,
          fillColor: color,
          fillOpacity,
          weight: isActive ? 2 : 1,
        }}
        eventHandlers={{ click: onClick }}
      >
        <Popup>
          <div className="text-sm">
            <strong>{zone.name}</strong>
            <p className="text-gray-600 mt-1">{zone.description}</p>
          </div>
        </Popup>
      </Polygon>
    );
  }

  return null;
}

// ── Pan automático al cambiar zona ────────────────────────────────────

function PanToZone({ zone }: { zone: Zone }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([zone.mapCenter.lat, zone.mapCenter.lng], zone.mapZoom, {
      duration: 0.8,
    });
  }, [zone.id, map]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
