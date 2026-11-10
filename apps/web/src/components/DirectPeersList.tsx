// ──────────────────────────────────────────────────────────────────────
//  Lista de Pares Permanentes (Contactos Guardados)
//  Permite acceder a los chats 1:1 guardados sin restricción de zona.
// ──────────────────────────────────────────────────────────────────────
import { useDirectChatStore } from "@/stores/directChatStore";
import type { DirectPeer } from "@zonaviva/protocol";
import { MAX_DIRECT_PEERS_PER_CLIENT } from "@zonaviva/protocol";
import {
  UserGroupIcon,
  ChatBubbleLeftEllipsisIcon,
  SparklesIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";

interface DirectPeersListProps {
  onSelectPeer: (peer: DirectPeer) => void;
}

export function DirectPeersList({ onSelectPeer }: DirectPeersListProps) {
  const { peers } = useDirectChatStore();

  const avatarColors = [
    "from-purple-500 to-indigo-600",
    "from-emerald-500 to-teal-600",
    "from-amber-500 to-orange-600",
    "from-pink-500 to-rose-600",
    "from-blue-500 to-cyan-600",
  ];

  const formatRelativeTime = (ts: number) => {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / (1000 * 60));
    if (mins < 1) return "ahora";
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  };

  if (peers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center mb-4 shadow-sm">
          <UserGroupIcon className="w-8 h-8 text-purple-400" />
        </div>
        <h3 className="text-sm font-bold text-white mb-1.5">No tienes contactos guardados</h3>
        <p className="text-xs text-slate-400 max-w-xs leading-relaxed mb-6">
          Puedes guardar hasta {MAX_DIRECT_PEERS_PER_CLIENT} contactos permanentes para conversar sin límite de zona:
        </p>
        <div className="space-y-2 text-left max-w-xs w-full text-xs text-slate-300">
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-surface-1 border border-surface-2">
            <ChatBubbleLeftEllipsisIcon className="w-4 h-4 text-purple-400 flex-none mt-0.5" />
            <span className="leading-snug">
              <strong>En foros:</strong> Toca el nombre de cualquier usuario para solicitarle chat directo.
            </span>
          </div>
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-surface-1 border border-surface-2">
            <SparklesIcon className="w-4 h-4 text-indigo-400 flex-none mt-0.5" />
            <span className="leading-snug">
              <strong>En chat aleatorio:</strong> Presiona "Guardar contacto" durante una conversación afín.
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Indicador explícito de límite de contactos */}
      <div className="px-4 py-2.5 bg-surface-1/40 border-b border-surface-2 flex items-center justify-between text-xs text-slate-400">
        <span>Contactos guardados</span>
        <span className="px-2 py-0.5 rounded-full bg-surface-2 text-slate-300 font-semibold text-[11px]">
          {peers.length} / {MAX_DIRECT_PEERS_PER_CLIENT}
        </span>
      </div>

      <div className="divide-y divide-surface-2/40">
      {peers.map((peer) => {
        const charCode = peer.alias.charCodeAt(0) || 0;
        const colorGradient = avatarColors[charCode % avatarColors.length];
        const hasUnread = (peer.unreadCount ?? 0) > 0;

        return (
          <button
            key={peer.peerPublicKey}
            type="button"
            onClick={() => onSelectPeer(peer)}
            className="w-full flex items-center gap-3.5 p-4 hover:bg-surface-1/60 transition-colors text-left"
          >
            {/* Avatar */}
            <div
              className={`w-11 h-11 rounded-2xl bg-gradient-to-tr ${colorGradient} flex items-center justify-center text-white text-base font-bold flex-none shadow-sm relative`}
            >
              {peer.alias.charAt(0).toUpperCase()}
              {hasUnread && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-2 ring-surface-0 flex items-center justify-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                </span>
              )}
            </div>

            {/* Datos */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <h4 className="text-xs font-bold text-white truncate">{peer.alias}</h4>
                {peer.isDeletedByPeer ? (
                  <span className="text-[10px] text-red-400 font-medium flex items-center gap-1 flex-none bg-red-500/10 px-1.5 py-0.5 rounded-md border border-red-500/20">
                    <ExclamationTriangleIcon className="w-3 h-3 text-red-400" />
                    <span>Perfil eliminado</span>
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-500 flex-none">
                    {formatRelativeTime(peer.lastInteractionTs)}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between gap-2">
                <p
                  className={`text-xs truncate ${
                    peer.isDeletedByPeer
                      ? "text-red-300/80 italic text-[11px]"
                      : hasUnread
                      ? "text-slate-200 font-medium"
                      : "text-slate-400"
                  }`}
                >
                  {peer.isDeletedByPeer
                    ? "Usuario eliminó su perfil · Se recomienda borrar este chat"
                    : peer.lastMessagePreview || "Conversación directa iniciada"}
                </p>
                {hasUnread && !peer.isDeletedByPeer && (
                  <span className="px-1.5 py-0.5 rounded-full bg-purple-500/30 text-purple-200 text-[10px] font-bold border border-purple-500/40 flex-none">
                    {peer.unreadCount}
                  </span>
                )}
              </div>
            </div>
          </button>
        );
      })}
      </div>
    </div>
  );
}
