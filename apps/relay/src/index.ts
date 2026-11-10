// ──────────────────────────────────────────────────────────────────────
//  ZonaViva Relay – Iteración 3
//  Servidor en memoria (sin base de datos, sin logs de IP ni contenido).
//  Salas de foro geográfico, sellado canónico (relayTs + relaySig)
//  y retransmisión de sincronización P2P entre clientes.
// ──────────────────────────────────────────────────────────────────────
import { createServer } from "http";
import { Server, Socket } from "socket.io";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  PROTOCOL_VERSION,
  APP_NAME,
  MAX_CONNECTIONS_PER_IP,
  FORUM_PREFIX_ZONE,
  FORUM_PREFIX_USER,
  ZONES_BY_ID,
  MsgPayloadSchema,
  JoinForumSchema,
  SyncRequestSchema,
  PeerSyncResponseSchema,
  SYNC_PEER_COUNT,
  SYNC_TIMEOUT_MS,
  QueueChatSchema,
  ChatMsgSchema,
  LeaveChatSchema,
  CancelQueueSchema,
  CreateTemporaryForumSchema,
  TemporaryForumSchema,
  AnnounceUserForumsSchema,
  LeaveUserForumPermanentlySchema,
  RegisterIdentitySchema,
  SendDirectRequestSchema,
  RespondDirectRequestSchema,
  DirectMsgSchema,
  DeleteDirectPeerSchema,
  CancelDirectRequestSchema,
  DIRECT_REQUEST_EXPIRATION_MS,
  type MsgPayload,
  type MsgSealedPayload,
  type PeerSyncRequestPayload,
  type PeerSyncResponsePayload,
  type TemporaryForum,
} from "@zonaviva/protocol";

const PORT = Number(process.env.PORT ?? 3001);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? "*";

// ── Clave de sellado ECDSA P-256 del relay (persistente o en memoria) ──
function loadOrCreateRelayKeyPair(): {
  privateKey: crypto.KeyObject;
  publicKey: crypto.KeyObject;
} {
  // 1. Variable de entorno (ideal para despliegues en la nube como Render, Railway o Fly.io)
  if (process.env.RELAY_PRIVATE_KEY_PEM) {
    try {
      let rawPem = process.env.RELAY_PRIVATE_KEY_PEM.trim();
      if (
        (rawPem.startsWith('"') && rawPem.endsWith('"')) ||
        (rawPem.startsWith("'") && rawPem.endsWith("'"))
      ) {
        rawPem = rawPem.slice(1, -1);
      }
      const pem = rawPem.replace(/\\n/g, "\n").trim();
      const privateKey = crypto.createPrivateKey(pem);
      const publicKey = crypto.createPublicKey(privateKey);
      console.log("[Seguridad] Clave de sellado ECDSA cargada exitosamente desde RELAY_PRIVATE_KEY_PEM");
      return { privateKey, publicKey };
    } catch (err) {
      console.error("[Seguridad] Error al instanciar RELAY_PRIVATE_KEY_PEM:", err);
    }
  }

  // 2. Archivo local persistente (.relay-key.pem)
  const keyPath = process.env.RELAY_KEY_PATH || path.resolve(process.cwd(), ".relay-key.pem");
  if (fs.existsSync(keyPath)) {
    try {
      const pem = fs.readFileSync(keyPath, "utf-8");
      const privateKey = crypto.createPrivateKey(pem);
      const publicKey = crypto.createPublicKey(privateKey);
      console.log(`[Seguridad] Clave de sellado ECDSA cargada exitosamente desde archivo: ${keyPath}`);
      return { privateKey, publicKey };
    } catch (err) {
      console.error(`[Seguridad] Error leyendo ${keyPath}:`, err);
    }
  }

  // 3. Generación automática y guardado para persistencia entre reinicios
  const keyPair = crypto.generateKeyPairSync("ec", {
    namedCurve: "prime256v1",
  });

  try {
    const pem = keyPair.privateKey.export({ type: "pkcs8", format: "pem" }) as string;
    fs.writeFileSync(keyPath, pem, "utf-8");
    console.log(`[Seguridad] Nueva clave de sellado ECDSA generada y guardada en: ${keyPath}`);
  } catch (err) {
    console.warn("[Seguridad] No se pudo guardar la clave en disco, operando puramente en memoria:", err);
  }

  return keyPair;
}

const relayKeyPair = loadOrCreateRelayKeyPair();

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
  groupId: string;
}
const pendingSyncs = new Map<string, PendingSync>();
const syncGroups = new Map<string, { remaining: number; delivered: boolean }>();

function pickRandomIds(ids: string[], n: number): string[] {
  const copy = [...ids];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

// Registro de sockets que han reportado tener copia local de un foro
const forumHolders = new Map<string, Set<string>>(); // forumId -> Set<socketId>

// ── Directorio Efímero de Foros Temporales (Iteración 5) ──────────────
// Guarda metadatos de foros creados por usuarios mientras haya participantes activos
const activeUserForums = new Map<string, TemporaryForum>();
// forumId -> Set<socketId> de participantes conectados
const forumParticipants = new Map<string, Set<string>>();
// socketId -> Set<forumId> en los que este socket participa
const socketUserForums = new Map<string, Set<string>>();

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

// ── Pares Permanentes y Mensajería Directa E2EE (en memoria, cero disco) ──
// publicKey -> Set<socketId>
const identitySockets = new Map<string, Set<string>>();
// socketId -> publicKey
const socketToIdentity = new Map<string, string>();
// toPublicKey -> any[] (colas volátiles temporales en memoria para destinatarios temporalmente offline)
const pendingDirectRequests = new Map<string, any[]>();
const pendingDirectResponses = new Map<string, any[]>();
const pendingDirectMessages = new Map<string, any[]>();
const pendingPeerDeletions = new Map<string, string[]>();

function emitToIdentity(publicKey: string, event: string, payload: unknown): boolean {
  const sockets = identitySockets.get(publicKey);
  if (!sockets || sockets.size === 0) return false;
  let delivered = false;
  for (const sId of sockets) {
    if (io.sockets.sockets.has(sId)) {
      io.to(sId).emit(event, payload);
      delivered = true;
    }
  }
  return delivered;
}



function notifyScopeQueueChange(scopeId: string, hasWaiting: boolean) {
  io.to("lobby:chat").emit("chat_scope_active", { scopeId, active: hasWaiting });
}

function getActiveChatScopes(): string[] {
  const active: string[] = [];
  for (const [scopeId, queue] of chatQueues.entries()) {
    if (queue.length > 0) {
      active.push(scopeId);
    }
  }
  return active;
}

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
  maxHttpBufferSize: 262_144, // chunks de sync (hasta 50 mensajes)
});

/** El relay no conserva estado de un foro vacío: salas y holders viven solo en memoria. */
function forgetForumIfEmpty(forumId: string): void {
  const occupancy = io.sockets.adapter.rooms.get(forumId)?.size ?? 0;
  if (occupancy > 0) return;
  forumHolders.delete(forumId);
  for (const [reqId, pending] of pendingSyncs.entries()) {
    if (pending.forumId === forumId) {
      clearTimeout(pending.timeoutId);
      pendingSyncs.delete(reqId);
      const group = syncGroups.get(pending.groupId);
      if (group) {
        group.remaining -= 1;
        if (group.remaining <= 0) syncGroups.delete(pending.groupId);
      }
    }
  }
}

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
    forgetForumIfEmpty(forumId);
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

    const room = io.sockets.adapter.rooms.get(forumId);
    const candidateHolders = Array.from(forumHolders.get(forumId) ?? []).filter(
      (id) => id !== socket.id && room?.has(id)
    );

    let peers = pickRandomIds(candidateHolders, SYNC_PEER_COUNT);
    if (peers.length === 0 && room) {
      const otherMembers = Array.from(room).filter((id) => id !== socket.id);
      peers = pickRandomIds(otherMembers, 1);
    }

    if (peers.length === 0) {
      socket.emit("sync_unavailable", { forumId });
      return;
    }

    const groupId = crypto.randomUUID();
    syncGroups.set(groupId, { remaining: peers.length, delivered: false });

    for (const peerId of peers) {
      const requestId = crypto.randomUUID();
      const timeoutId = setTimeout(() => {
        if (!pendingSyncs.has(requestId)) return;
        pendingSyncs.delete(requestId);
        const group = syncGroups.get(groupId);
        if (!group) return;
        group.remaining -= 1;
        if (group.remaining <= 0) {
          syncGroups.delete(groupId);
          if (!group.delivered) {
            io.to(socket.id).emit("sync_unavailable", { forumId });
          }
        }
      }, SYNC_TIMEOUT_MS);

      pendingSyncs.set(requestId, {
        requesterId: socket.id,
        forumId,
        timeoutId,
        groupId,
      });

      const requestPayload: PeerSyncRequestPayload = {
        requestId,
        forumId,
        since,
      };
      io.to(peerId).emit("peer_sync_request", requestPayload);
    }
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

    const group = syncGroups.get(pending.groupId);
    const hasMessages = Boolean(data.messages && data.messages.length > 0);

    if (hasMessages) {
      if (group) group.delivered = true;
      io.to(pending.requesterId).emit("sync_chunk", {
        forumId: data.forumId,
        messages: data.messages,
        hasMore: data.hasMore,
      });
    }

    if (group) {
      group.remaining -= 1;
      if (group.remaining <= 0) {
        syncGroups.delete(pending.groupId);
        if (!group.delivered) {
          io.to(pending.requesterId).emit("sync_chunk", {
            forumId: data.forumId,
            messages: [],
            hasMore: false,
          });
        }
      }
    } else if (!hasMessages) {
      io.to(pending.requesterId).emit("sync_chunk", {
        forumId: data.forumId,
        messages: [],
        hasMore: false,
      });
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

      // Si la cola quedó vacía al emparejar, notificar al lobby
      if (queue.length === 0) {
        notifyScopeQueueChange(zoneId, false);
      }

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
      const wasEmpty = queue.length === 0;

      // Poner en cola con timeout de 30 segundos
      const timeoutId = setTimeout(() => {
        const q = chatQueues.get(zoneId);
        if (q) {
          const idx = q.findIndex((item) => item.socketId === socket.id);
          if (idx !== -1) {
            q.splice(idx, 1);
            socket.emit("queue_timeout", { zoneId });
            if (q.length === 0) {
              notifyScopeQueueChange(zoneId, false);
            }
          }
        }
      }, 30_000);

      queue.push({
        socketId: socket.id,
        zoneId,
        ephemeralPublicKey,
        timeoutId,
      });

      if (wasEmpty) {
        notifyScopeQueueChange(zoneId, true);
      }

      if (typeof ack === "function") ack({ ok: true, status: "queued" });
    }
  });

  // 1.1 Suscripción al lobby de chat para ver ámbitos activos
  socket.on("join_chat_lobby", (ack?: (res: { scopes: string[] }) => void) => {
    socket.join("lobby:chat");
    if (typeof ack === "function") {
      ack({ scopes: getActiveChatScopes() });
    }
  });

  socket.on("leave_chat_lobby", () => {
    socket.leave("lobby:chat");
  });

  socket.on("get_active_chat_scopes", (ack?: (res: { scopes: string[] }) => void) => {
    if (typeof ack === "function") {
      ack({ scopes: getActiveChatScopes() });
    }
  });

  // 2. Cancelar búsqueda en cola
  socket.on("cancel_queue", (rawPayload?: unknown) => {
    CancelQueueSchema.safeParse(rawPayload); // opcional
    for (const [zId, queue] of chatQueues.entries()) {
      const idx = queue.findIndex((item) => item.socketId === socket.id);
      if (idx !== -1) {
        clearTimeout(queue[idx].timeoutId);
        queue.splice(idx, 1);
        if (queue.length === 0) {
          notifyScopeQueueChange(zId, false);
        }
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

  // ── Foros Temporales Creados por Usuarios (Iteración 5) ─────────────

  // 1. Crear nuevo foro temporal
  socket.on("create_user_forum", (rawPayload: unknown, ack?: (res: any) => void) => {
    const parsed = CreateTemporaryForumSchema.safeParse(rawPayload);
    if (!parsed.success) {
      if (typeof ack === "function") ack({ ok: false, error: "Esquema inválido de foro" });
      return;
    }

    const forumData: TemporaryForum = {
      ...parsed.data,
      type: "user",
      participantCount: 1,
    };

    activeUserForums.set(forumData.id, forumData);

    if (!forumParticipants.has(forumData.id)) {
      forumParticipants.set(forumData.id, new Set());
    }
    forumParticipants.get(forumData.id)!.add(socket.id);

    if (!socketUserForums.has(socket.id)) {
      socketUserForums.set(socket.id, new Set());
    }
    socketUserForums.get(socket.id)!.add(forumData.id);

    socket.join(forumData.id);
    joinedRooms.add(forumData.id);

    io.to(forumData.id).emit("room_occupancy", { forumId: forumData.id, count: 1 });

    if (typeof ack === "function") {
      ack({ ok: true, forum: forumData });
    }
  });

  // 2. Anunciar foros locales conservados al conectar (presencia activa)
  socket.on("announce_user_forums", (rawPayload: unknown, ack?: (res: any) => void) => {
    const parsed = AnnounceUserForumsSchema.safeParse(rawPayload);
    if (!parsed.success) {
      if (typeof ack === "function") ack({ ok: false, error: "Esquema inválido" });
      return;
    }

    let registeredCount = 0;
    for (const f of parsed.data.forums) {
      if (!activeUserForums.has(f.id)) {
        activeUserForums.set(f.id, f);
      }
      if (!forumParticipants.has(f.id)) {
        forumParticipants.set(f.id, new Set());
      }
      forumParticipants.get(f.id)!.add(socket.id);

      if (!socketUserForums.has(socket.id)) {
        socketUserForums.set(socket.id, new Set());
      }
      socketUserForums.get(socket.id)!.add(f.id);

      socket.join(f.id);
      joinedRooms.add(f.id);
      registeredCount++;
    }

    if (typeof ack === "function") {
      ack({ ok: true, count: registeredCount });
    }
  });

  // 3. Listar foros temporales activos (con al menos 1 participante conectado)
  socket.on("list_active_user_forums", (ack?: (res: any) => void) => {
    const list: TemporaryForum[] = [];
    for (const [id, f] of activeUserForums.entries()) {
      const count = forumParticipants.get(id)?.size ?? 0;
      if (count > 0) {
        list.push({ ...f, participantCount: count });
      }
    }

    if (typeof ack === "function") {
      ack({ ok: true, forums: list });
    }
  });

  // 4. Unirse a un foro temporal existente
  socket.on("join_user_forum", (rawPayload: unknown, ack?: (res: any) => void) => {
    const parsed = JoinForumSchema.safeParse(rawPayload);
    if (!parsed.success) {
      if (typeof ack === "function") ack({ ok: false, error: "forumId inválido" });
      return;
    }

    const { forumId } = parsed.data;
    if (!forumId.startsWith(FORUM_PREFIX_USER)) {
      if (typeof ack === "function") ack({ ok: false, error: "No es un foro de usuario" });
      return;
    }

    if (!forumParticipants.has(forumId)) {
      forumParticipants.set(forumId, new Set());
    }
    forumParticipants.get(forumId)!.add(socket.id);

    if (!socketUserForums.has(socket.id)) {
      socketUserForums.set(socket.id, new Set());
    }
    socketUserForums.get(socket.id)!.add(forumId);

    socket.join(forumId);
    joinedRooms.add(forumId);

    const count = forumParticipants.get(forumId)?.size ?? 1;
    io.to(forumId).emit("room_occupancy", { forumId, count });

    if (typeof ack === "function") {
      ack({ ok: true, participantCount: count });
    }
  });

  // 5. Dejar de participar y eliminar copia local (Regla de Extinción N=0)
  socket.on("leave_user_forum_permanently", (rawPayload: unknown, ack?: (res: any) => void) => {
    const parsed = LeaveUserForumPermanentlySchema.safeParse(rawPayload);
    if (!parsed.success) {
      if (typeof ack === "function") ack({ ok: false, error: "forumId inválido" });
      return;
    }

    const { forumId } = parsed.data;
    forumParticipants.get(forumId)?.delete(socket.id);
    socketUserForums.get(socket.id)?.delete(forumId);
    socket.leave(forumId);
    joinedRooms.delete(forumId);

    const remaining = forumParticipants.get(forumId)?.size ?? 0;
    io.to(forumId).emit("room_occupancy", { forumId, count: remaining });

    // Si ya no queda NINGÚN participante conectado o registrado, purgar de inmediato
    if (remaining <= 0) {
      activeUserForums.delete(forumId);
      forumParticipants.delete(forumId);
      console.log(`[relay] Foro de usuario ${forumId} eliminado de la red (0 participantes).`);
    }

    if (typeof ack === "function") {
      ack({ ok: true, remaining });
    }
  });

  // ── Pares Permanentes y Solicitudes Directas (Zero-Storage) ────────

  // 1. Registrar identidad del socket conectado
  socket.on("register_identity", (rawPayload: unknown, ack?: (res: any) => void) => {
    const parsed = RegisterIdentitySchema.safeParse(rawPayload);
    if (!parsed.success) {
      if (typeof ack === "function") ack({ ok: false, error: "Identidad inválida" });
      return;
    }

    const { publicKey } = parsed.data;

    // Si este socket ya tenía una identidad anterior registrada, desasociarla limpiamente
    const previousPubKey = socketToIdentity.get(socket.id);
    if (previousPubKey && previousPubKey !== publicKey) {
      identitySockets.get(previousPubKey)?.delete(socket.id);
      if (identitySockets.get(previousPubKey)?.size === 0) {
        identitySockets.delete(previousPubKey);
      }
    }

    if (!identitySockets.has(publicKey)) {
      identitySockets.set(publicKey, new Set());
    }
    identitySockets.get(publicKey)!.add(socket.id);
    socketToIdentity.set(socket.id, publicKey);

    // 1. Despachar eliminaciones de contacto pendientes primero para limpiar relaciones previas
    const pendingDels = pendingPeerDeletions.get(publicKey);
    if (pendingDels && pendingDels.length > 0) {
      for (const peerKey of pendingDels) {
        socket.emit("direct_peer_deleted", { peerPublicKey: peerKey });
      }
      pendingPeerDeletions.delete(publicKey);
    }

    // 2. Despachar solicitudes directas pendientes en memoria si las hubiera (descartando expiradas > 48h)
    const pendingReqs = pendingDirectRequests.get(publicKey);
    if (pendingReqs && pendingReqs.length > 0) {
      const now = Date.now();
      const validReqs = pendingReqs.filter((r) => now - r.createdAt <= DIRECT_REQUEST_EXPIRATION_MS);
      for (const req of validReqs) {
        socket.emit("direct_request_received", req);
      }
      pendingDirectRequests.delete(publicKey);
    }

    // 3. Despachar respuestas a solicitudes pendientes (aceptadas o rechazadas)
    const pendingResp = pendingDirectResponses.get(publicKey);
    if (pendingResp && pendingResp.length > 0) {
      for (const res of pendingResp) {
        if (res.action === "accept") {
          socket.emit("direct_request_accepted", res);
        } else {
          socket.emit("direct_request_rejected", res);
        }
      }
      pendingDirectResponses.delete(publicKey);
    }

    // 4. Despachar mensajes directos pendientes
    const pendingMsgs = pendingDirectMessages.get(publicKey);
    if (pendingMsgs && pendingMsgs.length > 0) {
      for (const msg of pendingMsgs) {
        socket.emit("direct_msg_received", msg);
      }
      pendingDirectMessages.delete(publicKey);
    }

    if (typeof ack === "function") ack({ ok: true });
  });

  // Cancelar una solicitud enviada previamente
  socket.on("cancel_direct_request", (rawPayload: unknown, ack?: (res: any) => void) => {
    const parsed = CancelDirectRequestSchema.safeParse(rawPayload);
    if (!parsed.success) {
      if (typeof ack === "function") ack({ ok: false, error: "Datos de cancelación inválidos" });
      return;
    }

    const { requestId, toPublicKey } = parsed.data;
    const list = pendingDirectRequests.get(toPublicKey);
    if (list) {
      const filtered = list.filter((r) => r.id !== requestId);
      if (filtered.length === 0) {
        pendingDirectRequests.delete(toPublicKey);
      } else {
        pendingDirectRequests.set(toPublicKey, filtered);
      }
    }

    if (typeof ack === "function") ack({ ok: true });
  });

  // 2. Enviar solicitud de contacto permanente
  socket.on("send_direct_request", (rawPayload: unknown, ack?: (res: any) => void) => {
    const parsed = SendDirectRequestSchema.safeParse(rawPayload);
    if (!parsed.success) {
      if (typeof ack === "function") ack({ ok: false, error: "Solicitud inválida" });
      return;
    }

    const req = parsed.data;
    if (req.fromPublicKey === req.toPublicKey) {
      if (typeof ack === "function") ack({ ok: false, error: "No puedes auto-solicitarte" });
      return;
    }

    // Si había una eliminación pendiente de este emisor hacia el destinatario, descartarla
    const dels = pendingPeerDeletions.get(req.toPublicKey);
    if (dels) {
      pendingPeerDeletions.set(
        req.toPublicKey,
        dels.filter((k) => k !== req.fromPublicKey)
      );
    }

    const delivered = emitToIdentity(req.toPublicKey, "direct_request_received", req);
    if (delivered) {
      if (typeof ack === "function") ack({ ok: true, status: "delivered" });
    } else {
      // Cola volátil temporal en memoria (máx 20 por usuario, cero persistencia en disco)
      if (!pendingDirectRequests.has(req.toPublicKey)) {
        pendingDirectRequests.set(req.toPublicKey, []);
      }
      const list = pendingDirectRequests.get(req.toPublicKey)!;
      if (list.length < 20) {
        list.push(req);
      }
      if (typeof ack === "function") ack({ ok: true, status: "queued" });
    }
  });

  // 3. Responder a una solicitud (aceptar o rechazar)
  socket.on("respond_direct_request", (rawPayload: unknown, ack?: (res: any) => void) => {
    const parsed = RespondDirectRequestSchema.safeParse(rawPayload);
    if (!parsed.success) {
      if (typeof ack === "function") ack({ ok: false, error: "Respuesta inválida" });
      return;
    }

    const res = parsed.data;
    const event = res.action === "accept" ? "direct_request_accepted" : "direct_request_rejected";
    const delivered = emitToIdentity(res.toPublicKey, event, res);

    if (!delivered) {
      if (!pendingDirectResponses.has(res.toPublicKey)) {
        pendingDirectResponses.set(res.toPublicKey, []);
      }
      const list = pendingDirectResponses.get(res.toPublicKey)!;
      if (list.length < 20) {
        list.push(res);
      }
    }

    if (typeof ack === "function") ack({ ok: true });
  });

  // Cancelar una solicitud enviada previamente
  socket.on("cancel_direct_request", (rawPayload: unknown, ack?: (res: any) => void) => {
    const parsed = CancelDirectRequestSchema.safeParse(rawPayload);
    if (!parsed.success) {
      if (typeof ack === "function") ack({ ok: false, error: "Datos de cancelación inválidos" });
      return;
    }

    const { requestId, toPublicKey } = parsed.data;
    const list = pendingDirectRequests.get(toPublicKey);
    if (list) {
      const filtered = list.filter((r) => r.id !== requestId);
      if (filtered.length === 0) {
        pendingDirectRequests.delete(toPublicKey);
      } else {
        pendingDirectRequests.set(toPublicKey, filtered);
      }
    }

    if (typeof ack === "function") ack({ ok: true });
  });

  // 4. Enviar mensaje directo cifrado E2EE (relay zero-storage)
  socket.on("send_direct_msg", (rawPayload: unknown, ack?: (res: any) => void) => {
    const parsed = DirectMsgSchema.safeParse(rawPayload);
    if (!parsed.success) {
      if (typeof ack === "function") ack({ ok: false, error: "Mensaje inválido" });
      return;
    }

    const msg = parsed.data;
    const delivered = emitToIdentity(msg.toPublicKey, "direct_msg_received", msg);

    if (!delivered) {
      // Cola volátil en memoria si el destinatario no está conectado en este instante
      if (!pendingDirectMessages.has(msg.toPublicKey)) {
        pendingDirectMessages.set(msg.toPublicKey, []);
      }
      const list = pendingDirectMessages.get(msg.toPublicKey)!;
      if (list.length < 50) {
        list.push(msg);
      }
    }

    if (typeof ack === "function") ack({ ok: true, delivered });
  });

  // 5. Eliminar contacto bidireccionalmente
  socket.on("delete_direct_peer", (rawPayload: unknown, ack?: (res: any) => void) => {
    const parsed = DeleteDirectPeerSchema.safeParse(rawPayload);
    if (!parsed.success) {
      if (typeof ack === "function") ack({ ok: false, error: "Esquema inválido" });
      return;
    }

    const { fromPublicKey, toPublicKey } = parsed.data;
    const delivered = emitToIdentity(toPublicKey, "direct_peer_deleted", {
      peerPublicKey: fromPublicKey,
    });

    if (!delivered) {
      if (!pendingPeerDeletions.has(toPublicKey)) {
        pendingPeerDeletions.set(toPublicKey, []);
      }
      pendingPeerDeletions.get(toPublicKey)!.push(fromPublicKey);
    }

    if (typeof ack === "function") ack({ ok: true });
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

    // Limpiar mapeo de identidad
    const myPubKey = socketToIdentity.get(socket.id);
    if (myPubKey) {
      const set = identitySockets.get(myPubKey);
      if (set) {
        set.delete(socket.id);
        if (set.size === 0) {
          identitySockets.delete(myPubKey);
        }
      }
      socketToIdentity.delete(socket.id);
    }

    // Limpiar de colas de chat
    for (const [zId, queue] of chatQueues.entries()) {
      const idx = queue.findIndex((item) => item.socketId === socket.id);
      if (idx !== -1) {
        clearTimeout(queue[idx].timeoutId);
        queue.splice(idx, 1);
        if (queue.length === 0) {
          notifyScopeQueueChange(zId, false);
        }
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
      forgetForumIfEmpty(forumId);
    }
    joinedRooms.clear();

    // Limpiar participación en foros temporales
    const userForums = socketUserForums.get(socket.id);
    if (userForums) {
      for (const forumId of userForums) {
        forumParticipants.get(forumId)?.delete(socket.id);
        const count = forumParticipants.get(forumId)?.size ?? 0;
        io.to(forumId).emit("room_occupancy", { forumId, count });
      }
      socketUserForums.delete(socket.id);
    }

    for (const [reqId, pending] of pendingSyncs.entries()) {
      if (pending.requesterId === socket.id) {
        clearTimeout(pending.timeoutId);
        pendingSyncs.delete(reqId);
        const group = syncGroups.get(pending.groupId);
        if (group) {
          group.remaining -= 1;
          if (group.remaining <= 0) syncGroups.delete(pending.groupId);
        }
      }
    }
  });
});

httpServer.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(`\n[${APP_NAME} relay] ERROR: El puerto ${PORT} ya está en uso.`);
    console.error(`[${APP_NAME} relay] Hay otra instancia del servidor relay ejecutándose.`);
    console.error(`[${APP_NAME} relay] Para reiniciar, asegúrate de terminar el proceso anterior.\n`);
    process.exit(1);
  } else {
    console.error(`[${APP_NAME} relay] Error en servidor HTTP:`, err);
  }
});

const gracefulShutdown = () => {
  console.log(`\n[${APP_NAME} relay] Cerrando servidor relay limpiamente...`);
  io.close(() => {
    httpServer.close(() => {
      console.log(`[${APP_NAME} relay] Servidor detenido.`);
      process.exit(0);
    });
  });
  setTimeout(() => process.exit(0), 2000).unref();
};

process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`[${APP_NAME} relay] escuchando en 0.0.0.0 puerto ${PORT}`);
  console.log(`[${APP_NAME} relay] clave pública y protocolo de sync P2P activos`);
});
