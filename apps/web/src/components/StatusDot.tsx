// Indicador de estado de conexión / GPS
import type { GeoStatus } from "@/stores/geoStore";

interface Props {
  status: GeoStatus;
}

export default function StatusDot({ status }: Props) {
  const config: Record<GeoStatus, { color: string; label: string; pulse: boolean }> = {
    idle: { color: "bg-slate-500", label: "Iniciando", pulse: false },
    requesting: { color: "bg-amber-400", label: "Ubicando", pulse: true },
    watching: { color: "bg-emerald-400", label: "Conectado", pulse: false },
    error: { color: "bg-red-400", label: "Error GPS", pulse: false },
    unavailable: { color: "bg-slate-600", label: "Sin GPS", pulse: false },
  };

  const { color, label, pulse } = config[status];

  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-2 h-2 rounded-full ${color} ${pulse ? "animate-pulse" : ""}`} />
      <span className="text-slate-400 text-xs">{label}</span>
    </div>
  );
}
