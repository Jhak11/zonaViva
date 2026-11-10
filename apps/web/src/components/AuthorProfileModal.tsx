// ──────────────────────────────────────────────────────────────────────
//  Modal de Perfil de Autor y Solicitud de Par Permanente
//  Permite solicitar contacto directo desde cualquier mensaje de foro.
// ──────────────────────────────────────────────────────────────────────
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  XMarkIcon,
  UserPlusIcon,
  ChatBubbleLeftRightIcon,
  ShieldCheckIcon,
  ClockIcon,
  NoSymbolIcon,
  CheckCircleIcon,
  BookmarkIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { useDirectChatStore } from "@/stores/directChatStore";
import { useIdentityStore } from "@/stores/identityStore";
import { MAX_INTRO_MESSAGE_LENGTH, MAX_DIRECT_PEERS_PER_CLIENT } from "@zonaviva/protocol";

interface AuthorProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  authorKey: string;
  authorAlias: string;
  forumName?: string;
}

export function AuthorProfileModal({
  isOpen,
  onClose,
  authorKey,
  authorAlias,
  forumName,
}: AuthorProfileModalProps) {
  const navigate = useNavigate();
  const session = useIdentityStore((s) => s.session);
  const { peers, requests, sendRequest, cancelRequest, checkCooldown, openDirectChat } = useDirectChatStore();

  const [introMessage, setIntroMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditingMessage, setIsEditingMessage] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError?: boolean } | null>(null);
  const [cooldownInfo, setCooldownInfo] = useState<{
    canRequest: boolean;
    cooldownRemainingMs: number;
    status?: string;
  } | null>(null);

  const isSelf = session?.publicKey === authorKey;
  const existingPeer = peers.find((p) => p.peerPublicKey === authorKey);

  useEffect(() => {
    if (isOpen && !isSelf && !existingPeer) {
      checkCooldown(authorKey).then(setCooldownInfo);
    }
  }, [isOpen, authorKey, isSelf, existingPeer, checkCooldown]);

  if (!isOpen) return null;

  // Generar color de avatar determinista
  const avatarColors = [
    "from-purple-500 to-indigo-600",
    "from-emerald-500 to-teal-600",
    "from-amber-500 to-orange-600",
    "from-pink-500 to-rose-600",
    "from-blue-500 to-cyan-600",
  ];
  const charCode = authorAlias.charCodeAt(0) || 0;
  const colorGradient = avatarColors[charCode % avatarColors.length];

  const handleSend = async () => {
    setIsSubmitting(true);
    setStatusMessage(null);

    const res = await sendRequest(authorKey, authorAlias, introMessage, forumName, true);
    setIsSubmitting(false);

    if (res.ok) {
      setIsEditingMessage(false);
      setStatusMessage({
        text: "¡Solicitud enviada! Podrán conversar en cuanto la otra persona acepte.",
      });
      // Refrescar cooldown status
      checkCooldown(authorKey).then(setCooldownInfo);
    } else {
      setStatusMessage({ text: res.error || "No se pudo enviar la solicitud", isError: true });
    }
  };

  const handleGoToChat = async () => {
    await openDirectChat(authorKey);
    onClose();
    navigate("/chat?tab=contacts");
  };

  const handleCancelRequest = async () => {
    const req = requests.find(
      (r) => r.peerPublicKey === authorKey && r.direction === "outgoing" && r.status === "pending"
    );
    if (req) {
      await cancelRequest(req.id);
      setStatusMessage({ text: "Solicitud cancelada. Puedes enviar una nueva cuando gustes." });
      checkCooldown(authorKey).then(setCooldownInfo);
    }
  };

  const hoursRemaining = cooldownInfo?.cooldownRemainingMs
    ? Math.ceil(cooldownInfo.cooldownRemainingMs / (1000 * 60 * 60))
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface-1 border border-surface-2 rounded-2xl max-w-sm w-full p-5 shadow-2xl relative">
        {/* Botón cerrar */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
          title="Cerrar"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>

        {/* Cabecera del usuario */}
        <div className="flex flex-col items-center text-center mb-4">
          <div
            className={`w-16 h-16 rounded-2xl bg-gradient-to-tr ${colorGradient} flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-purple-900/30 mb-3`}
          >
            {authorAlias.charAt(0).toUpperCase()}
          </div>
          <h3 className="text-white font-bold text-base">{authorAlias}</h3>
          {forumName && (
            <p className="text-[11px] text-slate-400 mt-0.5">
              Participante en <span className="text-purple-300 font-medium">{forumName}</span>
            </p>
          )}
          <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 font-mono mt-1">
            <ShieldCheckIcon className="w-3.5 h-3.5 text-emerald-400" />
            Identidad criptográfica P-256
          </span>
        </div>

        {/* Feedback / Estado */}
        {statusMessage && (
          <div
            className={`p-3 rounded-xl mb-4 text-xs flex items-start gap-2 ${
              statusMessage.isError
                ? "bg-red-500/10 border border-red-500/20 text-red-300"
                : "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300"
            }`}
          >
            {statusMessage.isError ? (
              <NoSymbolIcon className="w-4 h-4 flex-none mt-0.5" />
            ) : (
              <CheckCircleIcon className="w-4 h-4 flex-none mt-0.5" />
            )}
            <p className="leading-snug">{statusMessage.text}</p>
          </div>
        )}

        {/* Contenido condicional */}
        {isSelf ? (
          <div className="p-3 bg-surface-2/40 rounded-xl border border-surface-2 text-center text-xs text-slate-400">
            Este es tu propio perfil en el foro.
          </div>
        ) : existingPeer ? (
          <div className="space-y-3">
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-center">
              <span className="text-xs font-semibold text-emerald-300 flex items-center justify-center gap-1.5">
                <BookmarkIcon className="w-4 h-4 text-emerald-400" />
                <span>Par permanente guardado</span>
              </span>
              <p className="text-[11px] text-slate-400 mt-1">
                Puedes conversar con este usuario en cualquier momento sin limitación de zona.
              </p>
            </div>
            <button
              type="button"
              onClick={handleGoToChat}
              className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-md shadow-purple-600/20"
            >
              <ChatBubbleLeftRightIcon className="w-4 h-4" />
              Abrir chat directo
            </button>
          </div>
        ) : peers.length >= MAX_DIRECT_PEERS_PER_CLIENT ? (
          <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-center space-y-1.5">
            <div className="flex items-center justify-center gap-1.5 text-amber-300 font-semibold text-xs">
              <ExclamationTriangleIcon className="w-4 h-4 text-amber-400" />
              <span>Límite de contactos alcanzado</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Tienes el máximo permitido de <strong>{MAX_DIRECT_PEERS_PER_CLIENT} contactos guardados</strong> ({peers.length}/{MAX_DIRECT_PEERS_PER_CLIENT}). Para enviar nuevas solicitudes, debes eliminar un contacto previo.
            </p>
          </div>
        ) : cooldownInfo?.status === "pending" && !isEditingMessage ? (
          <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-center space-y-2">
            <div className="flex items-center justify-center gap-1.5 text-amber-300 font-semibold text-xs">
              <ClockIcon className="w-4 h-4 text-amber-400" />
              <span>Solicitud pendiente</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Ya le enviaste una solicitud de contacto permanente. Te notificaremos cuando responda.
            </p>
            <div className="flex items-center justify-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => setIsEditingMessage(true)}
                className="text-xs text-purple-400 hover:text-purple-300 underline font-medium transition-colors"
              >
                Reenviar invitación
              </button>
              <span className="text-slate-600">•</span>
              <button
                type="button"
                onClick={handleCancelRequest}
                className="text-xs text-red-400 hover:text-red-300 underline font-medium transition-colors"
              >
                Cancelar solicitud
              </button>
            </div>
          </div>
        ) : cooldownInfo?.status === "rejected" && cooldownInfo.cooldownRemainingMs > 0 ? (
          <div className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl text-center space-y-1">
            <div className="flex items-center justify-center gap-1.5 text-red-300 font-semibold text-xs">
              <NoSymbolIcon className="w-4 h-4 text-red-400" />
              <span>Solicitud en enfriamiento</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Tu solicitud anterior fue declinada. Podrás enviar una nueva invitación en{" "}
              <strong className="text-slate-200">{hoursRemaining} hora(s)</strong>.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1.5">
                Mensaje de presentación (opcional):
              </label>
              <textarea
                value={introMessage}
                onChange={(e) => setIntroMessage(e.target.value.slice(0, MAX_INTRO_MESSAGE_LENGTH))}
                placeholder={`¡Hola ${authorAlias}! Te vi en ${forumName || "el foro"} y me gustaría conectar...`}
                rows={2}
                maxLength={MAX_INTRO_MESSAGE_LENGTH}
                className="w-full bg-surface-2 border border-surface-2 focus:border-purple-500 text-white text-xs rounded-xl p-2.5 outline-none resize-none transition-colors placeholder:text-slate-500"
              />
              <div className="flex justify-between items-center text-[10px] text-slate-500 mt-1 px-1">
                <span>Directo y cifrado E2EE</span>
                <span>{MAX_INTRO_MESSAGE_LENGTH - introMessage.length} carácteres</span>
              </div>
            </div>

            <div className="flex gap-2">
              {isEditingMessage && (
                <button
                  type="button"
                  onClick={() => setIsEditingMessage(false)}
                  className="py-2.5 px-3 rounded-xl bg-surface-2 hover:bg-surface-3 text-slate-300 text-xs font-semibold transition-colors"
                >
                  Cancelar
                </button>
              )}
              <button
                type="button"
                onClick={handleSend}
                disabled={isSubmitting}
                className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-md shadow-purple-600/20"
              >
                <UserPlusIcon className="w-4 h-4" />
                {isSubmitting
                  ? "Enviando solicitud…"
                  : isEditingMessage
                  ? "Reenviar solicitud"
                  : "Solicitar chat permanente"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
