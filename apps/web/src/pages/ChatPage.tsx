// ──────────────────────────────────────────────────────────────────────
//  V7 – Centro de Mensajería: Chat Aleatorio y Pares Permanentes E2EE
//  - Pestaña Aleatorio: Chat 1:1 efímero de proximidad (zonas y foros temporales)
//  - Pestaña Contactos: Chats directos guardados sin limitación geográfica
//  - Pestaña Solicitudes: Gestión de solicitudes entrantes y salientes
// ──────────────────────────────────────────────────────────────────────
import { useState, useEffect, useRef, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useRandomChatStore } from "@/stores/randomChatStore";
import { useDirectChatStore } from "@/stores/directChatStore";
import { useGeoStore } from "@/stores/geoStore";
import { useForumStore } from "@/stores/forumStore";
import { useIdentityStore } from "@/stores/identityStore";
import { ZONES, MAX_DIRECT_PEERS_PER_CLIENT } from "@zonaviva/protocol";
import { saveDirectPeer, saveDirectRequest } from "@/db/storage";
import { getOrCreatePersistentE2EEKeyPair, getDirectChannelId } from "@/modules/e2ee";
import { distanceMeters } from "@/geo/geoCore";
import { DirectPeersList } from "@/components/DirectPeersList";
import { DirectRequestsView } from "@/components/DirectRequestsView";
import { DirectConversationView } from "@/components/DirectConversationView";
import {
  ShieldCheckIcon,
  SparklesIcon,
  ArrowPathIcon,
  XMarkIcon,
  PaperAirplaneIcon,
  InformationCircleIcon,
  ChevronLeftIcon,
  LockClosedIcon,
  UserGroupIcon,
  InboxIcon,
  BookmarkIcon,
  MapPinIcon,
  CheckCircleIcon,
  NoSymbolIcon,
  ChatBubbleLeftRightIcon,
} from "@heroicons/react/24/outline";

export default function ChatPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get("tab");
  const [mainTab, setMainTab] = useState<"aleatorio" | "contactos" | "solicitudes">(
    urlTab === "contacts" ? "contactos" : urlTab === "requests" ? "solicitudes" : "aleatorio"
  );

  // Stores
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
    activeScopes,
    enterLobby,
    leaveLobby,
  } = useRandomChatStore();

  const {
    requests,
    unreadTotal,
    activeDirectPeer,
    openDirectChat,
    closeDirectChat,
    initDirectStore,
  } = useDirectChatStore();

  const session = useIdentityStore((s) => s.session);
  const { 
    effectiveZone: getEffectiveZone, 
    manualZone, 
    userPosition,
    detectedZones,
    simulatedZone,
    canPublishInZone,
  } = useGeoStore();
  const { myUserForums, nearbyUserForums, fetchNearbyUserForums } = useForumStore();

  const currentZone = getEffectiveZone();
  const effectiveZone = manualZone ?? currentZone ?? ZONES[0];

  const [selectedZoneId, setSelectedZoneId] = useState<string>(
    zoneId ?? effectiveZone?.id ?? ZONES[0].id
  );
  const [scopeTab, setScopeTab] = useState<"zonas" | "user_forums">("zonas");
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showSasModal, setShowSasModal] = useState(false);
  const [contactInviteSent, setContactInviteSent] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Sincronizar parámetro de URL si cambia
  useEffect(() => {
    if (urlTab === "contacts") setMainTab("contactos");
    else if (urlTab === "requests") setMainTab("solicitudes");
  }, [urlTab]);

  // Inicializar store de pares permanentes una sola vez
  useEffect(() => {
    initDirectStore();
  }, [initDirectStore]);

  // Lobby aleatorio y foros cercanos según posición física
  useEffect(() => {
    enterLobby();
    fetchNearbyUserForums(userPosition);
    return () => {
      leaveLobby();
    };
  }, [enterLobby, leaveLobby, fetchNearbyUserForums, userPosition]);

  // Auto-scroll al recibir o enviar mensajes en chat aleatorio
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  // Actualizar zona seleccionada por defecto si cambia la posición
  useEffect(() => {
    if (status === "idle" && effectiveZone) {
      setSelectedZoneId((prev) => prev || effectiveZone.id);
    }
  }, [effectiveZone, status]);

  // Restablecer bandera de invitación al salir de chat aleatorio
  useEffect(() => {
    if (status === "idle") {
      setContactInviteSent(false);
    }
  }, [status]);

  // Consolidar foros temporales disponibles a mi alrededor o donde participo
  const availableUserForums = useMemo(() => {
    const map = new Map<string, { id: string; name: string; description?: string; latitude?: number; longitude?: number; radius?: number }>();
    for (const f of myUserForums) {
      map.set(f.id, { 
        id: f.id, 
        name: f.name, 
        description: f.description,
        latitude: f.latitude,
        longitude: f.longitude,
        radius: f.radius,
      });
    }
    for (const f of nearbyUserForums) {
      if (!map.has(f.id)) {
        map.set(f.id, { 
          id: f.id, 
          name: f.name, 
          description: f.description,
          latitude: f.latitude,
          longitude: f.longitude,
          radius: f.radius,
        });
      }
    }
    return Array.from(map.values());
  }, [myUserForums, nearbyUserForums]);

  // Ámbitos activos filtrados: Solo relevantes si el usuario está físicamente presente o suscrito
  const relevantActiveScopes = useMemo(() => {
    const relevant = new Set<string>();

    for (const scopeId of activeScopes) {
      // 1. Zonas fijas
      const zone = ZONES.find((z) => z.id === scopeId);
      if (zone) {
        const isPresent =
          simulatedZone?.id === zone.id ||
          detectedZones.some((z) => z.id === zone.id) ||
          canPublishInZone(zone.id);
        const isSubscribed = myUserForums.some(
          (f) => f.id === `zone:${zone.id}` || f.id === zone.id
        );
        if (isPresent || isSubscribed) {
          relevant.add(scopeId);
        }
        continue;
      }

      // 2. Foros temporales de usuario
      const userForum = availableUserForums.find((f) => f.id === scopeId);
      if (userForum) {
        const isSubscribed = myUserForums.some((f) => f.id === scopeId);
        const isPresent = Boolean(
          userPosition &&
            userForum.latitude &&
            userForum.longitude &&
            distanceMeters(
              userPosition.latitude,
              userPosition.longitude,
              userForum.latitude,
              userForum.longitude
            ) <=
              (userForum.radius || 300) + 50
        );
        if (isPresent || isSubscribed) {
          relevant.add(scopeId);
        }
      }
    }

    return relevant;
  }, [
    activeScopes,
    simulatedZone,
    detectedZones,
    canPublishInZone,
    myUserForums,
    availableUserForums,
    userPosition,
  ]);

  // Foros temporales permitidos para búsqueda (ámbito físico o suscritos en Mis Foros)
  const allowedUserForums = useMemo(() => {
    return availableUserForums.filter((f) => {
      const isSubscribed = myUserForums.some((my) => my.id === f.id);
      const isPresent = Boolean(
        userPosition &&
          f.latitude &&
          f.longitude &&
          distanceMeters(
            userPosition.latitude,
            userPosition.longitude,
            f.latitude,
            f.longitude
          ) <=
            (f.radius || 300) + 50
      );
      return isPresent || isSubscribed;
    });
  }, [availableUserForums, myUserForums, userPosition]);

  // Mantener selectedZoneId sincronizado con un ámbito válido
  useEffect(() => {
    const allAllowedIds = [
      ...ZONES.map((z) => z.id),
      ...allowedUserForums.map((f) => f.id),
    ];

    if (allAllowedIds.length === 0) {
      if (selectedZoneId !== "") setSelectedZoneId("");
      return;
    }

    if (!selectedZoneId || !allAllowedIds.includes(selectedZoneId)) {
      if (scopeTab === "zonas" && ZONES.length > 0) {
        setSelectedZoneId(effectiveZone?.id ?? ZONES[0].id);
      } else if (allowedUserForums.length > 0) {
        setSelectedZoneId(allowedUserForums[0].id);
      } else if (ZONES.length > 0) {
        setSelectedZoneId(ZONES[0].id);
      }
    }
  }, [allowedUserForums, selectedZoneId, scopeTab, effectiveZone]);

  // Nombre descriptivo del ámbito actualmente seleccionado
  const activeScopeName = useMemo(() => {
    const permanentZone = ZONES.find((z) => z.id === selectedZoneId);
    if (permanentZone) return permanentZone.name;
    const userForum = availableUserForums.find((f) => f.id === selectedZoneId);
    if (userForum) return userForum.name;
    return "esta ubicación";
  }, [selectedZoneId, availableUserForums]);

  const activeZoneObj = useMemo(() => {
    return (
      ZONES.find((z) => z.id === zoneId) ||
      availableUserForums.find((f) => f.id === zoneId) ||
      effectiveZone ||
      ZONES[0]
    );
  }, [zoneId, effectiveZone, availableUserForums]);

  const pendingIncomingCount = requests.filter(
    (r) => r.direction === "incoming" && r.status === "pending"
  ).length;

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

  // Enviar invitación de contacto permanente a través del túnel E2EE del chat aleatorio
  const handleSendContactInvite = async () => {
    if (!session || contactInviteSent) return;
    const currentPeers = useDirectChatStore.getState().peers;
    if (currentPeers.length >= MAX_DIRECT_PEERS_PER_CLIENT) {
      alert(`Has alcanzado el límite máximo de ${MAX_DIRECT_PEERS_PER_CLIENT} contactos guardados. Elimina alguno antes de agregar nuevos.`);
      return;
    }
    try {
      const myKeyPair = await getOrCreatePersistentE2EEKeyPair();
      const payload = {
        __type: "SAVE_CONTACT_REQUEST",
        alias: session.alias,
        publicKey: session.publicKey,
        e2eePublicKey: myKeyPair.publicKey,
        sourceForumName: activeZoneObj.name,
      };
      await sendMessage(JSON.stringify(payload));
      setContactInviteSent(true);
    } catch (err) {
      console.error("[ChatPage] Error al invitar contacto:", err);
    }
  };

  // Aceptar invitación de contacto permanente recibida en chat aleatorio
  const handleAcceptContactInvite = async (invite: any) => {
    if (!session) return;
    const currentPeers = useDirectChatStore.getState().peers;
    if (currentPeers.length >= MAX_DIRECT_PEERS_PER_CLIENT) {
      alert(`Has alcanzado el límite de contactos (${MAX_DIRECT_PEERS_PER_CLIENT}). Elimina alguno para poder aceptar.`);
      return;
    }
    try {
      const myKeyPair = await getOrCreatePersistentE2EEKeyPair();
      const channelId = getDirectChannelId(session.publicKey, invite.publicKey);

      // Guardar contacto en IndexedDB local
      await saveDirectPeer({
        peerPublicKey: invite.publicKey,
        alias: invite.alias || "Vecino",
        channelId,
        e2eePublicKey: invite.e2eePublicKey,
        createdAt: Date.now(),
        lastInteractionTs: Date.now(),
        unreadCount: 0,
      });

      // Confirmar al par por el túnel cifrado
      const reply = {
        __type: "SAVE_CONTACT_ACCEPTED",
        alias: session.alias,
        publicKey: session.publicKey,
        e2eePublicKey: myKeyPair.publicKey,
      };
      await sendMessage(JSON.stringify(reply));
      await useDirectChatStore.getState().loadData();
    } catch (err) {
      console.error("[ChatPage] Error al aceptar invitación de contacto:", err);
    }
  };

  // Rechazar invitación de contacto permanente recibida en chat aleatorio
  const handleRejectContactInvite = async (_invite: any) => {
    try {
      const reply = {
        __type: "SAVE_CONTACT_REJECTED",
      };
      await sendMessage(JSON.stringify(reply));
    } catch (err) {
      console.error("[ChatPage] Error al rechazar contacto:", err);
    }
  };

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // Si estamos en la vista de conversación directa con un contacto
  if (mainTab === "contactos" && activeDirectPeer) {
    return (
      <DirectConversationView
        peer={activeDirectPeer}
        onBack={() => closeDirectChat()}
      />
    );
  }

  // Si estamos en una conversación activa o buscando en el chat aleatorio, priorizar pantalla completa
  const isInActiveRandomChat = status === "searching" || status === "matched" || status === "ended";

  return (
    <div className="flex flex-col h-full bg-surface-0">
      {/* ── Barra Superior de Pestañas Principales (Solo si no estamos en chat activo) ── */}
      {!isInActiveRandomChat && (
        <div className="bg-surface-1 border-b border-surface-2 px-4 py-2.5 flex-none shadow-sm">
          <div className="flex bg-surface-2 rounded-xl p-1 text-xs font-semibold max-w-sm mx-auto">
            <button
              type="button"
              onClick={() => {
                setMainTab("aleatorio");
                setSearchParams({});
              }}
              className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
                mainTab === "aleatorio"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <SparklesIcon className="w-3.5 h-3.5" />
              <span>Aleatorio</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMainTab("contactos");
                setSearchParams({ tab: "contacts" });
              }}
              className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-colors relative ${
                mainTab === "contactos"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <UserGroupIcon className="w-3.5 h-3.5" />
              <span>Contactos</span>
              {unreadTotal > 0 && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setMainTab("solicitudes");
                setSearchParams({ tab: "requests" });
              }}
              className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-colors relative ${
                mainTab === "solicitudes"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <InboxIcon className="w-3.5 h-3.5" />
              <span>Solicitudes</span>
              {pendingIncomingCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-purple-500 text-white text-[10px] font-bold">
                  {pendingIncomingCount}
                </span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── PESTAÑA: CONTACTOS GUARDADOS ── */}
      {mainTab === "contactos" && !isInActiveRandomChat && (
        <div className="flex-1 overflow-y-auto max-w-lg mx-auto w-full">
          <DirectPeersList
            onSelectPeer={(peer) => openDirectChat(peer.peerPublicKey)}
          />
        </div>
      )}

      {/* ── PESTAÑA: SOLICITUDES PENDIENTES ── */}
      {mainTab === "solicitudes" && !isInActiveRandomChat && (
        <div className="flex-1 overflow-hidden">
          <DirectRequestsView />
        </div>
      )}

      {/* ── PESTAÑA: CHAT ALEATORIO EFÍMERO (O CUANDO ESTÁ ACTIVO) ── */}
      {(mainTab === "aleatorio" || isInActiveRandomChat) && (
        <>
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

                {/* Banner de actividad en vivo si hay personas buscando en zonas relevantes */}
                {relevantActiveScopes.size > 0 && (
                  <div className="mb-5 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2.5 animate-fade-in shadow-sm">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse flex-none" />
                    <span className="leading-tight">
                      ¡Hay vecinos esperando conversación en tus zonas activas o guardadas! Selecciona los ámbitos con el indicador verde para conectar de inmediato.
                    </span>
                  </div>
                )}

                {/* Selector de Ámbito (Zonas Fijas y Foros Temporales) */}
                <div className="bg-surface-1 rounded-2xl p-4 border border-surface-2 mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Ámbito para buscar:
                    </label>
                    <div className="flex bg-surface-2 rounded-lg p-0.5 text-[11px] font-semibold">
                      <button
                        type="button"
                        onClick={() => setScopeTab("zonas")}
                        className={`px-2.5 py-1 rounded-md transition-colors ${
                          scopeTab === "zonas"
                            ? "bg-purple-600 text-white"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        Zonas ({ZONES.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setScopeTab("user_forums")}
                        className={`px-2.5 py-1 rounded-md transition-colors ${
                          scopeTab === "user_forums"
                            ? "bg-purple-600 text-white"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        Foros Temporales ({allowedUserForums.length})
                      </button>
                    </div>
                  </div>

                  {scopeTab === "zonas" ? (
                    <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto pr-1">
                      {ZONES.map((zone) => {
                        const isSelected = zone.id === selectedZoneId;
                        const hasWaiting = relevantActiveScopes.has(zone.id);

                        return (
                          <button
                            key={zone.id}
                            type="button"
                            onClick={() => setSelectedZoneId(zone.id)}
                            className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                              isSelected
                                ? "bg-purple-500/15 border-purple-500 text-white shadow-md shadow-purple-500/10 ring-1 ring-purple-500/30"
                                : "bg-surface-2/40 border-surface-2 text-slate-300 hover:bg-surface-2/80"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 pr-2">
                              <span
                                className="w-3 h-3 rounded-full flex-none"
                                style={{ backgroundColor: zone.color || "#0284c7" }}
                              />
                              <div className="min-w-0">
                                <p className="text-xs font-semibold truncate">{zone.name}</p>
                                <p className="text-[10px] text-slate-400 truncate max-w-[180px]">
                                  {zone.description}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 flex-none">
                              {hasWaiting && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-semibold animate-pulse">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                  Esperando
                                </span>
                              )}
                              {isSelected && (
                                <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    allowedUserForums.length === 0 ? (
                      <div className="p-4 rounded-xl bg-surface-2/30 border border-surface-2 text-center my-1">
                        <MapPinIcon className="w-6 h-6 text-slate-500 mx-auto mb-2" />
                        <p className="text-xs text-slate-300 font-semibold mb-1">
                          No hay foros temporales a tu alcance
                        </p>
                        <p className="text-[11px] text-slate-400 leading-relaxed mb-3">
                          Solo puedes buscar en foros temporales donde estés dentro del radio geográfico o participes activamente.
                        </p>
                        <Link
                          to="/foros/nuevo"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-semibold hover:bg-purple-500/30 transition-colors"
                        >
                          Crear foro temporal aquí
                        </Link>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                        {allowedUserForums.map((f) => {
                          const isSelected = f.id === selectedZoneId;
                          const hasWaiting = relevantActiveScopes.has(f.id);

                          return (
                            <button
                              key={f.id}
                              type="button"
                              onClick={() => setSelectedZoneId(f.id)}
                              className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                                isSelected
                                  ? "bg-purple-500/15 border-purple-500 text-white shadow-md shadow-purple-500/10 ring-1 ring-purple-500/30"
                                  : "bg-surface-2/40 border-surface-2 text-slate-300 hover:bg-surface-2/80"
                              }`}
                            >
                              <div className="min-w-0 pr-2">
                                <div className="flex items-center gap-1.5">
                                  <MapPinIcon className="w-3.5 h-3.5 text-purple-400 flex-none" />
                                  <p className="text-xs font-semibold truncate">{f.name}</p>
                                </div>
                                {f.description && (
                                  <p className="text-[10px] text-slate-400 truncate mt-0.5">
                                    {f.description}
                                  </p>
                                )}
                              </div>

                              <div className="flex items-center gap-2 flex-none">
                                {hasWaiting && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-semibold animate-pulse">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                    Esperando
                                  </span>
                                )}
                                {isSelected && (
                                  <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )
                  )}
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
                  disabled={!selectedZoneId}
                  className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm transition-all shadow-lg shadow-purple-600/30 active:scale-[0.99] flex items-center justify-center gap-2"
                >
                  <SparklesIcon className="w-5 h-5" />
                  <span>
                    {selectedZoneId
                      ? `Buscar vecino en ${activeScopeName}`
                      : `No hay zonas disponibles para búsqueda`}
                  </span>
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
                Esperando a otro vecino disponible en este ámbito:
              </p>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 font-semibold text-xs border border-purple-500/30 mb-8">
                <MapPinIcon className="w-3.5 h-3.5 flex-none" />
                <span>{activeScopeName}</span>
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
                          <span
                            className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"
                            title="Conectado"
                          ></span>
                        ) : (
                          <span
                            className="w-2 h-2 rounded-full bg-slate-500"
                            title="Desconectado"
                          ></span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400">
                        Ámbito: {activeZoneObj.name}
                      </p>
                    </div>
                  </div>

                  {/* Controles de verificación y cambio */}
                  <div className="flex items-center gap-2">
                    {/* Botón para solicitar par permanente desde el chat aleatorio */}
                    {status === "matched" && (
                      <button
                        onClick={handleSendContactInvite}
                        disabled={contactInviteSent}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-[11px] font-semibold transition-colors flex items-center gap-1.5 disabled:opacity-50"
                        title="Solicitar guardar como contacto permanente"
                      >
                        <BookmarkIcon className="w-3.5 h-3.5 flex-none" />
                        <span className="hidden sm:inline">
                          {contactInviteSent ? "Invitado" : "Guardar contacto"}
                        </span>
                      </button>
                    )}

                    {securityCode && (
                      <button
                        onClick={() => setShowSasModal(true)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-surface-2 border border-surface-2 hover:border-purple-500/50 text-[10px] text-purple-300 transition-colors"
                        title="Verificar código de cifrado SAS"
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
                <span>Chat efímero cifrado extremo a extremo (E2EE) · Sin historial en disco</span>
              </div>

              {/* Lista de mensajes (scrollable) */}
              <div className="flex-1 overflow-y-auto px-4 py-4 max-w-lg mx-auto w-full space-y-3">
                {messages.length === 0 && status === "matched" && (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-300 flex items-center justify-center mx-auto mb-2">
                      <ChatBubbleLeftRightIcon className="w-6 h-6 text-purple-400" />
                    </div>
                    <p className="text-xs text-slate-300 font-semibold mb-1">
                      ¡Están conectados de forma segura!
                    </p>
                    <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                      Saluda a tu vecino. Si la conversación es amena, pueden presionar "Guardar contacto" para continuar hablando permanentemente.
                    </p>
                  </div>
                )}

                {messages.map((m) => {
                  const isMe = m.sender === "me";

                  // Detección de mensajes interactivos de invitación de contacto permanente
                  if (m.text.startsWith('{"__type":"SAVE_CONTACT_')) {
                    try {
                      const invite = JSON.parse(m.text);
                      if (invite.__type === "SAVE_CONTACT_REQUEST") {
                        if (isMe) {
                          return (
                            <div key={m.id} className="flex justify-center my-2 animate-fade-in">
                              <span className="px-3 py-1.5 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-200 text-[11px] font-medium flex items-center gap-1.5 shadow-sm">
                                <BookmarkIcon className="w-3.5 h-3.5 text-purple-300 flex-none" />
                                <span>Enviaste una solicitud para guardar contacto permanente</span>
                              </span>
                            </div>
                          );
                        }
                        return (
                          <div
                            key={m.id}
                            className="p-3.5 my-2 rounded-2xl bg-surface-1 border border-purple-500/40 text-center shadow-lg animate-fade-in max-w-sm mx-auto"
                          >
                            <p className="text-xs font-bold text-white mb-1 flex items-center justify-center gap-1.5">
                              <BookmarkIcon className="w-4 h-4 text-purple-400 flex-none" />
                              <span>{invite.alias || "Tu interlocutor"} quiere guardar este contacto</span>
                            </p>
                            <p className="text-[11px] text-slate-300 mb-3 leading-relaxed">
                              Si aceptas, podrán seguir conversando en cualquier momento desde su pestaña de Contactos sin importar la zona.
                            </p>
                            <div className="flex items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleAcceptContactInvite(invite)}
                                className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-sm transition-colors"
                              >
                                Aceptar contacto
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRejectContactInvite(invite)}
                                className="px-3 py-1.5 rounded-xl bg-surface-2 hover:bg-surface-2/80 text-slate-400 hover:text-white text-xs transition-colors"
                              >
                                Rechazar
                              </button>
                            </div>
                          </div>
                        );
                      }
                      if (invite.__type === "SAVE_CONTACT_ACCEPTED") {
                        // Guardar también en mi propia lista local si recibí la aceptación
                        if (!isMe && session) {
                          saveDirectPeer({
                            peerPublicKey: invite.publicKey,
                            alias: invite.alias || "Vecino",
                            channelId: getDirectChannelId(session.publicKey, invite.publicKey),
                            e2eePublicKey: invite.e2eePublicKey,
                            createdAt: Date.now(),
                            lastInteractionTs: Date.now(),
                            unreadCount: 0,
                          }).then(() => useDirectChatStore.getState().loadData());
                        }

                        return (
                          <div key={m.id} className="flex justify-center my-2 animate-fade-in">
                            <span className="px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[11px] font-medium flex items-center gap-1.5 shadow-sm">
                              <CheckCircleIcon className="w-4 h-4 text-emerald-400 flex-none" />
                              <span>¡Contacto permanente guardado! Disponible en la pestaña Contactos.</span>
                            </span>
                          </div>
                        );
                      }
                      if (invite.__type === "SAVE_CONTACT_REJECTED") {
                        // Si fui el rechazado, guardar cooldown de 24h
                        if (isMe) {
                          saveDirectRequest({
                            id: "req_" + Date.now(),
                            peerPublicKey: "peer_random_" + Date.now(),
                            peerAlias: "Vecino Anónimo",
                            direction: "outgoing",
                            status: "rejected",
                            e2eePublicKey: "",
                            createdAt: Date.now(),
                            cooldownUntil: Date.now() + 24 * 60 * 60 * 1000,
                          }).then(() => useDirectChatStore.getState().loadData());
                        }

                        return (
                          <div key={m.id} className="flex justify-center my-2 animate-fade-in">
                            <span className="px-3 py-1.5 rounded-full bg-red-500/20 border border-red-500/30 text-red-300 text-[11px] font-medium flex items-center gap-1.5 shadow-sm">
                              <NoSymbolIcon className="w-4 h-4 text-red-400 flex-none" />
                              <span>La invitación de contacto permanente fue declinada.</span>
                            </span>
                          </div>
                        );
                      }
                    } catch {
                      // Fallback a mensaje estándar
                    }
                  }

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
        </>
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
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300 mb-4 leading-relaxed">
              Verifica con tu interlocutor que ambos vean exactamente los mismos números. Si coinciden, garantizan que no hay intermediarios en su conversación:
            </p>

            <div className="bg-surface-0 border border-purple-500/30 rounded-xl p-4 text-center mb-5 shadow-inner">
              <span className="font-mono text-2xl font-bold tracking-widest text-purple-400">
                {securityCode}
              </span>
            </div>

            <button
              onClick={() => setShowSasModal(false)}
              className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition-colors"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
