// ──────────────────────────────────────────────────────────────────────
//  Módulo de red del cliente (apps/web/src/modules/network.ts)
//  ÚNICO módulo que conoce e importa socket.io-client.
//  Permite cambiar el transporte en el futuro sin modificar la UI.
// ──────────────────────────────────────────────────────────────────────
import { io, Socket } from "socket.io-client";
import type {
  MsgPayload,
  MsgSealedPayload,
} from "@zonaviva/protocol";

const RELAY_URL = import.meta.env.VITE_RELAY_URL || "http://localhost:3001";

let socket: Socket | null = null;
let relayPublicKey: string | null = null;

// Callbacks registrados
type MessageListener = (msg: MsgSealedPayload) => void;
type OccupancyListener = (data: { forumId: string; count: number }) => void;
type ConnectionListener = (connected: boolean) => void;

const messageListeners = new Set<MessageListener>();
const occupancyListeners = new Set<OccupancyListener>();
const connectionListeners = new Set<ConnectionListener>();

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
 * Registra un oyente para nuevos mensajes sellados.
 */
export function onMessageSealed(listener: MessageListener): () => void {
  messageListeners.add(listener);
  return () => messageListeners.delete(listener);
}

/**
 * Registra un oyente para cambios en la ocupación de salas.
 */
export function onOccupancyChange(listener: OccupancyListener): () => void {
  occupancyListeners.add(listener);
  return () => occupancyListeners.delete(listener);
}

/**
 * Registra un oyente para estado de conexión.
 */
export function onConnectionChange(listener: ConnectionListener): () => void {
  connectionListeners.add(listener);
  return () => connectionListeners.delete(listener);
}
