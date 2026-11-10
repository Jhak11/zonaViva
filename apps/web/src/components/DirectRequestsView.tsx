// ──────────────────────────────────────────────────────────────────────
//  Vista de Solicitudes de Chat Directo (Recibidas y Enviadas)
//  - Respeta regla asimétrica de cooldown (24h solo para el emisor rechazado)
//  - Acciones para aceptar o rechazar solicitudes entrantes
// ──────────────────────────────────────────────────────────────────────
import { useState } from "react";
import { useDirectChatStore } from "@/stores/directChatStore";
import {
  CheckIcon,
  XMarkIcon,
  ClockIcon,
  NoSymbolIcon,
  CheckCircleIcon,
  InboxIcon,
  PaperAirplaneIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";

export function DirectRequestsView() {
  const { requests, respondRequest, cancelRequest, isSending } = useDirectChatStore();
  const [subTab, setSubTab] = useState<"incoming" | "outgoing">("incoming");
  const [processingId, setProcessingId] = useState<string | null>(null);

  const incomingRequests = requests.filter((r) => r.direction === "incoming" && r.status === "pending");
  const outgoingRequests = requests.filter((r) => r.direction === "outgoing" && r.status !== "accepted");

  const avatarColors = [
    "from-purple-500 to-indigo-600",
    "from-emerald-500 to-teal-600",
    "from-amber-500 to-orange-600",
    "from-pink-500 to-rose-600",
    "from-blue-500 to-cyan-600",
  ];

  const handleRespond = async (requestId: string, action: "accept" | "reject") => {
    setProcessingId(requestId);
    await respondRequest(requestId, action);
    setProcessingId(null);
  };

  const formatRelativeTime = (ts: number) => {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / (1000 * 60));
    if (mins < 1) return "hace un momento";
    if (mins < 60) return `hace ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `hace ${hours} h`;
    const days = Math.floor(hours / 24);
    return `hace ${days} d`;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Sub-selector de solicitudes */}
      <div className="p-3 bg-surface-1 border-b border-surface-2 flex-none">
        <div className="flex bg-surface-2 rounded-xl p-1 text-xs font-semibold max-w-sm mx-auto">
          <button
            type="button"
            onClick={() => setSubTab("incoming")}
            className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
              subTab === "incoming"
                ? "bg-purple-600 text-white shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <InboxIcon className="w-3.5 h-3.5" />
            <span>Recibidas ({incomingRequests.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab("outgoing")}
            className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
              subTab === "outgoing"
                ? "bg-purple-600 text-white shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <PaperAirplaneIcon className="w-3.5 h-3.5" />
            <span>Enviadas ({outgoingRequests.length})</span>
          </button>
        </div>
      </div>

      {/* Lista de solicitudes */}
      <div className="flex-1 overflow-y-auto p-4 max-w-lg mx-auto w-full space-y-3">
        {subTab === "incoming" ? (
          incomingRequests.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="w-14 h-14 rounded-2xl bg-surface-2 flex items-center justify-center mx-auto mb-3 text-slate-400">
                <InboxIcon className="w-7 h-7 text-slate-400" />
              </div>
              <h3 className="text-xs font-bold text-white mb-1">Sin solicitudes pendientes</h3>
              <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                Cuando alguien te envíe una invitación de contacto permanente desde un foro o chat aleatorio, la verás aquí.
              </p>
            </div>
          ) : (
            incomingRequests.map((req) => {
              const charCode = req.peerAlias.charCodeAt(0) || 0;
              const colorGradient = avatarColors[charCode % avatarColors.length];
              const isWorking = processingId === req.id || isSending;

              return (
                <div
                  key={req.id}
                  className="bg-surface-1 border border-surface-2 rounded-2xl p-4 shadow-sm animate-fade-in"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${colorGradient} flex items-center justify-center text-white text-sm font-bold flex-none shadow-sm`}
                    >
                      {req.peerAlias.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <h4 className="text-xs font-bold text-white truncate">{req.peerAlias}</h4>
                        <span className="text-[10px] text-slate-500">
                          {formatRelativeTime(req.createdAt)}
                        </span>
                      </div>
                      {req.sourceForumName ? (
                        <p className="text-[10px] text-purple-300 truncate">
                          Visto en: {req.sourceForumName}
                        </p>
                      ) : (
                        <p className="text-[10px] text-slate-400">Contacto aleatorio</p>
                      )}
                    </div>
                  </div>

                  {req.introMessage && (
                    <div className="mb-3 p-2.5 rounded-xl bg-surface-2/60 border border-surface-2 text-xs text-slate-300 italic">
                      "{req.introMessage}"
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      disabled={isWorking}
                      onClick={() => handleRespond(req.id, "accept")}
                      className="flex-1 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                    >
                      <CheckIcon className="w-3.5 h-3.5" />
                      <span>Aceptar</span>
                    </button>
                    <button
                      type="button"
                      disabled={isWorking}
                      onClick={() => handleRespond(req.id, "reject")}
                      className="px-3.5 py-2 rounded-xl bg-surface-2 hover:bg-red-500/20 text-slate-400 hover:text-red-300 disabled:opacity-50 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border border-surface-2"
                    >
                      <XMarkIcon className="w-3.5 h-3.5" />
                      <span>Rechazar</span>
                    </button>
                  </div>
                </div>
              );
            })
          )
        ) : outgoingRequests.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="w-14 h-14 rounded-2xl bg-surface-2 flex items-center justify-center mx-auto mb-3 text-slate-400">
              <PaperAirplaneIcon className="w-7 h-7 text-slate-400" />
            </div>
            <h3 className="text-xs font-bold text-white mb-1">No has enviado solicitudes</h3>
            <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
              Toca el alias de un autor en cualquier foro o presiona "Guardar contacto" en el chat aleatorio para conectar.
            </p>
          </div>
        ) : (
          outgoingRequests.map((req) => {
            const charCode = req.peerAlias.charCodeAt(0) || 0;
            const colorGradient = avatarColors[charCode % avatarColors.length];

            const now = Date.now();
            const cooldownRemainingMs = req.cooldownUntil ? Math.max(0, req.cooldownUntil - now) : 0;
            const hoursRemaining = Math.ceil(cooldownRemainingMs / (1000 * 60 * 60));

            return (
              <div
                key={req.id}
                className="bg-surface-1 border border-surface-2 rounded-2xl p-4 shadow-sm animate-fade-in"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${colorGradient} flex items-center justify-center text-white text-sm font-bold flex-none shadow-sm`}
                  >
                    {req.peerAlias.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <h4 className="text-xs font-bold text-white truncate">{req.peerAlias}</h4>
                      <span className="text-[10px] text-slate-500">
                        {formatRelativeTime(req.createdAt)}
                      </span>
                    </div>
                    {req.sourceForumName && (
                      <p className="text-[10px] text-slate-400 truncate">
                        Para foro: {req.sourceForumName}
                      </p>
                    )}
                  </div>
                </div>

                {req.introMessage && (
                  <p className="text-xs text-slate-400 italic mb-3 px-1">
                    "{req.introMessage}"
                  </p>
                )}

                {/* Badge de estado y acciones */}
                <div className="mt-2 pt-2 border-t border-surface-2/40 flex items-center justify-between text-xs">
                  {req.status === "pending" && (
                    <div className="flex items-center justify-between w-full">
                      <span className="inline-flex items-center gap-1.5 text-amber-400 font-medium text-[11px]">
                        <ClockIcon className="w-3.5 h-3.5" />
                        <span>Pendiente de respuesta</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => cancelRequest(req.id)}
                        className="text-[11px] text-red-400 hover:text-red-300 font-medium flex items-center gap-1 py-1 px-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 transition-colors"
                        title="Cancelar solicitud y liberar espera"
                      >
                        <TrashIcon className="w-3.5 h-3.5" />
                        <span>Cancelar</span>
                      </button>
                    </div>
                  )}
                  {req.status === "expired" && (
                    <div className="flex items-center justify-between w-full">
                      <span className="inline-flex items-center gap-1.5 text-slate-400 font-medium text-[11px]">
                        <ClockIcon className="w-3.5 h-3.5 text-slate-500" />
                        <span>Expirada (Sin respuesta / Inactivo)</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => cancelRequest(req.id)}
                        className="text-[11px] text-purple-400 hover:text-purple-300 font-medium py-1 px-2 rounded-lg bg-surface-2 hover:bg-surface-3 transition-colors"
                        title="Descartar del historial"
                      >
                        Descartar
                      </button>
                    </div>
                  )}
                  {req.status === "accepted" && (
                    <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium text-[11px]">
                      <CheckCircleIcon className="w-3.5 h-3.5" />
                      <span>Contacto guardado</span>
                    </span>
                  )}
                  {req.status === "rejected" && (
                    <div className="flex items-center justify-between w-full">
                      <div className="flex flex-col gap-0.5 text-[11px]">
                        <span className="inline-flex items-center gap-1.5 text-red-400 font-medium">
                          <NoSymbolIcon className="w-3.5 h-3.5" />
                          <span>Solicitud declinada</span>
                        </span>
                        {cooldownRemainingMs > 0 ? (
                          <span className="text-[10px] text-slate-500">
                            Enfriamiento activo: disponible en {hoursRemaining}h
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">
                            Enfriamiento finalizado: puedes volver a solicitarle
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => cancelRequest(req.id)}
                        className="text-[11px] text-slate-400 hover:text-white py-1 px-2 rounded-lg bg-surface-2 hover:bg-surface-3 transition-colors"
                        title="Descartar del historial"
                      >
                        Descartar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
