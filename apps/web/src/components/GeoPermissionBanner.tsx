// Banner cuando el permiso de GPS está denegado, no disponible o en espera
import type { GeoPermission } from "@/stores/geoStore";
import { useGeoStore } from "@/stores/geoStore";
import { useState } from "react";
import { MapPinIcon } from "@heroicons/react/24/outline";

interface Props {
  permission: GeoPermission;
}

export default function GeoPermissionBanner({ permission }: Props) {
  const { requestPermission } = useGeoStore();
  const [isRequesting, setIsRequesting] = useState(false);

  const handleRequestGps = async () => {
    setIsRequesting(true);
    await requestPermission();
    setIsRequesting(false);
  };

  if (permission === "granted") return null;

  return (
    <div className="p-3 bg-amber-500/10 border border-amber-500/25 rounded-2xl text-xs space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 text-amber-300">
          <div className="flex-none mt-0.5">
            <MapPinIcon className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <p className="font-semibold text-white">
              {permission === "denied"
                ? "Permiso de GPS Denegado"
                : "Geolocalización GPS Requerida"}
            </p>
            <p className="text-slate-400 text-[11px] mt-0.5 leading-relaxed">
              ZonaViva requiere acceso a tu ubicación para verificar tu presencia en los foros de Puno. Tus coordenadas se evalúan localmente y jamás salen de tu dispositivo.
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 pt-1">
        <button
          type="button"
          onClick={handleRequestGps}
          disabled={isRequesting}
          className="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 font-semibold text-[11px] transition-colors flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
        >
          <MapPinIcon className="w-3.5 h-3.5 text-emerald-400 flex-none" />
          <span>{isRequesting ? "Solicitando..." : "Activar / Permitir GPS"}</span>
        </button>
      </div>
    </div>
  );
}
