// ──────────────────────────────────────────────────────────────────────
//  UserPositionLayer.tsx - Capa del marcador de usuario y círculo de precisión
// ──────────────────────────────────────────────────────────────────────
import { useEffect } from "react";
import { Circle, CircleMarker, Popup, useMap, useMapEvents } from "react-leaflet";
import type { UserPosition } from "@/geo/accessPolicy";
import { calculateEffectiveRadius } from "@/geo/geoCore";

export interface UserPositionLayerProps {
  /** Posición actual del usuario */
  position: UserPosition | null;
  /** Si está activo el modo "Centrar en mí" */
  followUser?: boolean;
  /** Callback cuando el usuario arrastra manualmente el mapa */
  onUserDrag?: () => void;
}

export default function UserPositionLayer({
  position,
  followUser = false,
  onUserDrag,
}: UserPositionLayerProps) {
  const map = useMap();

  // Escuchar cuando el usuario arrastra el mapa manualmente para desactivar el auto-follow
  useMapEvents({
    dragstart: () => {
      onUserDrag?.();
    },
  });

  // Centrado automático cuando cambia la posición si followUser está activo
  useEffect(() => {
    if (followUser && position) {
      map.panTo([position.latitude, position.longitude], {
        animate: true,
        duration: 0.8,
      });
    }
  }, [position?.latitude, position?.longitude, followUser, map]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!position) return null;

  const lat = position.latitude;
  const lng = position.longitude;
  const accuracy = Math.round(position.accuracy);
  const effectiveRadius = calculateEffectiveRadius(position.accuracy);

  // Calidad de la señal según precisión en metros
  let strokeColor = "#10b981"; // emerald-500 (good)
  let fillColor = "#10b981";
  let fillOpacity = 0.2;
  let dashArray: string | undefined = undefined;
  let accuracyLabel = "Buena precisión";
  let badgeColor = "bg-emerald-100 text-emerald-800";

  if (position.accuracy > 300) {
    // poor (> 300m)
    strokeColor = "#ef4444";
    fillColor = "#ef4444";
    fillOpacity = 0.12;
    dashArray = "5, 5";
    accuracyLabel = "Señal débil";
    badgeColor = "bg-rose-100 text-rose-800";
  } else if (position.accuracy >= 100) {
    // acceptable (100 - 300m)
    strokeColor = "#f59e0b";
    fillColor = "#f59e0b";
    fillOpacity = 0.16;
    accuracyLabel = "Precisión moderada";
    badgeColor = "bg-amber-100 text-amber-800";
  }

  return (
    <>
      {/* 1. Círculo de precisión efectiva (área de contacto con celdas geohash) */}
      <Circle
        center={[lat, lng]}
        radius={effectiveRadius}
        pathOptions={{
          color: strokeColor,
          fillColor,
          fillOpacity,
          weight: 1.5,
          dashArray,
        }}
      />

      {/* 2. Halo exterior pulsante / radar */}
      <CircleMarker
        center={[lat, lng]}
        radius={14}
        pathOptions={{
          color: strokeColor,
          fillColor,
          fillOpacity: 0.25,
          weight: 1,
        }}
      />

      {/* 3. Marcador central del usuario */}
      <CircleMarker
        center={[lat, lng]}
        radius={6}
        pathOptions={{
          color: "#ffffff",
          fillColor: strokeColor,
          fillOpacity: 1,
          weight: 2,
        }}
      >
        <Popup>
          <div className="text-xs font-sans p-1 text-slate-800 max-w-[220px]">
            <div className="flex items-center justify-between gap-2 mb-1.5 border-b pb-1">
              <span className="font-bold text-slate-900 flex items-center gap-1">
                <span>📍</span> Tu ubicación
              </span>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${badgeColor}`}>
                {accuracyLabel}
              </span>
            </div>

            <div className="space-y-1 text-[11px] text-slate-600">
              <div className="flex justify-between">
                <span>Precisión GPS:</span>
                <span className="font-medium text-slate-800">±{accuracy} m</span>
              </div>
              <div className="flex justify-between">
                <span>Radio de cobertura:</span>
                <span className="font-medium text-slate-800">~{Math.round(effectiveRadius)} m</span>
              </div>
            </div>

            <div className="mt-2 pt-1.5 border-t text-[10px] text-slate-500 leading-snug">
              🔒 <strong>Privacidad:</strong> Tu ubicación sólo se calcula en tu dispositivo. Tus coordenadas nunca se envían al servidor.
            </div>
          </div>
        </Popup>
      </CircleMarker>
    </>
  );
}
