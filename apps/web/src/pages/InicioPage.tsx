// ──────────────────────────────────────────────────────────────────────
//  V2 – Inicio: Mapa discreto y vista principal de zona (Iteración 2)
//  Interfaz mejorada: mapa contenido, no invasivo y centrado en la acción.
// ──────────────────────────────────────────────────────────────────────
import { useState, Suspense, lazy } from "react";
import { Link } from "react-router-dom";
import { useGeoStore } from "@/stores/geoStore";
import { useIdentityStore } from "@/stores/identityStore";
import { ZONES } from "@zonaviva/protocol";
import GeoPermissionBanner from "@/components/GeoPermissionBanner";
import ZoneSelector from "@/components/ZoneSelector";
import StatusDot from "@/components/StatusDot";
import {
  ChatBubbleLeftRightIcon,
  MapPinIcon,
  ChevronRightIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";

// Carga diferida del mapa
const ZoneMap = lazy(() => import("@/components/ZoneMap"));

export default function InicioPage() {
  const { permission, status, currentZone, manualZone, setManualZone } = useGeoStore();
  const { session } = useIdentityStore();
  const [showZoneSelector, setShowZoneSelector] = useState(false);
  const [mapExpanded, setMapExpanded] = useState(false);

  const effectiveZone = manualZone ?? currentZone;
  const isManual = Boolean(manualZone);
  const isPhysicallyInside = Boolean(currentZone && currentZone.id === effectiveZone?.id);

  return (
    <div className="min-h-full bg-surface-0 pb-12">
      <div className="max-w-lg mx-auto w-full px-4 pt-4 sm:pt-6">
        {/* Cabecera estilizada */}
        <header className="flex items-center justify-between mb-4 pt-safe">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-brand-400 flex items-center justify-center shadow-lg shadow-brand-500/20">
              <span className="text-lg">📍</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white tracking-tight text-lg">ZonaViva</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-300 border border-brand-500/30">
                  Puno MVP
                </span>
              </div>
              <p className="text-slate-400 text-xs">Red social geográfica local</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/ajustes"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-1 border border-surface-2 text-xs hover:border-slate-500 transition-colors"
            >
              <span className="w-2 h-2 rounded-full bg-brand-400"></span>
              <span className="font-medium text-slate-200 max-w-[110px] truncate">
                {session?.alias || "Anónimo"}
              </span>
            </Link>
            <StatusDot status={status} />
          </div>
        </header>

        {/* Banner de permisos GPS si está denegado */}
        {(permission === "denied" || permission === "unavailable") && (
          <div className="mb-4">
            <GeoPermissionBanner permission={permission} />
          </div>
        )}

        {/* ── Tarjeta Principal de Zona Activa ── */}
        <section className="mb-4 bg-gradient-to-b from-surface-1 to-surface-1/90 rounded-2xl border border-surface-2/80 p-4 shadow-xl">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div>
              <div className="flex items-center gap-2 mb-1">
                {isPhysicallyInside ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    Estás aquí (publicación habilitada)
                  </span>
                ) : isManual ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                    Modo exploración (solo lectura)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-500/20 text-slate-300 border border-slate-500/30">
                    Fuera de zonas piloto
                  </span>
                )}
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight">
                {effectiveZone ? effectiveZone.name : "Detectando ubicación..."}
              </h2>
            </div>

            {isManual && (
              <button
                onClick={() => setManualZone(null)}
                className="text-xs text-slate-400 hover:text-white bg-surface-2/70 px-2.5 py-1 rounded-lg border border-surface-2 transition-colors flex items-center gap-1"
                title="Volver a mi GPS"
              >
                Volver al GPS
              </button>
            )}
          </div>

          <p className="text-slate-300/80 text-xs leading-relaxed mb-4">
            {effectiveZone
              ? effectiveZone.description
              : "Obteniendo coordenadas del dispositivo para vincularte a tu zona local más cercana en Puno."}
          </p>

          {/* Botón de acceso directo al foro de la zona */}
          {effectiveZone ? (
            <Link
              to={`/foro/zone:${effectiveZone.id}`}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-brand-500 hover:bg-brand-400 text-white font-semibold text-sm transition-all shadow-lg shadow-brand-500/25 active:scale-[0.99]"
            >
              <div className="flex items-center gap-2">
                <ChatBubbleLeftRightIcon className="w-5 h-5 text-white" />
                <span>
                  {isPhysicallyInside
                    ? "Entrar y conversar en el foro"
                    : "Ver mensajes de este foro"}
                </span>
              </div>
              <ChevronRightIcon className="w-4 h-4 text-white/80" />
            </Link>
          ) : (
            <button
              onClick={() => setShowZoneSelector(true)}
              className="w-full py-3 rounded-xl bg-surface-2 hover:bg-surface-2/80 text-slate-200 font-medium text-sm transition-colors"
            >
              Seleccionar zona manualmente
            </button>
          )}
        </section>

        {/* ── Contenedor del Mapa Discreto y Compacto ── */}
        <section className="mb-4">
          <div className="flex items-center justify-between mb-2 px-1">
            <div className="flex items-center gap-1.5">
              <MapPinIcon className="w-4 h-4 text-brand-400" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Mapa Geográfico
              </h3>
            </div>
            <button
              onClick={() => setMapExpanded((prev) => !prev)}
              className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-brand-300 transition-colors"
            >
              {mapExpanded ? (
                <>
                  <ArrowsPointingInIcon className="w-3.5 h-3.5" />
                  <span>Compacto</span>
                </>
              ) : (
                <>
                  <ArrowsPointingOutIcon className="w-3.5 h-3.5" />
                  <span>Expandir</span>
                </>
              )}
            </button>
          </div>

          <div
            className={`w-full rounded-2xl overflow-hidden border border-surface-2 bg-surface-1 shadow-lg relative transition-all duration-300 ${
              mapExpanded ? "h-80" : "h-48"
            }`}
          >
            {/* Overlay discreto de ubicación */}
            <div className="absolute top-2.5 left-2.5 z-[400] bg-surface-0/80 backdrop-blur-md px-2.5 py-1 rounded-lg border border-surface-2 text-[11px] text-slate-300 flex items-center gap-1.5 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-brand-400 animate-pulse"></span>
              <span>Puno, Perú · 4 zonas</span>
            </div>

            <Suspense
              fallback={
                <div className="flex items-center justify-center h-full text-slate-500 text-xs">
                  Cargando mapa discreto…
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
        </section>

        {/* ── Selector Rápido de Zonas de Puno ── */}
        <section className="mb-6">
          <div className="flex items-center justify-between mb-2 px-1">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Zonas Permanentes
            </h3>
            <button
              onClick={() => setShowZoneSelector(true)}
              className="text-xs text-brand-400 hover:underline"
            >
              Ver todas
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {ZONES.map((zone) => {
              const isSelected = effectiveZone?.id === zone.id;
              const isTestZone = zone.id === "puno-laureles";

              return (
                <button
                  key={zone.id}
                  onClick={() => setManualZone(zone)}
                  className={`flex flex-col text-left p-3 rounded-xl border transition-all ${
                    isSelected
                      ? "bg-brand-500/15 border-brand-500/50 shadow-md shadow-brand-500/10"
                      : "bg-surface-1 border-surface-2 hover:border-surface-2/80 hover:bg-surface-1/80"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-base">{isTestZone ? "🧪" : "📍"}</span>
                    {isSelected && (
                      <span className="text-[10px] font-bold text-brand-400 bg-brand-400/10 px-1.5 py-0.5 rounded">
                        Activa
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-semibold text-white truncate w-full">
                    {zone.name}
                  </span>
                  <span className="text-[10px] text-slate-400 truncate w-full">
                    {zone.type === "circle" ? `Radio: ${zone.radiusMeters}m` : "Polígono"}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Accesos Rápidos: Foros y Chat 1 a 1 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <Link
            to="/foros"
            className="bg-surface-1/60 hover:bg-surface-1 border border-surface-2/60 hover:border-surface-2 rounded-2xl p-4 flex items-center justify-between transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-500/20 text-brand-300 flex items-center justify-center flex-none">
                <ChatBubbleLeftRightIcon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-white group-hover:text-brand-300 transition-colors">
                  Directorio de Foros
                </p>
                <p className="text-[10px] text-slate-400">Salas por zona geográfica</p>
              </div>
            </div>
            <ChevronRightIcon className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" />
          </Link>

          <Link
            to="/chat"
            className="bg-surface-1/60 hover:bg-surface-1 border border-surface-2/60 hover:border-purple-500/40 rounded-2xl p-4 flex items-center justify-between transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center flex-none">
                <SparklesIcon className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-semibold text-white group-hover:text-purple-300 transition-colors">
                    Chat 1 a 1 Efímero
                  </p>
                  <span className="text-[9px] px-1 py-0.2 rounded bg-purple-500/20 text-purple-300 font-bold">
                    E2EE
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">Conversa sin dejar rastro</p>
              </div>
            </div>
            <ChevronRightIcon className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" />
          </Link>
        </div>
      </div>

      {/* Modal selector de zona completo */}
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
