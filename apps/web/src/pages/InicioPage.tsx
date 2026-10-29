// ──────────────────────────────────────────────────────────────────────
//  V2 – Inicio: mapa + zona detectada
// ──────────────────────────────────────────────────────────────────────
import { useState, Suspense, lazy } from "react";
import { useGeoStore } from "@/stores/geoStore";
import { useIdentityStore } from "@/stores/identityStore";
import { ZONES } from "@zonaviva/protocol";
import type { Zone } from "@zonaviva/protocol";
import GeoPermissionBanner from "@/components/GeoPermissionBanner";
import ZoneSelector from "@/components/ZoneSelector";
import StatusDot from "@/components/StatusDot";

// Carga diferida del mapa para no bloquear el bundle inicial
const ZoneMap = lazy(() => import("@/components/ZoneMap"));

export default function InicioPage() {
  const { permission, status, currentZone, manualZone, setManualZone } = useGeoStore();
  const { session } = useIdentityStore();
  const [showZoneSelector, setShowZoneSelector] = useState(false);

  const effectiveZone = manualZone ?? currentZone;
  const isManual = Boolean(manualZone);

  return (
    <div className="flex flex-col h-full bg-surface-0">
      {/* Cabecera */}
      <header className="flex-none px-4 pt-4 pb-2 pt-safe">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-xl font-bold text-white">ZonaViva</h1>
          <StatusDot status={status} />
        </div>
        <p className="text-slate-400 text-sm">
          Hola, <span className="text-brand-400 font-medium">{session?.alias}</span>
        </p>
      </header>

      {/* Banner si el GPS está denegado o no disponible */}
      {(permission === "denied" || permission === "unavailable") && (
        <GeoPermissionBanner permission={permission} />
      )}

      {/* Mapa */}
      <div className="flex-1 relative overflow-hidden">
        <Suspense
          fallback={
            <div className="flex items-center justify-center h-full text-slate-500">
              Cargando mapa…
            </div>
          }
        >
          <ZoneMap
            zones={ZONES}
            activeZone={effectiveZone}
            onZoneClick={(zone) => {
              setManualZone(zone.id === effectiveZone?.id ? null : zone);
            }}
          />
        </Suspense>
      </div>

      {/* Panel de zona inferior */}
      <div className="flex-none p-4 bg-surface-1 border-t border-surface-2">
        {effectiveZone ? (
          <ZoneCard
            zone={effectiveZone}
            isManual={isManual}
            onClearManual={() => setManualZone(null)}
          />
        ) : (
          <NoZoneCard status={status} />
        )}

        <button
          onClick={() => setShowZoneSelector(true)}
          className="mt-3 w-full py-2.5 rounded-xl border border-surface-2 text-slate-300 hover:bg-surface-2 transition-colors text-sm font-medium"
        >
          {isManual ? "🗺️ Cambia de zona" : "🔍 Explorar otra zona"}
        </button>
      </div>

      {/* Selector de zona manual */}
      {showZoneSelector && (
        <ZoneSelector
          zones={ZONES}
          selected={effectiveZone}
          onSelect={(zone) => {
            setManualZone(zone);
            setShowZoneSelector(false);
          }}
          onClose={() => setShowZoneSelector(false)}
        />
      )}
    </div>
  );
}

// ── Subcomponentes ────────────────────────────────────────────────────

function ZoneCard({
  zone, isManual, onClearManual,
}: {
  zone: Zone;
  isManual: boolean;
  onClearManual: () => void;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-10 h-10 rounded-xl bg-brand-500/20 flex items-center justify-center flex-none">
        <span className="text-xl">📍</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-white truncate">{zone.name}</p>
          {isManual && (
            <span className="text-xs bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full flex-none">
              exploración
            </span>
          )}
        </div>
        <p className="text-slate-400 text-xs truncate">{zone.description}</p>
      </div>
      {isManual && (
        <button
          onClick={onClearManual}
          className="flex-none text-slate-500 hover:text-white transition-colors text-sm"
          title="Volver a mi zona GPS"
        >
          ✕
        </button>
      )}
    </div>
  );
}

function NoZoneCard({ status }: { status: string }) {
  const isLoading = status === "requesting" || status === "idle";
  return (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-surface-2 flex items-center justify-center flex-none">
        <span className="text-xl">{isLoading ? "⏳" : "🌐"}</span>
      </div>
      <div>
        <p className="font-medium text-white">
          {isLoading ? "Detectando tu zona…" : "Fuera de zonas"}
        </p>
        <p className="text-slate-400 text-xs">
          {isLoading
            ? "Obteniendo ubicación GPS"
            : "No estás en ninguna zona piloto. Puedes explorar manualmente."}
        </p>
      </div>
    </div>
  );
}
