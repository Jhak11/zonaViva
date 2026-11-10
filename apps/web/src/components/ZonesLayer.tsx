// ──────────────────────────────────────────────────────────────────────
//  ZonesLayer.tsx - Renderizado de celdas de zonas geográficas (Leaflet)
// ──────────────────────────────────────────────────────────────────────
import { useMemo } from "react";
import { Rectangle, Tooltip } from "react-leaflet";
import type { Zone } from "@zonaviva/protocol";
import { decodeGeohash } from "@/geo/geoCore";
import { getZoneBoundingBox, getZoneCenter } from "@/geo/zoneCatalog";
import type { LatLngBoundsExpression } from "leaflet";

export { getZoneBoundingBox, getZoneCenter };

export interface ZonesLayerProps {
  /** Lista de zonas a renderizar */
  zones: Zone[];
  /** Zona actualmente activa o seleccionada */
  activeZone: Zone | null;
  /** IDs de zonas donde el usuario está físicamente y puede publicar */
  detectedZoneIds?: string[] | Set<string>;
  /** Callback cuando se hace clic en cualquier celda de una zona */
  onZoneClick?: (zone: Zone) => void;
}

interface CellGeometry {
  cell: string;
  bounds: LatLngBoundsExpression;
}

interface ZoneWithGeometries {
  zone: Zone;
  cells: CellGeometry[];
  isDetected: boolean;
  isActive: boolean;
}

export default function ZonesLayer({
  zones,
  activeZone,
  detectedZoneIds,
  onZoneClick,
}: ZonesLayerProps) {
  const detectedSet = useMemo(() => {
    if (!detectedZoneIds) return new Set<string>();
    return detectedZoneIds instanceof Set ? detectedZoneIds : new Set(detectedZoneIds);
  }, [detectedZoneIds]);

  // Precalcula las coordenadas de cada celda para evitar llamadas repetidas a decodeGeohash
  const preparedZones: ZoneWithGeometries[] = useMemo(() => {
    return zones.map((zone) => {
      const isDetected = detectedSet.has(zone.id);
      const isActive = activeZone?.id === zone.id;

      const cells: CellGeometry[] = zone.cells.map((cell) => {
        const { bbox } = decodeGeohash(cell);
        // bbox es [minLat, minLng, maxLat, maxLng]
        return {
          cell,
          bounds: [
            [bbox[0], bbox[1]],
            [bbox[2], bbox[3]],
          ] as LatLngBoundsExpression,
        };
      });

      return {
        zone,
        cells,
        isDetected,
        isActive,
      };
    });
  }, [zones, activeZone?.id, detectedSet]);

  return (
    <>
      {preparedZones.map(({ zone, cells, isDetected, isActive }) => {
        // Cada zona tiene su color distintivo asignado
        const baseColor = zone.color || "#0284c7";

        let strokeColor = baseColor;
        let fillColor = baseColor;
        let fillOpacity = 0.16;
        let weight = 2;
        let opacity = 0.85; // Borde nítido para delimitar claramente las zonas

        if (isDetected) {
          // Usuario físicamente en la zona: borde esmeralda de alta visibilidad y relleno vibrante
          strokeColor = "#10b981";
          fillColor = baseColor;
          fillOpacity = 0.38;
          weight = 3;
          opacity = 1.0;
        } else if (isActive) {
          // Seleccionada manualmente (modo exploración): realce en borde y relleno
          strokeColor = baseColor;
          fillColor = baseColor;
          fillOpacity = 0.30;
          weight = 2.5;
          opacity = 1.0;
        }

        return (
          <div key={zone.id}>
            {cells.map(({ cell, bounds }) => (
              <Rectangle
                key={`${zone.id}-${cell}`}
                bounds={bounds}
                pathOptions={{
                  color: strokeColor,
                  fillColor,
                  fillOpacity,
                  weight,
                  opacity,
                }}
                eventHandlers={{
                  click: () => onZoneClick?.(zone),
                }}
              >
                <Tooltip sticky direction="top" opacity={0.95}>
                  <div className="text-xs font-sans p-1 text-slate-800">
                    <div className="font-bold flex items-center gap-1.5 text-slate-900">
                      <span
                        className="w-2.5 h-2.5 rounded-full inline-block flex-none"
                        style={{ backgroundColor: baseColor }}
                      />
                      <span>{zone.name}</span>
                      {isDetected && (
                        <span className="text-[10px] px-1 py-0.2 rounded bg-emerald-100 text-emerald-700 font-semibold">
                          En zona
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">
                      {zone.description}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between gap-2 border-t pt-1">
                      <span>{zone.cells.length} celdas</span>
                      <span className={isDetected ? "text-emerald-600 font-medium" : "text-amber-600"}>
                        {isDetected ? "✓ Puedes publicar" : "Solo lectura"}
                      </span>
                    </div>
                  </div>
                </Tooltip>
              </Rectangle>
            ))}
          </div>
        );
      })}
    </>
  );
}
