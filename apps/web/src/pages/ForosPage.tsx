// ──────────────────────────────────────────────────────────────────────
//  V5 – Lista de foros (Iteración 5: Foros de Zonas y Temporales de Usuario)
//  Pestañas: Zonas (permanentes), Cerca de mí (descubrimiento circular), Mis foros (participación activa)
// ──────────────────────────────────────────────────────────────────────
import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  ZONES,
  FORUM_PREFIX_ZONE,
  MAX_USER_FORUMS_PER_CLIENT,
} from "@zonaviva/protocol";
import { useGeoStore } from "@/stores/geoStore";
import { useForumStore } from "@/stores/forumStore";
import { distanceMeters } from "@/geo/geoCore";
import {
  UserGroupIcon,
  ArrowRightIcon,
  PlusIcon,
  ArrowPathIcon,
  TrashIcon,
  MapPinIcon,
  MapIcon,
  ChatBubbleLeftEllipsisIcon,
  ExclamationTriangleIcon,
  BuildingStorefrontIcon,
  ShoppingCartIcon,
  BuildingLibraryIcon,
  AcademicCapIcon,
} from "@heroicons/react/24/outline";

type Tab = "zonas" | "cerca" | "guardados";

export default function ForosPage() {
  const [activeTab, setActiveTab] = useState<Tab>("zonas");
  const { 
    detectedZones, 
    simulatedZone, 
    canPublishInZone, 
    userPosition 
  } = useGeoStore();

  const {
    initNetwork,
    occupancyByForum,
    nearbyUserForums,
    myUserForums,
    isFetchingNearby,
    fetchNearbyUserForums,
    refreshMyUserForums,
    leaveUserForum,
    leaveForumPermanently,
  } = useForumStore();

  const [forumToLeave, setForumToLeave] = useState<{
    id: string;
    name: string;
    isUser?: boolean;
  } | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    initNetwork();
    refreshMyUserForums();
  }, [initNetwork, refreshMyUserForums]);

  // Cuando cambia la pestaña a "cerca", consultar foros al relay usando coordenadas actuales
  useEffect(() => {
    if (activeTab === "cerca") {
      fetchNearbyUserForums(userPosition);
    }
  }, [activeTab, userPosition, fetchNearbyUserForums]);

  // Calcular número total de notificaciones no leídas en mis foros
  const totalUnreadCount = useMemo(() => {
    return myUserForums.reduce((sum, f) => sum + (f.unreadCount || 0), 0);
  }, [myUserForums]);

  async function handleConfirmLeave() {
    if (!forumToLeave) return;
    setIsLeaving(true);
    if (forumToLeave.isUser) {
      await leaveUserForum(forumToLeave.id);
    } else {
      await leaveForumPermanently(forumToLeave.id);
    }
    setIsLeaving(false);
    setForumToLeave(null);
  }

  return (
    <div className="min-h-full bg-surface-0 pb-12">
      <div className="max-w-lg mx-auto w-full px-4 pt-4 sm:pt-6">
        {/* Cabecera */}
        <header className="mb-4 pt-safe flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Foros Locales</h1>
            <p className="text-slate-400 text-xs mt-0.5">
              Espacios de conversación geográfica y temporal en Puno
            </p>
          </div>

          <Link
            to="/foros/nuevo"
            className="flex-none px-3 py-1.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-brand-500/20 active:scale-95 transition-all"
          >
            <PlusIcon className="w-4 h-4 stroke-[2.5]" />
            <span>Crear Foro</span>
          </Link>
        </header>

        {/* Modal de confirmación: Dejar foro con regla de extinción N=0 */}
        {forumToLeave && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-surface-1 border border-surface-2 rounded-2xl p-5 max-w-sm w-full shadow-2xl">
              <div className="flex items-center gap-2 mb-2 text-red-400">
                <TrashIcon className="w-5 h-5 flex-none" />
                <h3 className="text-white font-semibold text-sm">¿Abandonar este foro?</h3>
              </div>
              <p className="text-slate-300 text-xs leading-relaxed mb-3">
                Vas a dejar de participar en <strong className="text-white">&quot;{forumToLeave.name}&quot;</strong> y se eliminará tu copia local de mensajes.
              </p>
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] mb-4 flex items-center gap-2">
                <ExclamationTriangleIcon className="w-4 h-4 text-amber-400 flex-none" />
                <span>
                  {forumToLeave.isUser
                    ? "Regla de extinción: Si eres el último participante con copia de este foro, desaparecerá permanentemente de la red."
                    : "Se eliminará tu copia local de mensajes y dejarás de servir historial P2P para esta zona."}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setForumToLeave(null)}
                  disabled={isLeaving}
                  className="flex-1 py-2 rounded-xl bg-surface-2 text-slate-300 text-xs font-semibold hover:bg-slate-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmLeave}
                  disabled={isLeaving}
                  className="flex-1 py-2 rounded-xl bg-red-500/20 text-red-300 border border-red-500/30 text-xs font-semibold hover:bg-red-500/30 transition-colors disabled:opacity-50"
                >
                  {isLeaving ? "Eliminando…" : "Sí, abandonar"}
                </button>
              </div>
            </div>
          </div>
        )}

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
            Cerca de mí ({nearbyUserForums.length})
          </button>
          <button
            onClick={() => setActiveTab("guardados")}
            className={`flex-1 pb-2.5 text-xs font-semibold border-b-2 transition-colors relative ${
              activeTab === "guardados"
                ? "border-brand-500 text-brand-400"
                : "border-transparent text-slate-400 hover:text-slate-300"
            }`}
          >
            <span>Mis foros ({myUserForums.length} / {MAX_USER_FORUMS_PER_CLIENT})</span>
            {totalUnreadCount > 0 && (
              <span className="ml-1.5 px-1.5 py-0.2 rounded-full bg-red-500 text-white text-[10px] font-bold animate-pulse">
                {totalUnreadCount}
              </span>
            )}
          </button>
        </div>

        {/* ── Pestaña 1: Zonas Permanentes ── */}
        {activeTab === "zonas" && (
          <div className="space-y-3">
            {ZONES.map((zone) => {
              const forumId = `zone:${zone.id}`;
              const isHere = Boolean(
                simulatedZone?.id === zone.id ||
                detectedZones.some((z) => z.id === zone.id) ||
                canPublishInZone(zone.id)
              );
              const onlineCount = occupancyByForum[forumId] ?? 0;
              const renderZoneIcon = () => {
                const cls = "w-5 h-5 text-brand-400";
                switch (zone.id) {
                  case "mercado-central":
                  case "mercado-union":
                    return <BuildingStorefrontIcon className={cls} />;
                  case "mercado-bellavista":
                    return <ShoppingCartIcon className={cls} />;
                  case "plaza-mayor":
                    return <BuildingLibraryIcon className={cls} />;
                  case "unap-campus":
                    return <AcademicCapIcon className={cls} />;
                  default:
                    return <MapPinIcon className={cls} />;
                }
              };

              return (
                <Link
                  key={zone.id}
                  to={`/foro/${forumId}`}
                  className="block p-4 rounded-2xl bg-surface-1 border border-surface-2 hover:border-brand-500/40 hover:bg-surface-1/90 transition-all shadow-sm group"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-brand-500/15 flex items-center justify-center flex-none">
                        {renderZoneIcon()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full flex-none"
                            style={{ backgroundColor: zone.color || "#0284c7" }}
                          />
                          <h3 className="font-semibold text-white text-sm group-hover:text-brand-300 transition-colors">
                            {zone.name}
                          </h3>
                        </div>
                        <span className="text-[11px] text-slate-400">
                          Foro geográfico permanente · {zone.cells.length} celdas
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
                        Solo lectura (fuera de zona)
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

        {/* ── Pestaña 2: Foros Temporales Cerca de Mí ── */}
        {activeTab === "cerca" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 px-1 mb-1">
              <span className="text-slate-400 text-xs">
                Foros creados por vecinos activos alrededor de tu ubicación
              </span>
              <button
                type="button"
                onClick={() => fetchNearbyUserForums(userPosition)}
                disabled={isFetchingNearby}
                className="flex items-center gap-1.5 text-xs text-brand-400 hover:text-brand-300 bg-surface-1 border border-surface-2 px-2.5 py-1.5 rounded-xl font-medium transition-colors disabled:opacity-50"
              >
                <ArrowPathIcon
                  className={`w-3.5 h-3.5 ${isFetchingNearby ? "animate-spin" : ""}`}
                />
                <span>Actualizar foros cercanos</span>
              </button>
            </div>

            {!userPosition ? (
              <div className="text-center py-10 px-4 rounded-2xl bg-surface-1 border border-surface-2">
                <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                  <MapPinIcon className="w-6 h-6 text-amber-400" />
                </div>
                <h3 className="font-semibold text-white text-base mb-1">
                  Ubicación GPS no disponible
                </h3>
                <p className="text-slate-400 text-xs max-w-xs mx-auto mb-4 leading-relaxed">
                  Activa tu señal GPS o activa el modo simulación en Inicio para descubrir los foros temporales a tu alrededor.
                </p>
                <Link
                  to="/"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold hover:bg-amber-500/30 transition-colors"
                >
                  <MapPinIcon className="w-4 h-4" />
                  <span>Configurar ubicación en Inicio</span>
                </Link>
              </div>
            ) : nearbyUserForums.length === 0 ? (
              <div className="text-center py-10 px-4 rounded-2xl bg-surface-1 border border-surface-2">
                <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-brand-500/10 text-brand-400 flex items-center justify-center">
                  <MapIcon className="w-7 h-7 text-brand-400" />
                </div>
                <h3 className="font-semibold text-white text-base mb-1">
                  Sin foros temporales activos aquí
                </h3>
                <p className="text-slate-400 text-xs max-w-xs mx-auto mb-4 leading-relaxed">
                  No hay foros con participantes activos en tu ubicación actual. ¡Crea el primer foro en este lugar!
                </p>
                <Link
                  to="/foros/nuevo"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-400 text-white text-xs font-bold transition-all shadow-md shadow-brand-500/20"
                >
                  <PlusIcon className="w-4 h-4 stroke-[2.5]" />
                  <span>Crear Foro Aquí</span>
                </Link>
              </div>
            ) : (
              nearbyUserForums.map((forum) => {
                const isInside = Boolean(
                  userPosition &&
                    distanceMeters(
                      userPosition.latitude,
                      userPosition.longitude,
                      forum.latitude,
                      forum.longitude
                    ) <=
                      forum.radius + 50
                );

                return (
                  <Link
                    key={forum.id}
                    to={`/foro/${forum.id}`}
                    className="block p-4 rounded-2xl bg-surface-1 border border-surface-2 hover:border-brand-500/40 hover:bg-surface-1/90 transition-all shadow-sm group"
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-slate-800 text-slate-300 border border-surface-2 flex items-center justify-center flex-none">
                          <ChatBubbleLeftEllipsisIcon className="w-4 h-4 text-slate-300" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-white text-sm group-hover:text-brand-300 transition-colors">
                            {forum.name}
                          </h3>
                          <span className="text-[11px] text-slate-400">
                            Foro temporal de usuario
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 bg-surface-2/60 px-2 py-0.5 rounded-full flex-none">
                        <UserGroupIcon className="w-3.5 h-3.5 text-slate-300" />
                        <span>{forum.participantCount || 1} activos</span>
                      </div>
                    </div>

                    {forum.description && (
                      <p className="text-slate-300/80 text-xs mb-3 line-clamp-2">
                        {forum.description}
                      </p>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-surface-2/50 text-xs">
                      {isInside ? (
                        <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                          Estás dentro (puedes publicar)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-slate-400">
                          <span className="w-2 h-2 rounded-full bg-slate-500"></span>
                          Solo lectura (fuera del ámbito)
                        </span>
                      )}

                      <span className="text-brand-400 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform font-medium">
                        Entrar <ArrowRightIcon className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        )}

        {/* ── Pestaña 3: Mis Foros (Participación Activa) ── */}
        {activeTab === "guardados" && (
          <div className="space-y-4">
            {/* Sección: Foros Temporales de Usuario en los que participo */}
            <div>
              <div className="flex items-center justify-between px-1 mb-2">
                <span className="text-xs font-bold text-slate-300">
                  Foros en los que participas ({myUserForums.length} / {MAX_USER_FORUMS_PER_CLIENT})
                </span>
                <span className="text-[11px] text-slate-500">
                  Historial local en tu dispositivo
                </span>
              </div>

              {myUserForums.length === 0 ? (
                <div className="text-center py-8 px-4 rounded-2xl bg-surface-1 border border-surface-2 mb-4">
                  <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-surface-2 text-slate-400 flex items-center justify-center">
                    <ChatBubbleLeftEllipsisIcon className="w-5 h-5 text-slate-400" />
                  </div>
                  <h4 className="font-semibold text-white text-xs mb-1">
                    No participas en ningún foro todavía
                  </h4>
                  <p className="text-slate-400 text-[11px] max-w-xs mx-auto mb-3">
                    La participación se activa automáticamente cuando guardas al menos un mensaje en un foro de zona o temporal.
                  </p>
                  <Link
                    to="/foros/nuevo"
                    className="inline-flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 font-semibold"
                  >
                    <PlusIcon className="w-3.5 h-3.5" />
                    <span>Crear un nuevo foro</span>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3 mb-5">
                  {myUserForums.map((forum) => {
                    const isUser = forum.type === "user" || forum.id.startsWith("user:");
                    const isZone = !isUser;
                    const targetZoneId = isZone && forum.id.startsWith(FORUM_PREFIX_ZONE)
                      ? forum.id.slice(FORUM_PREFIX_ZONE.length)
                      : "";

                    const isInside = isZone
                      ? Boolean(
                          simulatedZone?.id === targetZoneId ||
                          detectedZones.some((z) => z.id === targetZoneId) ||
                          canPublishInZone(targetZoneId)
                        )
                      : Boolean(
                          userPosition &&
                            forum.latitude &&
                            forum.longitude &&
                            forum.radius &&
                            distanceMeters(
                              userPosition.latitude,
                              userPosition.longitude,
                              forum.latitude,
                              forum.longitude
                            ) <=
                              forum.radius + 50
                        );

                    return (
                      <div
                        key={forum.id}
                        className="p-4 rounded-2xl bg-surface-1 border border-surface-2 hover:border-brand-500/30 transition-all shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-white text-sm truncate">
                                {forum.name}
                              </h3>
                              {forum.unreadCount > 0 && (
                                <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 text-[10px] font-bold animate-pulse flex items-center gap-1.5 flex-none">
                                  <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse flex-none" />
                                  <span>{forum.unreadCount} nuevos</span>
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                  isZone
                                    ? "bg-brand-500/15 text-brand-300 border border-brand-500/30"
                                    : "bg-purple-500/15 text-purple-300 border border-purple-500/30"
                                }`}
                              >
                                {isZone ? "Zona permanente" : "Foro temporal"}
                              </span>
                              <span className="text-[11px] text-slate-400">
                                {forum.messageCount}{" "}
                                {forum.messageCount === 1 ? "mensaje guardado" : "mensajes guardados"}
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              setForumToLeave({ id: forum.id, name: forum.name, isUser })
                            }
                            className="p-1.5 rounded-xl bg-surface-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors flex-none"
                            title="Dejar de participar y eliminar copia local"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>

                        {forum.description && (
                          <p className="text-slate-300/80 text-xs mb-3 line-clamp-2">
                            {forum.description}
                          </p>
                        )}

                        <div className="flex items-center justify-between pt-2 border-t border-surface-2/50 text-xs">
                          {isInside ? (
                            <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium">
                              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                              Estás dentro (puedes publicar)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-slate-400">
                              <span className="w-2 h-2 rounded-full bg-slate-500"></span>
                              Solo lectura (fuera del ámbito)
                            </span>
                          )}

                          <Link
                            to={`/foro/${forum.id}`}
                            className="text-brand-400 flex items-center gap-1 hover:translate-x-0.5 transition-transform font-medium"
                          >
                            Entrar al chat <ArrowRightIcon className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
