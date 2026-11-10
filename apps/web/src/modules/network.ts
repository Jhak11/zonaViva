// ──────────────────────────────────────────────────────────────────────
//  Módulo de red del cliente (apps/web/src/modules/network.ts)
//  ÚNICO módulo que conoce e importa socket.io-client.
//  Permite cambiar el transporte en el futuro sin tocar la UI.
// ──────────────────────────────────────────────────────────────────────
import { io, Socket } from "socket.io-client";
import type {
  MsgPayload,
  MsgSealedPayload,
  SyncChunkPayload,
  SyncUnavailablePayload,
  PeerSyncRequestPayload,
  PeerSyncResponsePayload,
  MatchedPayload,
  ChatMsgPayload,
  PeerLeftPayload,
  QueueTimeoutPayload,
  TemporaryForum,
  SendDirectRequestPayload,
  RespondDirectRequestPayload,
  DirectMsgPayload,
  DeleteDirectPeerPayload,
  CancelDirectRequestPayload,
} from "@zonaviva/protocol";

const RELAY_URL =
  import.meta.env.VITE_RELAY_URL ||
  (typeof window !== "undefined" ? window.location.origin : "http://localhost:3001");

let socket: Socket | null = null;
let relayPublicKey: string | null = null;

// Precargar clave pública del relay si estamos en navegador
if (typeof window !== "undefined") {
  fetch(`${RELAY_URL}/key`)
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      if (data?.relayPublicKey) {
        relayPublicKey = data.relayPublicKey;
      }
    })
    .catch(() => {});
}

// Callbacks registrados
type MessageListener = (msg: MsgSealedPayload) => void;
type OccupancyListener = (data: { forumId: string; count: number }) => void;
type ConnectionListener = (connected: boolean) => void;
type SyncChunkListener = (payload: SyncChunkPayload) => void;
type SyncUnavailableListener = (payload: SyncUnavailablePayload) => void;
type PeerSyncRequestListener = (payload: PeerSyncRequestPayload) => void;
type MatchedListener = (payload: MatchedPayload) => void;
type ChatMsgListener = (payload: ChatMsgPayload) => void;
type PeerLeftListener = (payload: PeerLeftPayload) => void;
type QueueTimeoutListener = (payload: QueueTimeoutPayload) => void;
type QueueCancelledListener = () => void;
export type ChatScopeActiveListener = (data: { scopeId: string; active: boolean }) => void;
export type DirectRequestListener = (payload: SendDirectRequestPayload) => void;
export type DirectRequestAcceptedListener = (payload: RespondDirectRequestPayload) => void;
export type DirectRequestRejectedListener = (payload: RespondDirectRequestPayload) => void;
export type DirectMsgReceivedListener = (payload: DirectMsgPayload) => void;
export type DirectPeerDeletedListener = (payload: { peerPublicKey: string }) => void;

let lastRegisteredIdentity: { publicKey: string; alias: string } | null = null;

const messageListeners = new Set<MessageListener>();
const occupancyListeners = new Set<OccupancyListener>();
const connectionListeners = new Set<ConnectionListener>();
const syncChunkListeners = new Set<SyncChunkListener>();
const syncUnavailableListeners = new Set<SyncUnavailableListener>();
const peerSyncRequestListeners = new Set<PeerSyncRequestListener>();
const matchedListeners = new Set<MatchedListener>();
const chatMsgListeners = new Set<ChatMsgListener>();
const peerLeftListeners = new Set<PeerLeftListener>();
const queueTimeoutListeners = new Set<QueueTimeoutListener>();
const queueCancelledListeners = new Set<QueueCancelledListener>();
const chatScopeActiveListeners = new Set<ChatScopeActiveListener>();
const directRequestListeners = new Set<DirectRequestListener>();
const directRequestAcceptedListeners = new Set<DirectRequestAcceptedListener>();
const directRequestRejectedListeners = new Set<DirectRequestRejectedListener>();
const directMsgReceivedListeners = new Set<DirectMsgReceivedListener>();
const directPeerDeletedListeners = new Set<DirectPeerDeletedListener>();

/**
 * Conecta al servidor Relay Socket.IO con reconexión automática.
 */
export function connectNetwork(): Socket {
  if (socket && socket.connected) {
    return socket;
  }

  if (!socket) {
    socket = io(RELAY_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

    socket.on("connect", () => {
      connectionListeners.forEach((fn) => fn(true));
      if (lastRegisteredIdentity) {
        socket?.emit("register_identity", lastRegisteredIdentity);
      }
    });

    socket.on("disconnect", () => {
      connectionListeners.forEach((fn) => fn(false));
    });

    socket.on("connect_error", () => {
      connectionListeners.forEach((fn) => fn(false));
    });

    socket.on("welcome", (data: { relayPublicKey?: string }) => {
      if (data?.relayPublicKey) {
        relayPublicKey = data.relayPublicKey;
      }
    });

    socket.on("msg_sealed", (msg: MsgSealedPayload) => {
      messageListeners.forEach((fn) => fn(msg));
    });

    socket.on("room_occupancy", (data: { forumId: string; count: number }) => {
      occupancyListeners.forEach((fn) => fn(data));
    });

    // Eventos de sincronización P2P
    socket.on("sync_chunk", (payload: SyncChunkPayload) => {
      syncChunkListeners.forEach((fn) => fn(payload));
    });

    socket.on("sync_unavailable", (payload: SyncUnavailablePayload) => {
      syncUnavailableListeners.forEach((fn) => fn(payload));
    });

    socket.on("peer_sync_request", (payload: PeerSyncRequestPayload) => {
      peerSyncRequestListeners.forEach((fn) => fn(payload));
    });

    // Eventos de chat efímero E2EE
    socket.on("matched", (payload: MatchedPayload) => {
      matchedListeners.forEach((fn) => fn(payload));
    });

    socket.on("chat_msg", (payload: ChatMsgPayload) => {
      chatMsgListeners.forEach((fn) => fn(payload));
    });

    socket.on("peer_left", (payload: PeerLeftPayload) => {
      peerLeftListeners.forEach((fn) => fn(payload));
    });

    socket.on("queue_timeout", (payload: QueueTimeoutPayload) => {
      queueTimeoutListeners.forEach((fn) => fn(payload));
    });

    socket.on("queue_cancelled", () => {
      queueCancelledListeners.forEach((fn) => fn());
    });

    socket.on("chat_scope_active", (payload: { scopeId: string; active: boolean }) => {
      chatScopeActiveListeners.forEach((fn) => fn(payload));
    });

    // Eventos de contacto y chat directo permanente
    socket.on("direct_request_received", (payload: SendDirectRequestPayload) => {
      directRequestListeners.forEach((fn) => fn(payload));
    });

    socket.on("direct_request_accepted", (payload: RespondDirectRequestPayload) => {
      directRequestAcceptedListeners.forEach((fn) => fn(payload));
    });

    socket.on("direct_request_rejected", (payload: RespondDirectRequestPayload) => {
      directRequestRejectedListeners.forEach((fn) => fn(payload));
    });

    socket.on("direct_msg_received", (payload: DirectMsgPayload) => {
      directMsgReceivedListeners.forEach((fn) => fn(payload));
    });

    socket.on("direct_peer_deleted", (payload: { peerPublicKey: string }) => {
      directPeerDeletedListeners.forEach((fn) => fn(payload));
    });
  } else if (!socket.connected) {
    socket.connect();
  }

  return socket;
}

export function isNetworkConnected(): boolean {
  return socket?.connected ?? false;
}

export function getRelayPublicKey(): string | null {
  return relayPublicKey;
}

/**
 * Solicita unirse a la sala de un foro.
 */
export function joinForumRoom(
  forumId: string
): Promise<{ ok: boolean; count?: number; error?: string }> {
  const s = connectNetwork();
  return new Promise((resolve) => {
    s.emit("join_forum", { forumId }, (res: { ok: boolean; count?: number; error?: string }) => {
      resolve(res || { ok: true });
    });
  });
}

/**
 * Sale de la sala de un foro.
 */
export function leaveForumRoom(forumId: string): void {
  if (socket?.connected) {
    socket.emit("leave_forum", { forumId });
  }
}

/**
 * Envía un mensaje al relay para ser sellado y difundido.
 */
export function sendForumMessage(
  payload: MsgPayload
): Promise<{ ok: boolean; relayTs?: number; relaySig?: string; error?: string }> {
  const s = connectNetwork();
  return new Promise((resolve) => {
    s.emit("msg", payload, (res: { ok: boolean; relayTs?: number; relaySig?: string; error?: string }) => {
      resolve(res || { ok: false, error: "Sin respuesta del relay" });
    });
  });
}

/**
 * Solicita sincronización de historial para un foro desde una marca de tiempo 'since'
 */
export function requestForumSync(forumId: string, since: number): void {
  const s = connectNetwork();
  s.emit("sync_request", { forumId, since });
}

/**
 * Responde a una solicitud de sincronización enviada por otro par
 */
export function sendPeerSyncResponse(payload: PeerSyncResponsePayload): void {
  if (socket?.connected) {
    socket.emit("peer_sync_response", payload);
  }
}

/**
 * Notifica al relay que este cliente posee historial local para este foro
 */
export function reportHasHistory(forumId: string, count: number): void {
  if (socket?.connected) {
    socket.emit("report_has_history", { forumId, count });
  }
}

// ── Funciones de Chat Efímero ─────────────────────────────────────────

/**
 * Entra en la cola de emparejamiento para una zona con clave pública efímera ECDH
 */
export function queueChat(
  zoneId: string,
  ephemeralPublicKey: string
): Promise<{ ok: boolean; status?: string; error?: string }> {
  const s = connectNetwork();
  return new Promise((resolve) => {
    s.emit(
      "queue_chat",
      { zoneId, ephemeralPublicKey },
      (res: { ok: boolean; status?: string; error?: string }) => {
        resolve(res || { ok: true, status: "queued" });
      }
    );
  });
}

/**
 * Cancela la búsqueda en la cola de chat
 */
export function cancelQueue(): void {
  if (socket?.connected) {
    socket.emit("cancel_queue");
  }
}

/**
 * Envía un mensaje cifrado a la sala de chat
 */
export function sendChatMessage(
  roomId: string,
  ciphertext: string,
  nonce: string
): void {
  if (socket?.connected) {
    socket.emit("chat_msg", { roomId, ciphertext, nonce });
  }
}

/**
 * Abandona la sala de chat actual
 */
export function leaveChat(roomId: string): void {
  if (socket?.connected) {
    socket.emit("leave_chat", { roomId });
  }
}

/**
 * Se suscribe a la sala del lobby de chat para recibir avisos de colas activas
 */
export function joinChatLobby(): Promise<string[]> {
  const s = connectNetwork();
  return new Promise((resolve) => {
    s.emit("join_chat_lobby", (res?: { scopes: string[] }) => {
      resolve(res?.scopes || []);
    });
  });
}

/**
 * Abandona la sala del lobby de chat al salir de la vista
 */
export function leaveChatLobby(): void {
  if (socket?.connected) {
    socket.emit("leave_chat_lobby");
  }
}

/**
 * Consulta la lista de ámbitos con personas en espera en este momento
 */
export function fetchActiveChatScopes(): Promise<string[]> {
  const s = connectNetwork();
  return new Promise((resolve) => {
    s.emit("get_active_chat_scopes", (res?: { scopes: string[] }) => {
      resolve(res?.scopes || []);
    });
  });
}

// ── Foros Temporales de Usuario (Iteración 5) ─────────────────────────

/**
 * Crea y registra un nuevo foro temporal en el relay
 */
export function createTemporaryForumNetwork(
  forum: TemporaryForum
): Promise<{ ok: boolean; forum?: TemporaryForum; error?: string }> {
  const s = connectNetwork();
  return new Promise((resolve) => {
    s.emit("create_user_forum", forum, (res: { ok: boolean; forum?: TemporaryForum; error?: string }) => {
      resolve(res || { ok: false, error: "Sin respuesta del relay" });
    });
  });
}

/**
 * Anuncia los foros conservados en este dispositivo al relay (presencia activa)
 */
export function announceUserForumsNetwork(
  forums: TemporaryForum[]
): Promise<{ ok: boolean; count?: number; error?: string }> {
  if (!forums.length) return Promise.resolve({ ok: true, count: 0 });
  const s = connectNetwork();
  return new Promise((resolve) => {
    s.emit("announce_user_forums", { forums }, (res: { ok: boolean; count?: number; error?: string }) => {
      resolve(res || { ok: true, count: forums.length });
    });
  });
}

/**
 * Obtiene del relay la lista de foros temporales activos (con participantes en línea)
 */
export function fetchActiveUserForums(): Promise<TemporaryForum[]> {
  const s = connectNetwork();
  return new Promise((resolve) => {
    s.emit("list_active_user_forums", (res: { ok: boolean; forums?: TemporaryForum[] }) => {
      if (res?.ok && Array.isArray(res.forums)) {
        resolve(res.forums);
      } else {
        resolve([]);
      }
    });
  });
}

/**
 * Se une a la sala de un foro de usuario en el relay
 */
export function joinUserForumNetwork(
  forumId: string
): Promise<{ ok: boolean; participantCount?: number; error?: string }> {
  const s = connectNetwork();
  return new Promise((resolve) => {
    s.emit("join_user_forum", { forumId }, (res: { ok: boolean; participantCount?: number; error?: string }) => {
      resolve(res || { ok: true });
    });
  });
}

/**
 * Abandona permanentemente un foro de usuario en el relay (regla N=0)
 */
export function leaveUserForumPermanentlyNetwork(
  forumId: string
): Promise<{ ok: boolean; remaining?: number }> {
  const s = connectNetwork();
  return new Promise((resolve) => {
    s.emit("leave_user_forum_permanently", { forumId }, (res: { ok: boolean; remaining?: number }) => {
      resolve(res || { ok: true, remaining: 0 });
    });
  });
}

// ── Registro de oyentes de eventos ────────────────────────────────────

export function onMessageSealed(listener: MessageListener): () => void {
  messageListeners.add(listener);
  return () => messageListeners.delete(listener);
}

export function onOccupancyChange(listener: OccupancyListener): () => void {
  occupancyListeners.add(listener);
  return () => occupancyListeners.delete(listener);
}

export function onConnectionChange(listener: ConnectionListener): () => void {
  connectionListeners.add(listener);
  return () => connectionListeners.delete(listener);
}

export function onSyncChunk(listener: SyncChunkListener): () => void {
  syncChunkListeners.add(listener);
  return () => syncChunkListeners.delete(listener);
}

export function onSyncUnavailable(listener: SyncUnavailableListener): () => void {
  syncUnavailableListeners.add(listener);
  return () => syncUnavailableListeners.delete(listener);
}

export function onPeerSyncRequest(listener: PeerSyncRequestListener): () => void {
  peerSyncRequestListeners.add(listener);
  return () => peerSyncRequestListeners.delete(listener);
}

export function onMatched(listener: MatchedListener): () => void {
  matchedListeners.add(listener);
  return () => matchedListeners.delete(listener);
}

export function onChatMsg(listener: ChatMsgListener): () => void {
  chatMsgListeners.add(listener);
  return () => chatMsgListeners.delete(listener);
}

export function onPeerLeft(listener: PeerLeftListener): () => void {
  peerLeftListeners.add(listener);
  return () => peerLeftListeners.delete(listener);
}

export function onQueueTimeout(listener: QueueTimeoutListener): () => void {
  queueTimeoutListeners.add(listener);
  return () => queueTimeoutListeners.delete(listener);
}

export function onQueueCancelled(listener: QueueCancelledListener): () => void {
  queueCancelledListeners.add(listener);
  return () => queueCancelledListeners.delete(listener);
}

export function onChatScopeActive(listener: ChatScopeActiveListener): () => void {
  chatScopeActiveListeners.add(listener);
  return () => chatScopeActiveListeners.delete(listener);
}

// ── Métodos de red para Pares Permanentes y Chat Directo ─────────────

/**
 * Registra la clave de identidad y alias en el relay para poder recibir solicitudes directas
 */
export function registerIdentityNetwork(
  publicKey: string,
  alias: string
): Promise<{ ok: boolean; error?: string }> {
  lastRegisteredIdentity = { publicKey, alias };
  const s = connectNetwork();
  return new Promise((resolve) => {
    s.emit("register_identity", { publicKey, alias }, (res: { ok: boolean; error?: string }) => {
      resolve(res || { ok: true });
    });
  });
}

/**
 * Envía una solicitud de contacto permanente a otro usuario
 */
export function sendDirectRequestNetwork(
  req: SendDirectRequestPayload
): Promise<{ ok: boolean; status?: string; error?: string }> {
  const s = connectNetwork();
  return new Promise((resolve) => {
    s.emit("send_direct_request", req, (res: { ok: boolean; status?: string; error?: string }) => {
      resolve(res || { ok: false, error: "Sin respuesta del relay" });
    });
  });
}

/**
 * Responde a una solicitud de contacto permanente (aceptar o rechazar)
 */
export function respondDirectRequestNetwork(
  res: RespondDirectRequestPayload
): Promise<{ ok: boolean; error?: string }> {
  const s = connectNetwork();
  return new Promise((resolve) => {
    s.emit("respond_direct_request", res, (response: { ok: boolean; error?: string }) => {
      resolve(response || { ok: true });
    });
  });
}

/**
 * Envía un mensaje directo cifrado con E2EE al par
 */
export function sendDirectMsgNetwork(
  msg: DirectMsgPayload
): Promise<{ ok: boolean; delivered?: boolean; error?: string }> {
  const s = connectNetwork();
  return new Promise((resolve) => {
    s.emit("send_direct_msg", msg, (res: { ok: boolean; delivered?: boolean; error?: string }) => {
      resolve(res || { ok: true, delivered: false });
    });
  });
}

export function onDirectRequestReceived(listener: DirectRequestListener): () => void {
  directRequestListeners.add(listener);
  return () => directRequestListeners.delete(listener);
}

export function onDirectRequestAccepted(listener: DirectRequestAcceptedListener): () => void {
  directRequestAcceptedListeners.add(listener);
  return () => directRequestAcceptedListeners.delete(listener);
}

export function onDirectRequestRejected(listener: DirectRequestRejectedListener): () => void {
  directRequestRejectedListeners.add(listener);
  return () => directRequestRejectedListeners.delete(listener);
}

export function onDirectMsgReceived(listener: DirectMsgReceivedListener): () => void {
  directMsgReceivedListeners.add(listener);
  return () => directMsgReceivedListeners.delete(listener);
}

/**
 * Notifica al par que la relación de contacto directo ha sido eliminada
 */
export function deleteDirectPeerNetwork(
  payload: DeleteDirectPeerPayload
): Promise<{ ok: boolean; error?: string }> {
  const s = connectNetwork();
  return new Promise((resolve) => {
    s.emit("delete_direct_peer", payload, (res: { ok: boolean; error?: string }) => {
      resolve(res || { ok: true });
    });
  });
}

export function onDirectPeerDeleted(listener: DirectPeerDeletedListener): () => void {
  directPeerDeletedListeners.add(listener);
  return () => directPeerDeletedListeners.delete(listener);
}

/**
 * Cancela una solicitud saliente en memoria del relay
 */
export function cancelDirectRequestNetwork(
  payload: CancelDirectRequestPayload
): Promise<{ ok: boolean; error?: string }> {
  const s = connectNetwork();
  return new Promise((resolve) => {
    s.emit("cancel_direct_request", payload, (res: { ok: boolean; error?: string }) => {
      resolve(res || { ok: true });
    });
  });
}


