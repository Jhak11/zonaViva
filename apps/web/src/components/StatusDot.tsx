// Indicador de estado de conexión / GPS
import type { LocationServiceStatus } from "@/geo/locationService";

interface Props {
  status: LocationServiceStatus;
}

export default function StatusDot({ status }: Props) {
  const config: Record<LocationServiceStatus, { color: string; label: string; pulse: boolean }> = {
    inactive: { color: "bg-slate-500", label: "Inactivo", pulse: false },
    requesting: { color: "bg-amber-400", label: "Ubicando", pulse: true },
    active: { color: "bg-emerald-400", label: "Conectado", pulse: false },
    denied: { color: "bg-red-400", label: "Denegado", pulse: false },
    unavailable: { color: "bg-slate-600", label: "Sin GPS", pulse: false },
    error: { color: "bg-red-400", label: "Error GPS", pulse: false },
  };

  const { color, label, pulse } = config[status];

  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-2 h-2 rounded-full ${color} ${pulse ? "animate-pulse" : ""}`} />
      <span className="text-slate-400 text-xs">{label}</span>
    </div>
  );
}
