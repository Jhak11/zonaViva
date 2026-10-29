// ──────────────────────────────────────────────────────────────────────
//  ZonaViva Relay – Iteración 3
//  Servidor en memoria (sin base de datos, sin logs de IP ni contenido).
//  Salas de foro geográfico, sellado canónico (relayTs + relaySig)
//  y retransmisión de sincronización P2P entre clientes.
// ──────────────────────────────────────────────────────────────────────
import { createServer } from "http";
import { Server, Socket } from "socket.io";
import crypto from "node:crypto";
import {
  PROTOCOL_VERSION,
  APP_NAME,
  MAX_CONNECTIONS_PER_IP,
  FORUM_PREFIX_ZONE,
  ZONES_BY_ID,
  MsgPayloadSchema,
  JoinForumSchema,
  SyncRequestSchema,
  PeerSyncResponseSchema,
  QueueChatSchema,
  ChatMsgSchema,
  LeaveChatSchema,
  CancelQueueSchema,
  type MsgPayload,
  type MsgSealedPayload,
  type PeerSyncRequestPayload,
  type PeerSyncResponsePayload,
} from "@zonaviva/protocol";

const PORT = Number(process.env.PORT ?? 3001);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? "*";

// ── Clave de sellado ECDSA P-256 del relay (en memoria) ───────────────
const relayKeyPair = crypto.generateKeyPairSync("ec", {
  namedCurve: "prime256v1",
});

const relayPublicKeyB64 = relayKeyPair.publicKey
  .export({ type: "spki", format: "der" })
  .toString("base64url");

/** Firma oficial del relay sobre (id, forumId, relayTs, sha256(content)) */
function signRelayMessage(
  id: string,
  forumId: string,
  relayTs: number,
  content: string
): string {
  const contentHash = crypto.createHash("sha256").update(content).digest("hex");
  const payloadToSign = `${id}:${forumId}:${relayTs}:${contentHash}`;
  const sign = crypto.createSign("SHA256");
  sign.update(payloadToSign);
  // WebCrypto exige formato IEEE P1363 (64 bytes raw R||S) en lugar de ASN.1 DER
  return sign.sign(
    { key: relayKeyPair.privateKey, dsaEncoding: "ieee-p1363" },
    "base64url"
  );
}

// ── Control de conexiones por IP (en memoria) ─────────────────────────
const connectionsByIp = new Map<string, number>();

// Marca de tiempo monotónica para evitar desórdenes
let lastRelayTs = 0;
function getNextRelayTs(): number {
  const now = Date.now();
  lastRelayTs = Math.max(now, lastRelayTs + 1);
  return lastRelayTs;
}

// ── Rastreo de sincronizaciones pendientes en vuelo ────────────────────
interface PendingSync {
  requesterId: string;
  forumId: string;
  timeoutId: NodeJS.Timeout;
}
const pendingSyncs = new Map<string, PendingSync>();

// Registro de sockets que han reportado tener copia local de un foro
const forumHolders = new Map<string, Set<string>>(); // forumId -> Set<socketId>

// ── Colas de Chat Aleatorio Efímero (E2EE) en memoria ─────────────────
interface QueuedChatUser {
  socketId: string;
  zoneId: string;
  ephemeralPublicKey: string;
  timeoutId: NodeJS.Timeout;
}
// zoneId -> QueuedChatUser[]
const chatQueues = new Map<string, QueuedChatUser[]>();
// socketId -> roomId (chat activo)
const activeChatRooms = new Map<string, string>();

// ── Servidor HTTP ─────────────────────────────────────────────────────
const httpServer = createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === "/key") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ relayPublicKey: relayPublicKeyB64 }));
    return;
  }

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      app: APP_NAME,
      relay: "ok",
      version: PROTOCOL_VERSION,
      timestamp: Date.now(),
      relayPublicKey: relayPublicKeyB64,
    })
  );
});

// ── Servidor Socket.IO ────────────────────────────────────────────────
const io = new Server(httpServer, {
  cors: {
    origin: CLIENT_ORIGIN,
    methods: ["GET", "POST"],
  },
  maxHttpBufferSize: 16_384, // 16 KB para chunks de sync
});

io.on("connection", (socket: Socket) => {
  const ip =
    (socket.handshake.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ??
    socket.handshake.address;

  // Límite de conexiones simultáneas por IP
  const count = (connectionsByIp.get(ip) ?? 0) + 1;
  if (count > MAX_CONNECTIONS_PER_IP) {
    socket.emit("error_limit", { message: "Tope de conexiones por red alcanzado." });
    socket.disconnect(true);
    return;
  }
  connectionsByIp.set(ip, count);

  const joinedRooms = new Set<string>();

  // Mensaje de bienvenida con clave pública del relay
  socket.emit("welcome", {
    app: APP_NAME,
    version: PROTOCOL_VERSION,
    ts: Date.now(),
    relayPublicKey: relayPublicKeyB64,
  });

  // ── Unirse a un foro ────────────────────────────────────────────────
  socket.on("join_forum", (rawPayload: unknown, ack?: (res: { ok: boolean; count?: number; error?: string }) => void) => {
    const parsed = JoinForumSchema.safeParse(rawPayload);
    if (!parsed.success) {
      if (typeof ack === "function") ack({ ok: false, error: "Identificador de foro inválido." });
      return;
    }

    const { forumId } = parsed.data;

    // Validación de foros de zona permanente contra catálogo
    if (forumId.startsWith(FORUM_PREFIX_ZONE)) {
      const zoneId = forumId.slice(FORUM_PREFIX_ZONE.length);
      if (!ZONES_BY_ID[zoneId]) {
        socket.emit("error_forum", { message: `La zona '${zoneId}' no existe en el catálogo.` });
        if (typeof ack === "function") ack({ ok: false, error: "Zona no encontrada." });
        return;
      }
    }

    socket.join(forumId);
    joinedRooms.add(forumId);

    const occupancy = io.sockets.adapter.rooms.get(forumId)?.size ?? 1;
    io.to(forumId).emit("room_occupancy", { forumId, count: occupancy });

    if (typeof ack === "function") {
      ack({ ok: true, count: occupancy });
    }
  });

  // ── Salir de un foro ────────────────────────────────────────────────
  socket.on("leave_forum", (rawPayload: unknown) => {
    const parsed = JoinForumSchema.safeParse(rawPayload);
    if (!parsed.success) return;

    const { forumId } = parsed.data;
    socket.leave(forumId);
    joinedRooms.delete(forumId);

    // Remover de holders
    forumHolders.get(forumId)?.delete(socket.id);

    const occupancy = io.sockets.adapter.rooms.get(forumId)?.size ?? 0;
    io.to(forumId).emit("room_occupancy", { forumId, count: occupancy });
  });

  // ── Reportar posesión de historial local de un foro ─────────────────
  socket.on("report_has_history", ({ forumId, count }: { forumId: string; count: number }) => {
    if (typeof forumId === "string" && count > 0) {
      if (!forumHolders.has(forumId)) {
        forumHolders.set(forumId, new Set());
      }
      forumHolders.get(forumId)!.add(socket.id);
    }
  });

  // ── Publicar mensaje ────────────────────────────────────────────────
  socket.on("msg", (rawPayload: unknown, ack?: (res: { ok: boolean; relayTs?: number; relaySig?: string; error?: string }) => void) => {
    const parsed = MsgPayloadSchema.safeParse(rawPayload);
    if (!parsed.success) {
      socket.emit("error_msg", { message: "Formato de mensaje o tamaño inválido." });
      if (typeof ack === "function") ack({ ok: false, error: "Esquema inválido." });
      return;
    }

    const data: MsgPayload = parsed.data;

    if (!socket.rooms.has(data.forumId)) {
      socket.emit("error_msg", { message: "No estás unido a este foro." });
      if (typeof ack === "function") ack({ ok: false, error: "No unido al foro." });
      return;
    }

    if (data.forumId.startsWith(FORUM_PREFIX_ZONE)) {
      const zoneId = data.forumId.slice(FORUM_PREFIX_ZONE.length);
      if (!ZONES_BY_ID[zoneId]) {
        socket.emit("error_msg", { message: "La zona especificada no existe." });
        if (typeof ack === "function") ack({ ok: false, error: "Zona inválida." });
        return;
      }
    }

    // Asignar marca canónica monotónica y firma del relay
    const relayTs = getNextRelayTs();
    const relaySig = signRelayMessage(data.id, data.forumId, relayTs, data.content);

    const sealed: MsgSealedPayload = {
      ...data,
      relayTs,
      relaySig,
    };

    // Difusión inmediata a todos los miembros de la sala
    io.to(data.forumId).emit("msg_sealed", sealed);

    // El autor pasa a ser poseedor de historial
    if (!forumHolders.has(data.forumId)) {
      forumHolders.set(data.forumId, new Set());
    }
    forumHolders.get(data.forumId)!.add(socket.id);

    if (typeof ack === "function") {
      ack({ ok: true, relayTs, relaySig });
    }
  });

  // ── Petición de Sincronización de Historial ──────────────────────────
  socket.on("sync_request", (rawPayload: unknown) => {
    const parsed = SyncRequestSchema.safeParse(rawPayload);
    if (!parsed.success) {
      socket.emit("sync_unavailable", { forumId: (rawPayload as { forumId?: string })?.forumId ?? "" });
      return;
    }

    const { forumId, since } = parsed.data;

    // Obtener miembros conectados a la sala excluyendo al solicitante
    const room = io.sockets.adapter.rooms.get(forumId);
    const candidateHolders = Array.from(forumHolders.get(forumId) ?? []).filter(
      (id) => id !== socket.id && room?.has(id)
    );

    // Si nadie reportó historial pero hay otros sockets en la sala, probar con cualquiera
    let peerId: string | null = null;
    if (candidateHolders.length > 0) {
      peerId = candidateHolders[Math.floor(Math.random() * candidateHolders.length)];
    } else if (room) {
      const otherMembers = Array.from(room).filter((id) => id !== socket.id);
      if (otherMembers.length > 0) {
        peerId = otherMembers[Math.floor(Math.random() * otherMembers.length)];
      }
    }

    // Si no hay ningún par disponible en la sala
    if (!peerId) {
      socket.emit("sync_unavailable", { forumId });
      return;
    }

    const requestId = crypto.randomUUID();

    // Timeout de 4 segundos: si el par no responde, avisar que no está disponible
    const timeoutId = setTimeout(() => {
      const pending = pendingSyncs.get(requestId);
      if (pending) {
        pendingSyncs.delete(requestId);
        io.to(pending.requesterId).emit("sync_unavailable", { forumId });
      }
    }, 4000);

    pendingSyncs.set(requestId, {
      requesterId: socket.id,
      forumId,
      timeoutId,
    });

    const requestPayload: PeerSyncRequestPayload = {
      requestId,
      forumId,
      since,
    };

    io.to(peerId).emit("peer_sync_request", requestPayload);
  });

  // ── Respuesta de Sincronización proveniente de un par ───────────────
  socket.on("peer_sync_response", (rawPayload: unknown) => {
    const parsed = PeerSyncResponseSchema.safeParse(rawPayload);
    if (!parsed.success) return;

    const data: PeerSyncResponsePayload = parsed.data;
    const pending = pendingSyncs.get(data.requestId);
    if (!pending) return;

    clearTimeout(pending.timeoutId);
    pendingSyncs.delete(data.requestId);

    if (data.messages && data.messages.length > 0) {
      io.to(pending.requesterId).emit("sync_chunk", {
        forumId: data.forumId,
        messages: data.messages,
        hasMore: data.hasMore,
      });
    } else {
      io.to(pending.requesterId).emit("sync_unavailable", { forumId: data.forumId });
    }
  });

  // ── Chat Aleatorio Efímero (E2EE) ──────────────────────────────────

  // 1. Entrar en cola de emparejamiento por zona
  socket.on("queue_chat", (rawPayload: unknown, ack?: (res: { ok: boolean; status?: string; error?: string }) => void) => {
    const parsed = QueueChatSchema.safeParse(rawPayload);
    if (!parsed.success) {
      if (typeof ack === "function") ack({ ok: false, error: "Datos de emparejamiento inválidos." });
      return;
    }

    const { zoneId, ephemeralPublicKey } = parsed.data;

    // Si ya estaba en un chat activo, avisar y salir
    const currentRoom = activeChatRooms.get(socket.id);
    if (currentRoom) {
      socket.to(currentRoom).emit("peer_left", { roomId: currentRoom });
      socket.leave(currentRoom);
      activeChatRooms.delete(socket.id);
    }

    // Si ya estaba en la cola de alguna zona, limpiarlo
    for (const [, queue] of chatQueues.entries()) {
      const idx = queue.findIndex((item) => item.socketId === socket.id);
      if (idx !== -1) {
        clearTimeout(queue[idx].timeoutId);
        queue.splice(idx, 1);
      }
    }

    if (!chatQueues.has(zoneId)) {
      chatQueues.set(zoneId, []);
    }
    const queue = chatQueues.get(zoneId)!;

    // Buscar si hay otro participante en espera (FIFO)
    let peerUser: QueuedChatUser | null = null;
    while (queue.length > 0) {
      const candidate = queue.shift()!;
      clearTimeout(candidate.timeoutId);
      const peerSocket = io.sockets.sockets.get(candidate.socketId);
      if (peerSocket && peerSocket.connected && peerSocket.id !== socket.id) {
        peerUser = candidate;
        break;
      }
    }

    if (peerUser) {
      const peerSocket = io.sockets.sockets.get(peerUser.socketId)!;
      const roomId = `chat:${crypto.randomUUID()}`;

      peerSocket.join(roomId);
      socket.join(roomId);

      activeChatRooms.set(peerSocket.id, roomId);
      activeChatRooms.set(socket.id, roomId);

      // Notificar a ambos con la clave pública efímera del otro
      peerSocket.emit("matched", {
        roomId,
        peerPublicKey: ephemeralPublicKey,
      });

      socket.emit("matched", {
        roomId,
        peerPublicKey: peerUser.ephemeralPublicKey,
      });

      if (typeof ack === "function") ack({ ok: true, status: "matched" });
    } else {
      // Poner en cola con timeout de 30 segundos
      const timeoutId = setTimeout(() => {
        const q = chatQueues.get(zoneId);
        if (q) {
          const idx = q.findIndex((item) => item.socketId === socket.id);
          if (idx !== -1) {
            q.splice(idx, 1);
            socket.emit("queue_timeout", { zoneId });
          }
        }
      }, 30_000);

      queue.push({
        socketId: socket.id,
        zoneId,
        ephemeralPublicKey,
        timeoutId,
      });

      if (typeof ack === "function") ack({ ok: true, status: "queued" });
    }
  });

  // 2. Cancelar búsqueda en cola
  socket.on("cancel_queue", (rawPayload?: unknown) => {
    CancelQueueSchema.safeParse(rawPayload); // opcional
    for (const [, queue] of chatQueues.entries()) {
      const idx = queue.findIndex((item) => item.socketId === socket.id);
      if (idx !== -1) {
        clearTimeout(queue[idx].timeoutId);
        queue.splice(idx, 1);
      }
    }
    socket.emit("queue_cancelled");
  });

  // 3. Enviar mensaje cifrado de chat (relay zero-storage)
  socket.on("chat_msg", (rawPayload: unknown) => {
    const parsed = ChatMsgSchema.safeParse(rawPayload);
    if (!parsed.success) return;

    const { roomId, ciphertext, nonce } = parsed.data;

    // Solo retransmitir si pertenece a la sala
    if (!socket.rooms.has(roomId)) return;

    socket.to(roomId).emit("chat_msg", { roomId, ciphertext, nonce });
  });

  // 4. Salir de un chat activo
  socket.on("leave_chat", (rawPayload: unknown) => {
    const parsed = LeaveChatSchema.safeParse(rawPayload);
    if (!parsed.success) return;

    const { roomId } = parsed.data;
    socket.to(roomId).emit("peer_left", { roomId });
    socket.leave(roomId);
    activeChatRooms.delete(socket.id);
  });

  // ── Ping para verificar latencia ────────────────────────────────────
  socket.on("ping_relay", (cb) => {
    if (typeof cb === "function") cb({ ts: Date.now() });
  });

  // ── Desconexión limpia ──────────────────────────────────────────────
  socket.on("disconnect", () => {
    const remaining = (connectionsByIp.get(ip) ?? 1) - 1;
    if (remaining <= 0) {
      connectionsByIp.delete(ip);
    } else {
      connectionsByIp.set(ip, remaining);
    }

    // Limpiar de colas de chat
    for (const [, queue] of chatQueues.entries()) {
      const idx = queue.findIndex((item) => item.socketId === socket.id);
      if (idx !== -1) {
        clearTimeout(queue[idx].timeoutId);
        queue.splice(idx, 1);
      }
    }

    // Si estaba en un chat activo, notificar al interlocutor
    const activeRoom = activeChatRooms.get(socket.id);
    if (activeRoom) {
      socket.to(activeRoom).emit("peer_left", { roomId: activeRoom });
      activeChatRooms.delete(socket.id);
    }

    // Limpiar salas y holders
    for (const forumId of joinedRooms) {
      forumHolders.get(forumId)?.delete(socket.id);
      const occupancy = io.sockets.adapter.rooms.get(forumId)?.size ?? 0;
      io.to(forumId).emit("room_occupancy", { forumId, count: occupancy });
    }
    joinedRooms.clear();

    // Cancelar cualquier sync pendiente donde este socket era el solicitante
    for (const [reqId, pending] of pendingSyncs.entries()) {
      if (pending.requesterId === socket.id) {
        clearTimeout(pending.timeoutId);
        pendingSyncs.delete(reqId);
      }
    }
  });
});

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`[${APP_NAME} relay] escuchando en 0.0.0.0 puerto ${PORT}`);
  console.log(`[${APP_NAME} relay] clave pública y protocolo de sync P2P activos`);
});
