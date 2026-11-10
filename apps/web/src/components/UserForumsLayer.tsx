// ──────────────────────────────────────────────────────────────────────
//  UserForumsLayer.tsx - Capa de Foros Temporales de Usuario (Iteración 5)
//  Representación de ámbitos físicos circulares con límites definidos en gris
//  y borde negro contrastado. Visible si el usuario está dentro o es participante.
// ──────────────────────────────────────────────────────────────────────
import { useMemo } from "react";
import { Circle, Tooltip } from "react-leaflet";
import type { TemporaryForum, Forum } from "@zonaviva/protocol";
import { distanceMeters } from "@/geo/geoCore";

export interface UserForumsLayerProps {
  nearbyForums: TemporaryForum[];
  myForums: Array<Forum & { messageCount: number; unreadCount: number }>;
  userPosition?: { latitude: number; longitude: number } | null;
  onForumClick?: (forumId: string) => void;
}

interface DisplayedCircleForum {
  id: string;
  name: string;
  description: string;
  latitude: number;
  longitude: number;
  radius: number;
  isParticipant: boolean;
  isInside: boolean;
  participantCount?: number;
}

export default function UserForumsLayer({
  nearbyForums,
  myForums,
  userPosition,
  onForumClick,
}: UserForumsLayerProps) {
  // Consolidar foros únicos que deben mostrarse en el mapa
  const visibleForums = useMemo<DisplayedCircleForum[]>(() => {
    const map = new Map<string, DisplayedCircleForum>();

    // 1. Añadir foros de mis suscripciones/participaciones activas
    for (const f of myForums) {
      if (!f.latitude || !f.longitude || !f.radius) continue;

      let isInside = false;
      if (userPosition) {
        const dist = distanceMeters(
          userPosition.latitude,
          userPosition.longitude,
          f.latitude,
          f.longitude
        );
        isInside = dist <= f.radius + 50; // tolerancia GPS
      }

      map.set(f.id, {
        id: f.id,
        name: f.name,
        description: f.description || "",
        latitude: f.latitude,
        longitude: f.longitude,
        radius: f.radius,
        isParticipant: true,
        isInside,
        participantCount: undefined,
      });
    }

    // 2. Añadir foros cercanos descubiertos físicamente
    for (const f of nearbyForums) {
      if (!f.latitude || !f.longitude || !f.radius) continue;

      let isInside = false;
      if (userPosition) {
        const dist = distanceMeters(
          userPosition.latitude,
          userPosition.longitude,
          f.latitude,
          f.longitude
        );
        isInside = dist <= f.radius + 50;
      }

      const existing = map.get(f.id);
      if (existing) {
        existing.participantCount = f.participantCount;
        existing.isInside = isInside || existing.isInside;
      } else if (isInside) {
        map.set(f.id, {
          id: f.id,
          name: f.name,
          description: f.description || "",
          latitude: f.latitude,
          longitude: f.longitude,
          radius: f.radius,
          isParticipant: false,
          isInside: true,
          participantCount: f.participantCount,
        });
      }
    }

    return Array.from(map.values());
  }, [nearbyForums, myForums, userPosition]);

  return (
    <>
      {visibleForums.map((f) => (
        <Circle
          key={f.id}
          center={[f.latitude, f.longitude]}
          radius={f.radius}
          pathOptions={{
            color: "#0f172a", // Borde negro pizarra oscuro y marcado
            weight: 2.5,
            opacity: 0.95,
            fillColor: "#64748b", // Relleno gris neutro
            fillOpacity: f.isInside ? 0.28 : 0.16,
            dashArray: f.isInside ? undefined : "6, 6", // Línea discontinua si está fuera pero es participante
          }}
          eventHandlers={{
            click: () => {
              if (onForumClick) {
                onForumClick(f.id);
              }
            },
          }}
        >
          <Tooltip direction="top" offset={[0, -10]} opacity={0.96}>
            <div className="text-xs p-1 min-w-[140px] text-slate-900 font-sans">
              <div className="font-bold flex items-center justify-between gap-2">
                <span>💬 {f.name}</span>
                {f.isInside && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-medium">
                    Dentro
                  </span>
                )}
              </div>
              {f.description && (
                <p className="text-[11px] text-slate-600 line-clamp-2 mt-0.5">
                  {f.description}
                </p>
              )}
              <div className="mt-1 pt-1 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-500">
                <span>
                  {f.participantCount !== undefined ? `👥 ${f.participantCount} activos` : "Foro temporal"}
                </span>
                <span className="font-medium text-brand-600">
                  {f.isInside ? "Puedes publicar" : "Solo lectura"}
                </span>
              </div>
            </div>
          </Tooltip>
        </Circle>
      ))}
    </>
  );
}
