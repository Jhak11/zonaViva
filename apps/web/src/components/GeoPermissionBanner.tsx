// Banner cuando el permiso de GPS está denegado, no disponible o en HTTP
import type { GeoPermission } from "@/stores/geoStore";
import { useGeoStore } from "@/stores/geoStore";
import { ZONES } from "@zonaviva/protocol";
import { useState } from "react";
import { MapPinIcon, BeakerIcon } from "@heroicons/react/24/outline";

interface Props {
  permission: GeoPermission;
}

export default function GeoPermissionBanner({ permission }: Props) {
  const { simulatedZone, setSimulatedZone, requestPermission } = useGeoStore();
  const [showSimModal, setShowSimModal] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);

  const handleRequestGps = async () => {
    setIsRequesting(true);
    await requestPermission();
    setIsRequesting(false);
  };

  if (permission === "granted" && !simulatedZone) return null;

  return (
    <div className="p-3 bg-amber-500/10 border border-amber-500/25 rounded-2xl text-xs space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 text-amber-300">
          <div className="flex-none mt-0.5">
            {simulatedZone ? (
              <BeakerIcon className="w-4 h-4 text-purple-400" />
            ) : (
              <MapPinIcon className="w-4 h-4 text-amber-400" />
            )}
          </div>
          <div>
            <p className="font-semibold text-white">
              {simulatedZone
                ? `Simulador Activo: ${simulatedZone.name}`
                : "Geolocalización GPS requiere HTTPS"}
            </p>
            <p className="text-slate-400 text-[11px] mt-0.5 leading-relaxed">
              {simulatedZone
                ? "Tienes la presencia física simulada en esta zona. Puedes publicar en su foro."
                : "Los navegadores móviles solo activan el GPS en conexiones seguras (HTTPS). Puedes simular tu ubicación para probar las salas."}
            </p>
          </div>
        </div>

        {simulatedZone && (
          <button
            onClick={() => setSimulatedZone(null)}
            className="text-[11px] bg-surface-2 text-slate-300 hover:text-white px-2 py-1 rounded-lg flex-none"
          >
            Quitar
          </button>
        )}
      </div>

      <div className="flex items-center gap-1.5 pt-1">
        <button
          type="button"
          onClick={handleRequestGps}
          disabled={isRequesting}
          className="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 font-semibold text-[11px] transition-colors flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
        >
          <MapPinIcon className="w-3.5 h-3.5 text-emerald-400 flex-none" />
          <span>{isRequesting ? "Solicitando..." : "Activar / Reintentar GPS"}</span>
        </button>

        <button
          type="button"
          onClick={() => setShowSimModal((prev) => !prev)}
          className="px-2.5 py-1.5 rounded-lg bg-brand-500/20 hover:bg-brand-500/30 text-brand-300 border border-brand-500/30 font-medium text-[11px] transition-colors flex items-center gap-1.5"
        >
          <BeakerIcon className="w-3.5 h-3.5 text-brand-400 flex-none" />
          <span>{showSimModal ? "Ocultar simulador" : "Simular presencia"}</span>
        </button>
      </div>

      {showSimModal && (
        <div className="pt-2 border-t border-amber-500/20 grid grid-cols-2 gap-1.5 animate-fade-in">
          {ZONES.map((zone) => (
            <button
              key={zone.id}
              onClick={() => {
                setSimulatedZone(zone);
                setShowSimModal(false);
              }}
              className={`p-2 rounded-xl text-left border text-[11px] transition-colors ${
                simulatedZone?.id === zone.id
                  ? "bg-brand-500/30 border-brand-500 text-white font-semibold"
                  : "bg-surface-1 border-surface-2 text-slate-300 hover:bg-surface-2"
              }`}
            >
              <div className="truncate font-medium">{zone.name}</div>
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: zone.color || "#0284c7" }}
                />
                <span>{zone.cells.length} celdas · Puno</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
