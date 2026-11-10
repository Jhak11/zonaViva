// ──────────────────────────────────────────────────────────────────────
//  V5 – Foro individual en tiempo real (Zonas fijas y Foros de Usuario)
//  Iteración 5: Ámbito circular para foros de usuario, solo lectura fuera
//  del radio, notificaciones locales y regla de extinción P2P N=0.
// ──────────────────────────────────────────────────────────────────────
import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ZONES_BY_ID,
  FORUM_PREFIX_ZONE,
  FORUM_PREFIX_USER,
  MAX_MESSAGE_LENGTH,
} from "@zonaviva/protocol";
import type { Forum, TemporaryForum } from "@zonaviva/protocol";
import { useGeoStore } from "@/stores/geoStore";
import { useIdentityStore } from "@/stores/identityStore";
import { useForumStore } from "@/stores/forumStore";
import { db } from "@/db";
import { distanceMeters } from "@/geo/geoCore";
import { joinUserForumNetwork } from "@/modules/network";
import { saveUserForum, markForumAsRead } from "@/db/storage";
import { AuthorProfileModal } from "@/components/AuthorProfileModal";
import {
  ArrowLeftIcon,
  UserGroupIcon,
  PaperAirplaneIcon,
  LockClosedIcon,
  CheckBadgeIcon,
  ShieldCheckIcon,
  ClockIcon,
  CloudArrowUpIcon,
  TrashIcon,
  BeakerIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  ChatBubbleLeftEllipsisIcon,
} from "@heroicons/react/24/outline";

export default function ForoPage() {
  const { id } = useParams<{ id: string }>();
  const forumId = id || "";
  const navigate = useNavigate();

  const {
    simulatedZone,
    simulatedCoordinates,
    setSimulatedZone,
    setSimulatedCoordinates,
    clearSimulation,
    isSimulating,
    userPosition,
    detectedZones,
    canPublishInZone,
  } = useGeoStore();
  const { session } = useIdentityStore();
  const {
    messages,
    outboxMessages,
    occupancy,
    syncStatus,
    enterForum,
    leaveCurrentForum,
    leaveForumPermanently,
    leaveUserForum,
    publishMessage,
    flushOutbox,
    isSending,
    networkConnected,
    error,
    myUserForums,
    nearbyUserForums,
  } = useForumStore();

  const [inputContent, setInputContent] = useState("");
  const [localNotice, setLocalNotice] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [leaveStep, setLeaveStep] = useState<"choose" | "confirm-forum" | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);
  const [userForumMeta, setUserForumMeta] = useState<Forum | TemporaryForum | null>(null);
  const [selectedAuthor, setSelectedAuthor] = useState<{ authorKey: string; authorAlias: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const isZoneForum = forumId.startsWith(FORUM_PREFIX_ZONE);
  const isUserForum = forumId.startsWith(FORUM_PREFIX_USER);
  const zoneId = isZoneForum ? forumId.slice(FORUM_PREFIX_ZONE.length) : "";
  const zone = ZONES_BY_ID[zoneId];

  // Recuperar metadatos de foro de usuario si corresponde
  useEffect(() => {
    if (!isUserForum) return;

    let mounted = true;

    // 1. Buscar en store
    const inMy = myUserForums.find((f) => f.id === forumId);
    if (inMy) {
      setUserForumMeta(inMy);
      return;
    }

    const inNearby = nearbyUserForums.find((f) => f.id === forumId);
    if (inNearby) {
      setUserForumMeta(inNearby);
      // Guardar en Dexie como participante activo y notificar relay
      saveUserForum(inNearby, true).catch(() => {});
      joinUserForumNetwork(forumId).catch(() => {});
      return;
    }

    // 2. Buscar en base de datos local IndexedDB
    db.forums
      .get(forumId)
      .then((record) => {
        if (mounted && record) {
          setUserForumMeta(record);
        }
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, [forumId, isUserForum, myUserForums, nearbyUserForums]);

  // Cálculo de presencia física según el tipo de foro:
  // - Para zonas permanentes: estar dentro de la celda de la zona (o simulación activa)
  // - Para foros de usuario: estar dentro del radio circular (con tolerancia GPS o simulación activa)
  const isPhysicallyInside = useMemo(() => {
    if (isZoneForum) {
      if (simulatedZone?.id === zoneId) return true;
      if (detectedZones.some((z) => z.id === zoneId)) return true;
      return canPublishInZone(zoneId);
    }

    if (isUserForum && userForumMeta) {
      if (!userPosition || !userForumMeta.latitude || !userForumMeta.longitude || !userForumMeta.radius) {
        return false;
      }
      const dist = distanceMeters(
        userPosition.latitude,
        userPosition.longitude,
        userForumMeta.latitude,
        userForumMeta.longitude
      );
      return dist <= userForumMeta.radius + 50; // tolerancia de precisión GPS
    }

    return false;
  }, [
    isZoneForum,
    isUserForum,
    zoneId,
    simulatedZone,
    detectedZones,
    canPublishInZone,
    userForumMeta,
    userPosition,
  ]);

  // Unirse al foro y cargar copias locales de IndexedDB al montar
  useEffect(() => {
    if (forumId) {
      const forumDisplayName = isZoneForum ? zone?.name : userForumMeta?.name ?? forumId;
      enterForum(forumId, forumDisplayName);
      markForumAsRead(forumId).catch(() => {});
    }
    return () => {
      // Al desmontar, solo limpiamos el estado en memoria (no salimos del relay)
      leaveCurrentForum();
    };
  }, [forumId, isZoneForum, zone?.name, userForumMeta?.name, enterForum, leaveCurrentForum]);

  // Si reconecta y hay mensajes en outbox, vaciar bandeja de salida
  useEffect(() => {
    if (networkConnected && session && outboxMessages.length > 0) {
      flushOutbox(session);
    }
  }, [networkConnected, session, outboxMessages.length, flushOutbox]);

  // Scroll automático hacia el mensaje más reciente
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, outboxMessages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);
    setLocalNotice(null);

    if (!session) {
      setLocalError("No hay sesión activa.");
      return;
    }

    if (!inputContent.trim()) return;

    if (!isPhysicallyInside) {
      setLocalError(
        isZoneForum
          ? "Solo lectura: debes estar dentro de la zona física para publicar."
          : "Solo lectura: debes estar dentro del ámbito físico del foro para poder publicar."
      );
      return;
    }

    const physicalZoneToSend = isZoneForum ? zone : (simulatedZone ?? detectedZones[0] ?? null);
    const res = await publishMessage(
      inputContent,
      session,
      physicalZoneToSend,
      isPhysicallyInside
    );

    if (res.success) {
      setInputContent("");
      if (res.queued) {
        setLocalNotice("Mensaje guardado en bandeja local. Se transmitirá al reconectar.");
      }
    } else if (res.error) {
      setLocalError(res.error);
    }
  }

  /** Salir del chat — mantiene copia y suscripción */
  function handleLeaveChat() {
    leaveCurrentForum();
    navigate("/foros");
  }

  /** Salir del foro permanentemente — borra todo lo local y aplica regla de extinción si es de usuario */
  async function handleLeaveForum() {
    setIsLeaving(true);
    if (isUserForum) {
      await leaveUserForum(forumId);
    } else {
      await leaveForumPermanently(forumId);
    }
    setIsLeaving(false);
    setLeaveStep(null);
    navigate("/foros");
  }

  const displayName = isZoneForum
    ? zone?.name || forumId
    : userForumMeta?.name || forumId;

  const remainingChars = MAX_MESSAGE_LENGTH - inputContent.length;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-surface-0">
      {/* ── Modal de confirmación: Salir del foro ── */}
      {leaveStep && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-surface-1 border border-surface-2 rounded-2xl p-5 max-w-sm w-full shadow-2xl">
            {leaveStep === "choose" ? (
              <>
                <h3 className="text-white font-semibold text-sm mb-1">¿Cómo quieres salir?</h3>
                <p className="text-slate-400 text-xs leading-relaxed mb-4">
                  Puedes dejar el chat y seguir conservando el historial como participante, o salir permanentemente y borrar tu copia local.
                </p>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={handleLeaveChat}
                    className="w-full py-2.5 rounded-xl bg-surface-2 text-slate-100 text-xs font-semibold hover:bg-slate-700 transition-colors text-left px-3"
                  >
                    Salir del chat
                    <span className="block font-normal text-slate-400 mt-0.5">
                      Mantiene tu copia y sigues conectado como nodo de la comunidad.
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeaveStep("confirm-forum")}
                    className="w-full py-2.5 rounded-xl bg-red-500/15 text-red-300 border border-red-500/30 text-xs font-semibold hover:bg-red-500/25 transition-colors text-left px-3"
                  >
                    Salir del foro
                    <span className="block font-normal text-red-300/80 mt-0.5">
                      Borra todos los mensajes locales de este foro.
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeaveStep(null)}
                    className="w-full py-2 rounded-xl text-slate-500 hover:text-white text-xs"
                  >
                    Cancelar
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <TrashIcon className="w-5 h-5 text-red-400 flex-none" />
                  <h3 className="text-white font-semibold text-sm">¿Salir del foro?</h3>
                </div>
                <p className="text-slate-400 text-xs leading-relaxed mb-3">
                  Esta acción borra todos los mensajes de{" "}
                  <strong className="text-slate-200">{displayName}</strong> guardados en
                  este dispositivo y cancela tu participación.
                </p>
                {isUserForum && (
                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] mb-4 flex items-center gap-2">
                    <ExclamationTriangleIcon className="w-4 h-4 text-amber-400 flex-none" />
                    <span><strong>Regla de extinción:</strong> Si todos los participantes abandonan este foro temporal, se extinguirá por completo de la red.</span>
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setLeaveStep(null)}
                    disabled={isLeaving}
                    className="flex-1 py-2.5 rounded-xl bg-surface-2 text-slate-300 text-xs font-medium hover:bg-surface-2/80 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleLeaveForum}
                    disabled={isLeaving}
                    className="flex-1 py-2.5 rounded-xl bg-red-500/20 text-red-400 border border-red-500/40 text-xs font-semibold hover:bg-red-500/30 transition-colors disabled:opacity-50"
                  >
                    {isLeaving ? "Saliendo…" : "Sí, salir del foro"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Cabecera del Foro ── */}
      <header className="flex-none px-4 py-3 bg-surface-1/95 backdrop-blur-md border-b border-surface-2 pt-safe z-10 shadow-sm">
        <div className="flex items-center justify-between gap-3 mb-1.5">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Botón: Salir del chat (mantiene copia) */}
            <button
              onClick={handleLeaveChat}
              className="w-8 h-8 rounded-xl bg-surface-2 hover:bg-slate-700 flex items-center justify-center text-slate-300 hover:text-white transition-colors flex-none"
              title="Salir del chat (mantiene tu copia local)"
            >
              <ArrowLeftIcon className="w-4 h-4" />
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {zone?.color ? (
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-none"
                    style={{ backgroundColor: zone.color }}
                  />
                ) : (
                  <span className="w-2.5 h-2.5 rounded-full flex-none bg-slate-400" />
                )}
                <h1 className="text-sm sm:text-base font-bold text-white truncate">
                  {displayName}
                </h1>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                {isPhysicallyInside ? (
                  <span className="text-emerald-400 font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    Dentro del ámbito (puedes publicar)
                  </span>
                ) : (
                  <span className="text-amber-400 flex items-center gap-1">
                    <LockClosedIcon className="w-3 h-3" />
                    Solo lectura
                  </span>
                )}
                <span>•</span>
                <span className="flex items-center gap-1">
                  <UserGroupIcon className="w-3 h-3" />
                  {occupancy} {occupancy === 1 ? "persona" : "personas"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-none">
            {/* Indicador de relay y de red */}
            <div className="flex items-center gap-1.5 bg-surface-2/60 px-2.5 py-1 rounded-full text-[11px]">
              <span
                className={`w-2 h-2 rounded-full ${
                  networkConnected ? "bg-emerald-400" : "bg-red-400 animate-pulse"
                }`}
              />
              <span className="text-slate-300 font-medium">
                {networkConnected ? "En vivo" : "Desconectado"}
              </span>
            </div>

            {/* Botón: Salir del foro (borra datos) */}
            <button
              onClick={() => setLeaveStep("choose")}
              className="px-2.5 h-8 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400 hover:text-red-300 transition-colors text-[11px] font-semibold"
              title="Salir del chat o del foro"
            >
              Salir
            </button>
          </div>
        </div>

        {/* Barra de estado de sincronización de historial */}
        <div className="flex items-center justify-between text-[11px] px-1 text-slate-400 pt-1 border-t border-surface-2/40">
          <div className="flex items-center gap-1.5">
            {syncStatus === "syncing" && (
              <span className="text-amber-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
                Recuperando historial de participantes…
              </span>
            )}
            {syncStatus === "synced" && (
              <span className="text-slate-400 flex items-center gap-1">
                <CheckBadgeIcon className="w-3.5 h-3.5 text-emerald-400" />
                Historial sincronizado ({messages.length} guardados)
              </span>
            )}
            {syncStatus === "unavailable" && (
              <span className="text-slate-400 flex items-center gap-1.5">
                <InformationCircleIcon className="w-3.5 h-3.5 text-slate-400 flex-none" />
                Historial no disponible — puedes escribir igualmente
              </span>
            )}
          </div>

          <span className="text-[10px] text-slate-500 font-mono">
            IndexedDB local
          </span>
        </div>
      </header>

      {/* ── Banner de Simulación GPS Activa ── */}
      {isSimulating() && (
        <div className="flex items-center justify-between px-4 py-2 bg-purple-500/15 border-b border-purple-500/30 text-purple-200 text-xs flex-none animate-fade-in">
          <div className="flex items-center gap-2 truncate">
            <BeakerIcon className="w-4 h-4 text-purple-400 flex-none" />
            <span className="truncate">
              <strong>Modo Simulación activo:</strong> Presencia fijada en{" "}
              <strong className="text-white">
                {simulatedZone?.name || simulatedCoordinates?.name || "esta ubicación"}
              </strong>
            </span>
          </div>
          <button
            type="button"
            onClick={clearSimulation}
            className="ml-2 px-2 py-0.5 rounded-lg bg-purple-500/25 hover:bg-purple-500/40 text-purple-200 text-[11px] font-semibold transition-colors flex-none"
            title="Desactivar modo simulación"
          >
            Quitar
          </button>
        </div>
      )}

      {/* ── Feed de Mensajes ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && outboxMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12 px-4">
            <div className="w-14 h-14 rounded-2xl bg-surface-1 border border-surface-2 flex items-center justify-center mb-3 shadow-inner">
              <ChatBubbleLeftEllipsisIcon className="w-7 h-7 text-slate-400" />
            </div>
            <h3 className="font-semibold text-white text-sm mb-1">
              {syncStatus === "unavailable" ? "Historial no disponible" : "Foro en tiempo real"}
            </h3>
            <p className="text-slate-400 text-xs max-w-xs leading-relaxed">
              {syncStatus === "unavailable"
                ? "Ningún par conectado tiene copia del historial. Puedes escribir si estás dentro del ámbito y tus mensajes se guardarán."
                : isPhysicallyInside
                ? "Estás dentro del ámbito. Publica un mensaje para que los demás participantes lo reciban en tiempo real."
                : "Estás en modo solo lectura. Cuando alguien en el ámbito físico escriba o se conecte un participante con historial, verás los mensajes aquí."}
            </p>
          </div>
        ) : (
          <>
            {/* Mensajes confirmados y sellados */}
            {messages.map((msg) => {
              const isOwn = msg.authorKey === session?.publicKey;
              const timeFormatted = new Date(msg.relayTs).toLocaleTimeString("es-PE", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              });

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isOwn ? "items-end" : "items-start"} animate-fade-in`}
                >
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mb-1 px-1">
                    {isOwn ? (
                      <span className="font-semibold text-brand-300">Tú ({msg.alias})</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setSelectedAuthor({ authorKey: msg.authorKey, authorAlias: msg.alias })}
                        className="font-semibold text-slate-300 hover:text-purple-300 hover:underline transition-colors cursor-pointer text-left inline-flex items-center gap-0.5"
                        title="Ver perfil o solicitar contacto permanente"
                      >
                        {msg.alias}
                      </button>
                    )}
                    <span>•</span>
                    <span>{timeFormatted}</span>
                    {msg.relaySig && (
                      <span
                        title="Sello criptográfico del relay verificado"
                        className="inline-flex items-center text-emerald-400"
                      >
                        <CheckBadgeIcon className="w-3 h-3" />
                      </span>
                    )}
                  </div>

                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-md break-words ${
                      isOwn
                        ? "bg-brand-600 text-white rounded-tr-none"
                        : "bg-surface-1 text-slate-100 border border-surface-2/80 rounded-tl-none"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              );
            })}

            {/* Mensajes en Bandeja de Salida (Outbox offline) */}
            {outboxMessages.map((out) => (
              <div key={out.id} className="flex flex-col items-end opacity-85">
                <div className="flex items-center gap-1.5 text-[10px] text-amber-400 mb-1 px-1">
                  <ClockIcon className="w-3 h-3 animate-spin" />
                  <span>Pendiente (en bandeja de salida local)</span>
                </div>
                <div className="max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed bg-amber-600/30 border border-amber-500/50 text-amber-100 rounded-tr-none shadow-md">
                  {out.content}
                </div>
              </div>
            ))}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Zona de Publicación o Restricción ── */}
      <footer className="flex-none p-3 bg-surface-1 border-t border-surface-2 pb-safe">
        {localNotice && (
          <div className="mb-2 px-3 py-1.5 rounded-lg bg-brand-500/15 border border-brand-500/30 text-brand-300 text-xs flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <CloudArrowUpIcon className="w-4 h-4" />
              {localNotice}
            </span>
            <button
              type="button"
              onClick={() => setLocalNotice(null)}
              className="text-brand-400 font-bold ml-2"
            >
              ✕
            </button>
          </div>
        )}

        {(localError || error) && (
          <div className="mb-2 px-3 py-1.5 rounded-lg bg-red-500/15 border border-red-500/30 text-red-300 text-xs flex items-center justify-between">
            <span>{localError || error}</span>
            <button
              type="button"
              onClick={() => setLocalError(null)}
              className="text-red-400 hover:text-white font-bold ml-2"
            >
              ✕
            </button>
          </div>
        )}

        {isPhysicallyInside ? (
          <form onSubmit={handleSend} className="space-y-1.5">
            <div className="flex items-end gap-2">
              <div className="flex-1 bg-surface-0 rounded-2xl border border-surface-2 focus-within:border-brand-500 transition-colors px-3.5 py-2">
                <textarea
                  value={inputContent}
                  onChange={(e) => setInputContent(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend(e);
                    }
                  }}
                  placeholder={
                    networkConnected
                      ? `Escribe a los participantes en ${displayName}…`
                      : `Escribe sin conexión (se enviará al reconectar)…`
                  }
                  rows={2}
                  maxLength={MAX_MESSAGE_LENGTH}
                  className="w-full bg-transparent text-white placeholder-slate-500 text-xs sm:text-sm resize-none focus:outline-none"
                />
                <div className="flex justify-between items-center text-[10px] text-slate-500 pt-1 border-t border-surface-2/30">
                  <span className="flex items-center gap-1 text-emerald-400/80">
                    <ShieldCheckIcon className="w-3 h-3" />
                    {networkConnected ? "Firmado localmente" : "Bandeja offline activa"}
                  </span>
                  <span className={remainingChars < 50 ? "text-amber-400" : ""}>
                    {remainingChars}
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={!inputContent.trim() || isSending}
                className="h-11 w-11 rounded-2xl bg-brand-500 hover:bg-brand-400 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center transition-all shadow-md shadow-brand-500/20 flex-none active:scale-95"
                title={networkConnected ? "Publicar mensaje en la sala" : "Guardar en bandeja de salida"}
              >
                <PaperAirplaneIcon className="w-5 h-5 -rotate-45 -mr-0.5" />
              </button>
            </div>
          </form>
        ) : (
          <div className="p-3 rounded-2xl bg-surface-0 border border-surface-2 text-center">
            <div className="flex items-center justify-center gap-1.5 text-amber-400 text-xs font-semibold mb-1">
              <LockClosedIcon className="w-3.5 h-3.5" />
              <span>Modo solo lectura</span>
            </div>
            <p className="text-slate-400 text-xs max-w-md mx-auto">
              Debes encontrarte dentro del ámbito físico de <strong className="text-slate-200">{displayName}</strong> para poder enviar mensajes. Puedes continuar leyendo el chat como participante.
            </p>

            {isZoneForum && zone && (
              <button
                type="button"
                onClick={() => setSimulatedZone(zone)}
                className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/40 text-xs font-semibold hover:bg-purple-500/30 transition-colors active:scale-95 shadow-sm"
              >
                <BeakerIcon className="w-3.5 h-3.5 flex-none" />
                <span>Simular presencia física en {zone.name} (Pruebas)</span>
              </button>
            )}

            {isUserForum && userForumMeta?.latitude && userForumMeta?.longitude && (
              <button
                type="button"
                onClick={() =>
                  setSimulatedCoordinates({
                    latitude: userForumMeta.latitude!,
                    longitude: userForumMeta.longitude!,
                    name: userForumMeta.name,
                  })
                }
                className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/40 text-xs font-semibold hover:bg-purple-500/30 transition-colors active:scale-95 shadow-sm"
              >
                <BeakerIcon className="w-3.5 h-3.5 flex-none" />
                <span>Simular presencia física en este foro (Pruebas)</span>
              </button>
            )}
          </div>
        )}
      </footer>

      {/* ── Modal de Perfil de Autor y Solicitud Directa ── */}
      {selectedAuthor && (
        <AuthorProfileModal
          isOpen={true}
          onClose={() => setSelectedAuthor(null)}
          authorKey={selectedAuthor.authorKey}
          authorAlias={selectedAuthor.authorAlias}
          forumName={displayName}
        />
      )}
    </div>
  );
}
