// ──────────────────────────────────────────────────────────────────────
//  V6 – Chat Aleatorio Efímero y Cifrado Extremo a Extremo (E2EE)
//  Tres estados en una vista unificada: Lobby, Buscando, Conversación.
//  Cero persistencia: las claves y mensajes solo viven en la memoria de la sesión.
// ──────────────────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useRandomChatStore } from "@/stores/randomChatStore";
import { useGeoStore } from "@/stores/geoStore";
import { ZONES } from "@zonaviva/protocol";
import {
  ShieldCheckIcon,
  SparklesIcon,
  ArrowPathIcon,
  XMarkIcon,
  PaperAirplaneIcon,
  InformationCircleIcon,
  ChevronLeftIcon,
  LockClosedIcon,
} from "@heroicons/react/24/outline";

export default function ChatPage() {
  const {
    status,
    zoneId,
    securityCode,
    messages,
    errorMessage,
    startSearch,
    cancelSearch,
    sendMessage,
    leaveChat,
    nextChat,
  } = useRandomChatStore();

  const { currentZone, manualZone } = useGeoStore();
  const effectiveZone = manualZone ?? currentZone ?? ZONES[0];

  const [selectedZoneId, setSelectedZoneId] = useState<string>(
    zoneId ?? effectiveZone?.id ?? ZONES[0].id
  );
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showSasModal, setShowSasModal] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll al recibir o enviar mensajes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  // Actualizar zona seleccionada por defecto si cambia la posición
  useEffect(() => {
    if (status === "idle" && effectiveZone) {
      setSelectedZoneId(effectiveZone.id);
    }
  }, [effectiveZone, status]);

  const activeZoneObj = ZONES.find((z) => z.id === selectedZoneId) ?? ZONES[0];

  const handleStart = async () => {
    await startSearch(selectedZoneId);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isSending) return;

    setIsSending(true);
    const ok = await sendMessage(inputText);
    if (ok) {
      setInputText("");
    }
    setIsSending(false);
  };

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="flex flex-col h-full bg-surface-0">
      {/* ── ESTADO 1: LOBBY (IDLE) ── */}
      {status === "idle" && (
        <div className="flex-1 flex flex-col justify-between max-w-lg mx-auto w-full px-4 py-6">
          <div>
            {/* Header del lobby */}
            <div className="flex items-center justify-between mb-6">
              <Link
                to="/"
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
              >
                <ChevronLeftIcon className="w-4 h-4" />
                <span>Volver al inicio</span>
              </Link>
              <span className="text-[11px] font-semibold text-purple-400 bg-purple-500/10 px-2.5 py-1 rounded-full border border-purple-500/20">
                E2EE Cifrado
              </span>
            </div>

            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center mx-auto mb-4 shadow-xl shadow-purple-500/20">
                <SparklesIcon className="w-9 h-9 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight mb-2">
                Chat 1 a 1 en tu Zona
              </h1>
              <p className="text-slate-400 text-xs max-w-xs mx-auto leading-relaxed">
                Conversa al instante con un vecino anónimo disponible en el mismo lugar físico.
              </p>
            </div>

            {/* Error previo o aviso de cola vacía */}
            {errorMessage && (
              <div className="mb-6 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-2.5">
                <InformationCircleIcon className="w-5 h-5 flex-none text-amber-400" />
                <p className="leading-snug">{errorMessage}</p>
              </div>
            )}

            {/* Selector de Zona */}
            <div className="bg-surface-1 rounded-2xl p-4 border border-surface-2 mb-6">
              <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
                Selecciona la zona para buscar:
              </label>
              <div className="grid grid-cols-1 gap-2">
                {ZONES.map((zone) => {
                  const isSelected = zone.id === selectedZoneId;
                  const isTest = zone.id === "puno-laureles";
                  return (
                    <button
                      key={zone.id}
                      type="button"
                      onClick={() => setSelectedZoneId(zone.id)}
                      className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                        isSelected
                          ? "bg-purple-500/15 border-purple-500 text-white shadow-md shadow-purple-500/10"
                          : "bg-surface-2/40 border-surface-2 text-slate-300 hover:bg-surface-2/80"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-base">{isTest ? "🧪" : "📍"}</span>
                        <div>
                          <p className="text-xs font-semibold">{zone.name}</p>
                          <p className="text-[10px] text-slate-400 truncate max-w-[200px]">
                            {zone.description}
                          </p>
                        </div>
                      </div>
                      {isSelected && (
                        <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Garantías de privacidad */}
            <div className="space-y-2.5 bg-surface-1/50 rounded-2xl p-4 border border-surface-2/50 text-xs text-slate-400">
              <div className="flex items-start gap-2.5">
                <ShieldCheckIcon className="w-4 h-4 text-emerald-400 flex-none mt-0.5" />
                <span>
                  <strong className="text-slate-200">Cifrado de extremo a extremo:</strong> Claves
                  ECDH P-256 efímeras y AES-GCM. El servidor solo ve texto cifrado.
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <LockClosedIcon className="w-4 h-4 text-brand-400 flex-none mt-0.5" />
                <span>
                  <strong className="text-slate-200">Cero registros:</strong> Los mensajes viven en
                  la memoria RAM y no se guardan en el servidor ni en tu dispositivo.
                </span>
              </div>
            </div>
          </div>

          {/* Botón de acción principal */}
          <div className="pt-4">
            <button
              onClick={handleStart}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-sm transition-all shadow-lg shadow-purple-600/30 active:scale-[0.99] flex items-center justify-center gap-2"
            >
              <SparklesIcon className="w-5 h-5" />
              <span>Buscar vecino en {activeZoneObj.name}</span>
            </button>
          </div>
        </div>
      )}

      {/* ── ESTADO 2: BUSCANDO (SEARCHING) ── */}
      {status === "searching" && (
        <div className="flex-1 flex flex-col justify-center items-center max-w-lg mx-auto w-full px-6 text-center">
          {/* Animación de radar pulsante */}
          <div className="relative flex items-center justify-center mb-8">
            <div className="absolute w-36 h-36 rounded-full bg-purple-500/10 animate-ping"></div>
            <div className="absolute w-28 h-28 rounded-full bg-purple-500/20 animate-pulse"></div>
            <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center shadow-2xl shadow-purple-500/40 relative z-10">
              <ArrowPathIcon className="w-10 h-10 text-white animate-spin" />
            </div>
          </div>

          <h2 className="text-xl font-bold text-white mb-2">Buscando a alguien...</h2>
          <p className="text-slate-400 text-xs max-w-xs mb-2">
            Esperando a otro vecino disponible en la zona:
          </p>
          <span className="inline-block px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 font-semibold text-xs border border-purple-500/30 mb-8">
            📍 {activeZoneObj.name}
          </span>

          <p className="text-[11px] text-slate-500 max-w-xs mb-8">
            Generando clave de cifrado efímera y esperando emparejamiento seguro con el relay.
          </p>

          <button
            onClick={cancelSearch}
            className="px-6 py-2.5 rounded-xl bg-surface-2 hover:bg-surface-2/80 text-slate-300 text-xs font-semibold transition-colors flex items-center gap-2"
          >
            <XMarkIcon className="w-4 h-4" />
            <span>Cancelar búsqueda</span>
          </button>
        </div>
      )}

      {/* ── ESTADO 3: CONVERSACIÓN (MATCHED O ENDED) ── */}
      {(status === "matched" || status === "ended") && (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {/* Cabecera del chat */}
          <header className="flex-none bg-surface-1 border-b border-surface-2 px-4 py-2.5">
            <div className="max-w-lg mx-auto flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <button
                  onClick={leaveChat}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-surface-2 transition-colors"
                  title="Salir del chat"
                >
                  <ChevronLeftIcon className="w-5 h-5" />
                </button>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-white text-xs sm:text-sm">
                      Vecino Anónimo
                    </span>
                    {status === "matched" ? (
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Conectado"></span>
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-slate-500" title="Desconectado"></span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Zona: {activeZoneObj.name}
                  </p>
                </div>
              </div>

              {/* Controles de verificación y cambio */}
              <div className="flex items-center gap-2">
                {securityCode && (
                  <button
                    onClick={() => setShowSasModal(true)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-2 border border-surface-2 hover:border-purple-500/50 text-[10px] text-purple-300 transition-colors"
                    title="Verificar código de cifrado"
                  >
                    <ShieldCheckIcon className="w-3.5 h-3.5 text-purple-400" />
                    <span className="font-mono font-medium">{securityCode}</span>
                  </button>
                )}

                <button
                  onClick={nextChat}
                  className="px-2.5 py-1 rounded-lg bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/30 text-[11px] font-semibold transition-colors flex items-center gap-1"
                  title="Pasar a otro interlocutor"
                >
                  <ArrowPathIcon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Siguiente</span>
                </button>

                <button
                  onClick={leaveChat}
                  className="px-2.5 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 text-[11px] font-semibold transition-colors"
                >
                  Terminar
                </button>
              </div>
            </div>
          </header>

          {/* Banner de aviso efímero */}
          <div className="flex-none bg-surface-1/40 border-b border-surface-2/40 px-4 py-1.5 text-center text-[10px] text-slate-400 flex items-center justify-center gap-1.5">
            <LockClosedIcon className="w-3 h-3 text-emerald-400" />
            <span>Chat efímero cifrado extremo a extremo (E2EE) · Sin historial</span>
          </div>

          {/* Lista de mensajes (scrollable) */}
          <div className="flex-1 overflow-y-auto px-4 py-4 max-w-lg mx-auto w-full space-y-3">
            {messages.length === 0 && status === "matched" && (
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-300 flex items-center justify-center mx-auto mb-2 text-xl">
                  👋
                </div>
                <p className="text-xs text-slate-300 font-semibold mb-1">
                  ¡Están conectados de forma segura!
                </p>
                <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                  Saluda a tu vecino. Los mensajes están cifrados con claves que solo ustedes dos conocen.
                </p>
              </div>
            )}

            {messages.map((m) => {
              const isMe = m.sender === "me";
              return (
                <div
                  key={m.id}
                  className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed shadow-sm ${
                      isMe
                        ? "bg-purple-600 text-white rounded-br-xs"
                        : "bg-surface-2 text-slate-200 rounded-bl-xs"
                    }`}
                  >
                    <p className="break-words whitespace-pre-wrap">{m.text}</p>
                    <div
                      className={`text-[9px] mt-1 flex items-center justify-end gap-1 ${
                        isMe ? "text-purple-200" : "text-slate-400"
                      }`}
                    >
                      <span>{formatTime(m.ts)}</span>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Aviso cuando el interlocutor sale */}
            {status === "ended" && (
              <div className="my-6 p-4 rounded-2xl bg-surface-1 border border-surface-2 text-center">
                <p className="text-xs font-semibold text-slate-200 mb-1">
                  Tu interlocutor salió del chat
                </p>
                <p className="text-[11px] text-slate-400 mb-4">
                  La clave de cifrado se ha destruido en ambos dispositivos.
                </p>
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={nextChat}
                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition-colors"
                  >
                    Buscar a otra persona
                  </button>
                  <button
                    onClick={leaveChat}
                    className="px-4 py-2 rounded-xl bg-surface-2 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
                  >
                    Volver al lobby
                  </button>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Formulario de entrada */}
          {status === "matched" && (
            <footer className="flex-none bg-surface-1 border-t border-surface-2 p-3 pb-safe">
              <form
                onSubmit={handleSend}
                className="max-w-lg mx-auto flex items-center gap-2"
              >
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Escribe un mensaje seguro..."
                  maxLength={1000}
                  className="flex-1 bg-surface-2 border border-surface-2 focus:border-purple-500 text-white text-xs rounded-xl px-3.5 py-2.5 outline-none transition-colors placeholder:text-slate-500"
                />
                <button
                  type="submit"
                  disabled={!inputText.trim() || isSending}
                  className="p-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:hover:bg-purple-600 text-white transition-colors"
                  title="Enviar mensaje cifrado"
                >
                  <PaperAirplaneIcon className="w-4 h-4" />
                </button>
              </form>
            </footer>
          )}
        </div>
      )}

      {/* ── Modal de Verificación SAS ── */}
      {showSasModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-surface-1 border border-surface-2 rounded-2xl max-w-sm w-full p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ShieldCheckIcon className="w-5 h-5 text-purple-400" />
                <h3 className="text-sm font-bold text-white">Código de Seguridad (SAS)</h3>
              </div>
              <button
                onClick={() => setShowSasModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Compara este código con tu interlocutor para garantizar que no hay ningún intermediario:
            </p>

            <div className="py-3 px-4 rounded-xl bg-surface-0 border border-purple-500/40 text-center mb-4">
              <span className="font-mono text-xl font-bold tracking-widest text-purple-300">
                {securityCode}
              </span>
            </div>

            <p className="text-[10px] text-slate-400 leading-relaxed mb-4">
              Este número se deriva matemáticamente (SHA-256) de las claves públicas ECDH generadas en
              ambos teléfonos. Si ambos ven los mismos números, la conexión es 100% auténtica y privada.
            </p>

            <button
              onClick={() => setShowSasModal(false)}
              className="w-full py-2.5 rounded-xl bg-surface-2 hover:bg-slate-700 text-white font-semibold text-xs transition-colors"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
