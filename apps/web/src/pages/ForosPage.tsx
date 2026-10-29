// ──────────────────────────────────────────────────────────────────────
//  V3 – Lista de foros (Iteración 2)
//  Pestañas: Zonas (permanentes), Cerca de mí (usuario), Mis foros
// ──────────────────────────────────────────────────────────────────────
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ZONES } from "@zonaviva/protocol";
import { useGeoStore } from "@/stores/geoStore";
import { useForumStore } from "@/stores/forumStore";
import {
  UserGroupIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";

type Tab = "zonas" | "cerca" | "guardados";

export default function ForosPage() {
  const [activeTab, setActiveTab] = useState<Tab>("zonas");
  const { currentZone } = useGeoStore();
  const { initNetwork, occupancyByForum } = useForumStore();

  useEffect(() => {
    initNetwork();
  }, [initNetwork]);

  return (
    <div className="min-h-full bg-surface-0 pb-12">
      <div className="max-w-lg mx-auto w-full px-4 pt-4 sm:pt-6">
        {/* Cabecera */}
        <header className="mb-4 pt-safe">
          <h1 className="text-2xl font-bold text-white tracking-tight">Foros Locales</h1>
          <p className="text-slate-400 text-xs mt-0.5">
            Salas de conversación anónimas vinculadas a lugares reales en Puno
          </p>
        </header>

        {/* Pestañas de navegación */}
        <div className="flex border-b border-surface-2 mb-4">
          <button
            onClick={() => setActiveTab("zonas")}
            className={`flex-1 pb-2.5 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === "zonas"
                ? "border-brand-500 text-brand-400"
                : "border-transparent text-slate-400 hover:text-slate-300"
            }`}
          >
            Zonas ({ZONES.length})
          </button>
          <button
            onClick={() => setActiveTab("cerca")}
            className={`flex-1 pb-2.5 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === "cerca"
                ? "border-brand-500 text-brand-400"
                : "border-transparent text-slate-400 hover:text-slate-300"
            }`}
          >
            Cerca de mí
          </button>
          <button
            onClick={() => setActiveTab("guardados")}
            className={`flex-1 pb-2.5 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === "guardados"
                ? "border-brand-500 text-brand-400"
                : "border-transparent text-slate-400 hover:text-slate-300"
            }`}
          >
            Mis foros
          </button>
        </div>

        {/* ── Contenido según pestaña activa ── */}
        {activeTab === "zonas" && (
          <div className="space-y-3">
            {ZONES.map((zone) => {
              const forumId = `zone:${zone.id}`;
              const isHere = currentZone?.id === zone.id;
              const onlineCount = occupancyByForum[forumId] ?? 1;
              const isTest = zone.id === "puno-laureles";

              return (
                <Link
                  key={zone.id}
                  to={`/foro/${forumId}`}
                  className="block p-4 rounded-2xl bg-surface-1 border border-surface-2 hover:border-brand-500/40 hover:bg-surface-1/90 transition-all shadow-sm group"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-xl bg-brand-500/15 text-brand-400 flex items-center justify-center flex-none">
                        <span className="text-lg">{isTest ? "🧪" : "📍"}</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-white text-sm group-hover:text-brand-300 transition-colors">
                            {zone.name}
                          </h3>
                          {isTest && (
                            <span className="text-[10px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded border border-purple-500/30">
                              Pruebas
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400">
                          Foro geográfico permanente
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 text-[11px] text-slate-400 bg-surface-2/60 px-2 py-0.5 rounded-full flex-none">
                      <UserGroupIcon className="w-3.5 h-3.5 text-slate-300" />
                      <span>{onlineCount} en sala</span>
                    </div>
                  </div>

                  <p className="text-slate-300/80 text-xs mb-3 line-clamp-2">
                    {zone.description}
                  </p>

                  <div className="flex items-center justify-between pt-2 border-t border-surface-2/50 text-xs">
                    {isHere ? (
                      <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                        Estás dentro (puedes publicar)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-slate-400">
                        <span className="w-2 h-2 rounded-full bg-slate-500"></span>
                        Solo lectura (debes estar en la zona para publicar)
                      </span>
                    )}

                    <span className="text-brand-400 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform font-medium">
                      Entrar <ArrowRightIcon className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {activeTab === "cerca" && (
          <div className="text-center py-12 px-4 rounded-2xl bg-surface-1 border border-surface-2">
            <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-brand-500/10 text-brand-400 flex items-center justify-center text-2xl">
              🗺️
            </div>
            <h3 className="font-semibold text-white text-base mb-1">
              Foros comunitarios por celda geohash
            </h3>
            <p className="text-slate-400 text-xs max-w-xs mx-auto mb-4">
              Esta función permite crear foros efímeros en tu cuadra o barrio. Estará disponible en la Iteración 5 del plan.
            </p>
            <button
              onClick={() => setActiveTab("zonas")}
              className="px-4 py-2 rounded-xl bg-surface-2 text-slate-200 text-xs font-semibold hover:bg-slate-700 transition-colors"
            >
              Explorar Zonas Permanentes
            </button>
          </div>
        )}

        {activeTab === "guardados" && (
          <div className="text-center py-12 px-4 rounded-2xl bg-surface-1 border border-surface-2">
            <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center text-2xl">
              💾
            </div>
            <h3 className="font-semibold text-white text-base mb-1">
              Historial local en IndexedDB
            </h3>
            <p className="text-slate-400 text-xs max-w-xs mx-auto mb-4">
              Los foros que visites guardarán copia localmente en tu dispositivo a partir de la Iteración 3 (Persistencia y Sincronización).
            </p>
            <button
              onClick={() => setActiveTab("zonas")}
              className="px-4 py-2 rounded-xl bg-surface-2 text-slate-200 text-xs font-semibold hover:bg-slate-700 transition-colors"
            >
              Ver Zonas Disponibles
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
