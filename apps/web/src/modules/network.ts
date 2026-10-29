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
} from "@zonaviva/protocol";

const RELAY_URL =
  import.meta.env.VITE_RELAY_URL ||
  (typeof window !== "undefined" ? window.location.origin : "http://localhost:3001");

let socket: Socket | null = null;
let relayPublicKey: string | null = null;

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
