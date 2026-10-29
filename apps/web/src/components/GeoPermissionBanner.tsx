// Banner cuando el permiso de GPS está denegado o no disponible
import type { GeoPermission } from "@/stores/geoStore";

interface Props {
  permission: GeoPermission;
}

export default function GeoPermissionBanner({ permission }: Props) {
  if (permission === "granted") return null;

  return (
    <div className="px-4 py-3 bg-amber-500/10 border-b border-amber-500/20">
      {permission === "denied" ? (
        <div className="flex items-start gap-2 text-amber-300 text-sm">
          <span className="flex-none mt-0.5">📵</span>
          <div>
            <p className="font-medium">Permiso de ubicación denegado</p>
            <p className="text-amber-400/80 text-xs mt-0.5">
              Para detectar tu zona automáticamente, permite el acceso en los ajustes de tu navegador.
              Puedes explorar zonas manualmente sin GPS.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-2 text-slate-400 text-sm">
          <span className="flex-none mt-0.5">🌐</span>
          <p>GPS no disponible en este dispositivo. Puedes explorar zonas manualmente.</p>
        </div>
      )}
    </div>
  );
}
