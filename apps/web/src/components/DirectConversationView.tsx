// ──────────────────────────────────────────────────────────────────────
//  Vista de Conversación Directa 1:1 Permanente con Cifrado E2EE
//  - Sin restricciones de geocerca ni GPS
//  - Cifrado de extremo a extremo autenticado AES-GCM-256
//  - Persistencia local en IndexedDB
// ──────────────────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from "react";
import {
  ArrowLeftIcon,
  TrashIcon,
  PaperAirplaneIcon,
  LockClosedIcon,
  ShieldCheckIcon,
  UserGroupIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { useDirectChatStore } from "@/stores/directChatStore";
import type { DirectPeer } from "@zonaviva/protocol";

interface DirectConversationViewProps {
  peer: DirectPeer;
  onBack: () => void;
}

export function DirectConversationView({ peer, onBack }: DirectConversationViewProps) {
  const { activeMessages, sendMessage, deletePeer, isSending } = useDirectChatStore();
  const [inputText, setInputText] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeMessages.length]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isSending) return;

    const text = inputText;
    setInputText("");
    const ok = await sendMessage(text);
    if (!ok) {
      setInputText(text); // Restaurar si falló
    }
  };

  const handleDelete = async () => {
    await deletePeer(peer.peerPublicKey);
    setShowDeleteConfirm(false);
    onBack();
  };

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString("es-PE", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const charCode = peer.alias.charCodeAt(0) || 0;
  const avatarColors = [
    "from-purple-500 to-indigo-600",
    "from-emerald-500 to-teal-600",
    "from-amber-500 to-orange-600",
    "from-pink-500 to-rose-600",
    "from-blue-500 to-cyan-600",
  ];
  const colorGradient = avatarColors[charCode % avatarColors.length];

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-surface-0">
      {/* ── Modal Confirmar Borrado ── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface-1 border border-surface-2 rounded-2xl max-w-sm w-full p-5 shadow-2xl">
            <div className="flex items-center gap-2 text-red-400 mb-2">
              <TrashIcon className="w-5 h-5 flex-none" />
              <h3 className="text-white font-semibold text-sm">¿Eliminar chat y contacto?</h3>
            </div>
            <p className="text-slate-400 text-xs leading-relaxed mb-4">
              Esta acción eliminará a <strong className="text-slate-200">{peer.alias}</strong> de tu lista de contactos permanentes y borrará todo el historial local de esta conversación.
            </p>
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleDelete}
                className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition-colors shadow-md shadow-red-600/20"
              >
                Eliminar definitivamente
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="w-full py-2 rounded-xl text-slate-400 hover:text-white text-xs"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header de Conversación ── */}
      <header className="flex-none bg-surface-1 border-b border-surface-2 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBack}
            className="p-1.5 -ml-1 text-slate-400 hover:text-white hover:bg-surface-2 rounded-xl transition-colors flex-none"
            title="Volver a la lista de contactos"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </button>

          <div
            className={`w-9 h-9 rounded-xl bg-gradient-to-tr ${colorGradient} flex items-center justify-center text-white text-sm font-bold flex-none shadow-sm`}
          >
            {peer.alias.charAt(0).toUpperCase()}
          </div>

          <div className="min-w-0">
            <h2 className="text-sm font-bold text-white truncate">{peer.alias}</h2>
            <div className="flex items-center gap-1.5 text-[10px]">
              {peer.isDeletedByPeer ? (
                <span className="flex items-center gap-1 text-red-400 font-semibold">
                  <ExclamationTriangleIcon className="w-3.5 h-3.5" />
                  <span>Perfil eliminado</span>
                </span>
              ) : (
                <>
                  <span className="flex items-center gap-1 text-emerald-400">
                    <LockClosedIcon className="w-3 h-3" />
                    <span>E2EE permanente</span>
                  </span>
                  <span className="text-slate-500">•</span>
                  <span className="text-slate-400">Sin límite de zona</span>
                </>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
          title="Eliminar chat y contacto"
        >
          <TrashIcon className="w-5 h-5" />
        </button>
      </header>

      {/* ── Banner de Advertencia: Perfil Eliminado ── */}
      {peer.isDeletedByPeer && (
        <div className="flex-none bg-red-500/15 border-b border-red-500/30 px-4 py-2.5 text-xs text-red-200 flex items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-start gap-2 min-w-0">
            <ExclamationTriangleIcon className="w-4 h-4 text-red-400 flex-none mt-0.5" />
            <p className="text-[11px] leading-snug text-slate-300">
              <strong className="text-red-300 font-semibold">{peer.alias}</strong> eliminó o reinició su perfil. Ya no recibirá nuevos mensajes. Te recomendamos eliminar este chat.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="flex-none text-[11px] bg-red-600 hover:bg-red-500 text-white px-2.5 py-1.5 rounded-lg font-semibold transition-colors shadow-sm"
          >
            Eliminar chat
          </button>
        </div>
      )}

      {/* ── Banner de Cifrado y Privacidad ── */}
      <div className="flex-none bg-surface-1/40 border-b border-surface-2/40 px-4 py-1.5 text-center text-[10px] text-slate-400 flex items-center justify-center gap-1.5">
        <ShieldCheckIcon className="w-3 h-3 text-emerald-400" />
        <span>Túnel directo cifrado extremo a extremo (AES-GCM-256) · Historial persistente en tu dispositivo</span>
      </div>

      {/* ── Lista de Mensajes ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 max-w-lg mx-auto w-full">
        {activeMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12 px-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-300 flex items-center justify-center mb-2">
              <UserGroupIcon className="w-6 h-6 text-purple-400" />
            </div>
            <h3 className="font-semibold text-white text-sm mb-1">
              Contacto permanente conectado
            </h3>
            <p className="text-slate-400 text-xs max-w-xs leading-relaxed">
              Pueden conversar en cualquier momento sin importar dónde se encuentren en la ciudad.
            </p>
          </div>
        ) : (
          activeMessages.map((m) => {
            const isMe = m.isOutgoing;
            return (
              <div
                key={m.id}
                className={`flex flex-col ${isMe ? "items-end" : "items-start"} animate-fade-in`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed shadow-sm break-words ${
                    isMe
                      ? "bg-purple-600 text-white rounded-br-xs"
                      : "bg-surface-2 text-slate-200 rounded-bl-xs"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.content}</p>
                  <div
                    className={`text-[9px] mt-1 flex items-center justify-end gap-1 ${
                      isMe ? "text-purple-200" : "text-slate-400"
                    }`}
                  >
                    <span>{formatTime(m.clientTs)}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Input o Advertencia de Mensaje ── */}
      <footer className="flex-none bg-surface-1 border-t border-surface-2 p-3 pb-safe">
        {peer.isDeletedByPeer ? (
          <div className="max-w-lg mx-auto p-2.5 bg-surface-2/60 border border-surface-2 rounded-xl text-center space-y-1">
            <p className="text-[11px] text-slate-400">
              No es posible enviar nuevos mensajes porque el perfil de este usuario fue eliminado.
            </p>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="text-xs text-red-400 hover:text-red-300 font-medium underline transition-colors"
            >
              Eliminar este chat y liberar espacio
            </button>
          </div>
        ) : (
          <form onSubmit={handleSend} className="max-w-lg mx-auto flex items-center gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={`Escribe a ${peer.alias}...`}
              maxLength={1000}
              className="flex-1 bg-surface-2 border border-surface-2 focus:border-purple-500 text-white text-xs rounded-xl px-3.5 py-2.5 outline-none transition-colors placeholder:text-slate-500"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || isSending}
              className="p-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:hover:bg-purple-600 text-white transition-colors"
              title="Enviar mensaje directo"
            >
              <PaperAirplaneIcon className="w-4 h-4" />
            </button>
          </form>
        )}
      </footer>
    </div>
  );
}
