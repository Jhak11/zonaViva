// ──────────────────────────────────────────────────────────────────────
//  GeoStatusBadge.tsx - Indicador visual enriquecido del estado de GPS y zonas
// ──────────────────────────────────────────────────────────────────────
import { useGeoStore, type GeoPermission } from "@/stores/geoStore";
import type { LocationServiceStatus } from "@/geo/locationService";
import type { UserPosition } from "@/geo/accessPolicy";
import type { Zone } from "@zonaviva/protocol";
import {
  MapPinIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  SignalIcon,
} from "@heroicons/react/24/outline";

export interface GeoStatusBadgeProps {
  /** Estado del servicio GPS (si no se proporciona, usa el store) */
  status?: LocationServiceStatus;
  /** Permiso del navegador (si no se proporciona, usa el store) */
  permission?: GeoPermission;
  /** Posición actual del usuario */
  userPosition?: UserPosition | null;
  /** Zonas detectadas en tiempo real */
  detectedZones?: Zone[];
  /** Vista compacta para barras de estado o móvil */
  compact?: boolean;
  /** Clases CSS adicionales */
  className?: string;
  /** Callback al hacer click */
  onClick?: () => void;
}

export default function GeoStatusBadge({
  status: statusProp,
  permission: permissionProp,
  userPosition: userPositionProp,
  detectedZones: detectedZonesProp,
  compact = false,
  className = "",
  onClick,
}: GeoStatusBadgeProps) {
  const store = useGeoStore();

  const status = statusProp ?? store.status;
  const permission = permissionProp ?? store.permission;
  const userPosition = userPositionProp !== undefined ? userPositionProp : store.userPosition;
  const detectedZones = detectedZonesProp ?? store.detectedZones;

  const accuracy = userPosition?.accuracy ? Math.round(userPosition.accuracy) : null;
  const hasZones = detectedZones.length > 0;

  // Determinar texto, color e ícono según el estado
  let label = "GPS inactivo";
  let detail = "";
  let badgeStyles = "bg-slate-800/85 text-slate-300 border-slate-700/80";
  let dotColor = "bg-slate-400";
  let pulse = false;
  let Icon = MapPinIcon;

  if (permission === "denied") {
    label = "GPS denegado";
    detail = "Permiso bloqueado";
    badgeStyles = "bg-rose-950/80 text-rose-300 border-rose-800/60";
    dotColor = "bg-rose-500";
    Icon = ExclamationCircleIcon;
  } else if (permission === "unavailable" || status === "unavailable") {
    label = "Sin GPS";
    detail = "No compatible";
    badgeStyles = "bg-slate-900/80 text-slate-400 border-slate-700/60";
    dotColor = "bg-slate-500";
    Icon = ExclamationTriangleIcon;
  } else if (status === "requesting") {
    label = "Buscando GPS...";
    detail = "Obteniendo señal";
    badgeStyles = "bg-amber-950/80 text-amber-300 border-amber-700/60";
    dotColor = "bg-amber-400";
    pulse = true;
    Icon = SignalIcon;
  } else if (status === "active" || userPosition) {
    if (accuracy !== null && accuracy > 300) {
      // Señal baja
      label = "Señal débil";
      detail = `±${accuracy}m`;
      badgeStyles = "bg-amber-950/80 text-amber-300 border-amber-700/60";
      dotColor = "bg-amber-400";
      Icon = ExclamationCircleIcon;
    } else if (hasZones) {
      // Activo dentro de una o más zonas
      const zoneName = detectedZones[0]?.name || "Zona detectada";
      label = detectedZones.length === 1 ? zoneName : `${detectedZones.length} zonas activas`;
      detail = accuracy !== null ? `±${accuracy}m` : "En rango";
      badgeStyles = "bg-emerald-950/80 text-emerald-300 border-emerald-700/60 shadow-emerald-950/30";
      dotColor = "bg-emerald-400";
      pulse = true;
      Icon = CheckCircleIcon;
    } else {
      // Activo pero fuera de zonas piloto
      label = "Fuera de zonas";
      detail = accuracy !== null ? `±${accuracy}m` : "Puno";
      badgeStyles = "bg-sky-950/80 text-sky-300 border-sky-700/60";
      dotColor = "bg-sky-400";
      Icon = MapPinIcon;
    }
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium backdrop-blur-md border shadow-sm transition-all ${badgeStyles} ${
          onClick ? "hover:scale-[1.02] cursor-pointer" : ""
        } ${className}`}
        title={`${label} ${detail ? `(${detail})` : ""}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${dotColor} ${pulse ? "animate-pulse" : ""}`} />
        <span className="truncate max-w-[120px]">{label}</span>
      </button>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium backdrop-blur-md border shadow-md transition-all ${badgeStyles} ${
        onClick ? "hover:scale-[1.02] cursor-pointer" : ""
      } ${className}`}
    >
      <div className="relative flex items-center justify-center flex-none">
        <Icon className="w-4 h-4 flex-none" />
        <span
          className={`absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ${dotColor} ${
            pulse ? "animate-pulse" : ""
          }`}
        />
      </div>

      <div className="flex flex-col text-left leading-tight">
        <span className="font-semibold text-white/95 truncate max-w-[150px]">{label}</span>
        {detail && <span className="text-[10px] opacity-80">{detail}</span>}
      </div>
    </div>
  );
}
