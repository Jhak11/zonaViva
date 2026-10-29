// ──────────────────────────────────────────────────────────────────────
//  V4 – Foro individual en tiempo real con Persistencia y Sincronización (Iteración 3)
//  Lectura pública / Publicación por proximidad / Soporte offline con Outbox.
// ──────────────────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { ZONES_BY_ID, FORUM_PREFIX_ZONE, MAX_MESSAGE_LENGTH } from "@zonaviva/protocol";
import { useGeoStore } from "@/stores/geoStore";
import { useIdentityStore } from "@/stores/identityStore";
import { useForumStore } from "@/stores/forumStore";
import {
  ArrowLeftIcon,
  UserGroupIcon,
  PaperAirplaneIcon,
  LockClosedIcon,
  CheckBadgeIcon,
  ShieldCheckIcon,
  ClockIcon,
  CloudArrowUpIcon,
} from "@heroicons/react/24/outline";

export default function ForoPage() {
  const { id } = useParams<{ id: string }>();
  const forumId = id || "";

  const { currentZone } = useGeoStore();
  const { session } = useIdentityStore();
  const {
    messages,
    outboxMessages,
    occupancy,
    syncStatus,
    enterForum,
    leaveCurrentForum,
    publishMessage,
    flushOutbox,
    isSending,
    networkConnected,
    error,
  } = useForumStore();

  const [inputContent, setInputContent] = useState("");
  const [localNotice, setLocalNotice] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const isZoneForum = forumId.startsWith(FORUM_PREFIX_ZONE);
  const zoneId = isZoneForum ? forumId.slice(FORUM_PREFIX_ZONE.length) : "";
  const zone = ZONES_BY_ID[zoneId];

  const isPhysicallyInside = Boolean(zone && currentZone?.id === zone.id);

  // Unirse al foro y cargar copias locales de IndexedDB al montar
  useEffect(() => {
    if (forumId) {
      enterForum(forumId, zone?.name);
    }
    return () => {
      leaveCurrentForum();
    };
  }, [forumId, zone?.name, enterForum, leaveCurrentForum]);

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
      setLocalError("Solo lectura: debes estar dentro de la zona física para publicar.");
      return;
    }

    const res = await publishMessage(inputContent, session, currentZone);
    if (res.success) {
      setInputContent("");
      if (res.queued) {
        setLocalNotice("Mensaje guardado en bandeja local. Se transmitirá al reconectar.");
      }
    } else if (res.error) {
      setLocalError(res.error);
    }
  }

  const remainingChars = MAX_MESSAGE_LENGTH - inputContent.length;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-surface-0">
      {/* ── Cabecera del Foro ── */}
      <header className="flex-none px-4 py-3 bg-surface-1/95 backdrop-blur-md border-b border-surface-2 pt-safe z-10 shadow-sm">
        <div className="flex items-center justify-between gap-3 mb-1.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <Link
              to="/foros"
              className="w-8 h-8 rounded-xl bg-surface-2 hover:bg-slate-700 flex items-center justify-center text-slate-300 hover:text-white transition-colors flex-none"
              title="Volver a foros"
            >
              <ArrowLeftIcon className="w-4 h-4" />
            </Link>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-bold text-white truncate">
                  {zone ? zone.name : forumId}
                </h1>
                {zone?.id === "puno-laureles" && (
                  <span className="text-[10px] bg-purple-500/20 text-purple-300 px-1.5 py-0.2 rounded border border-purple-500/30 flex-none">
                    Pruebas
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                {isPhysicallyInside ? (
                  <span className="text-emerald-400 font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    Dentro de zona
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

          {/* Indicador de relay y de red */}
          <div className="flex items-center gap-1.5 bg-surface-2/60 px-2.5 py-1 rounded-full text-[11px] flex-none">
            <span
              className={`w-2 h-2 rounded-full ${
                networkConnected ? "bg-emerald-400" : "bg-red-400 animate-pulse"
              }`}
            />
            <span className="text-slate-300 font-medium">
              {networkConnected ? "En vivo" : "Desconectado"}
            </span>
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
                Historial sincronizado con pares ({messages.length} mensajes guardados)
              </span>
            )}
            {syncStatus === "unavailable" && (
              <span className="text-slate-400 flex items-center gap-1">
                <span>ℹ️</span>
                Historial no disponible (sin pares con copia conectados)
              </span>
            )}
          </div>

          <span className="text-[10px] text-slate-500 font-mono">
            IndexedDB local
          </span>
        </div>
      </header>

      {/* ── Feed de Mensajes ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && outboxMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12 px-4">
            <div className="w-14 h-14 rounded-2xl bg-surface-1 border border-surface-2 flex items-center justify-center text-2xl mb-3 shadow-inner">
              💬
            </div>
            <h3 className="font-semibold text-white text-sm mb-1">
              Foro en tiempo real
            </h3>
            <p className="text-slate-400 text-xs max-w-xs leading-relaxed">
              {isPhysicallyInside
                ? "Estás dentro de la zona. Publica un mensaje para que los vecinos y visitantes cercanos lo reciban y guarden en su dispositivo."
                : "No hay mensajes en la copia local. Cuando alguien en la zona escriba o se conecte un par con historial, aparecerán aquí."}
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
                    <span className={`font-semibold ${isOwn ? "text-brand-300" : "text-slate-300"}`}>
                      {isOwn ? `Tú (${msg.alias})` : msg.alias}
                    </span>
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
            <button onClick={() => setLocalNotice(null)} className="text-brand-400 font-bold ml-2">
              ✕
            </button>
          </div>
        )}

        {(localError || error) && (
          <div className="mb-2 px-3 py-1.5 rounded-lg bg-red-500/15 border border-red-500/30 text-red-300 text-xs flex items-center justify-between">
            <span>{localError || error}</span>
            <button
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
                      ? `Escribe a la comunidad en ${zone?.name || "esta zona"}…`
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
              Debes encontrarte físicamente en <strong className="text-slate-200">{zone?.name || "esta zona"}</strong> para poder enviar mensajes. Tu posición GPS actual no coincide con esta zona geográfica.
            </p>
          </div>
        )}
      </footer>
    </div>
  );
}
