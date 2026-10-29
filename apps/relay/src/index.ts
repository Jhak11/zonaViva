// ──────────────────────────────────────────────────────────────────────
//  ZonaViva Relay – Iteración 2
//  Servidor en memoria (sin base de datos, sin logs de IP ni contenido).
//  Salas de foro geográfico, validación de esquemas Zod, sellado
//  con marca de tiempo oficial (relayTs) y firma del relay.
// ──────────────────────────────────────────────────────────────────────
import { createServer } from "http";
import { Server } from "socket.io";
import crypto from "node:crypto";
import {
  PROTOCOL_VERSION,
  APP_NAME,
  MAX_CONNECTIONS_PER_IP,
  FORUM_PREFIX_ZONE,
  ZONES_BY_ID,
  MsgPayloadSchema,
  JoinForumSchema,
  type MsgPayload,
  type MsgSealedPayload,
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
  return sign.sign(relayKeyPair.privateKey, "base64url");
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
  maxHttpBufferSize: 8_192, // 8 KB
});

io.on("connection", (socket) => {
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

  // Registro de salas en las que está este socket
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

    // Notificar ocupación a todos los miembros de la sala
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

    const occupancy = io.sockets.adapter.rooms.get(forumId)?.size ?? 0;
    io.to(forumId).emit("room_occupancy", { forumId, count: occupancy });
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

    // Verificar que el socket esté unido a la sala del foro
    if (!socket.rooms.has(data.forumId)) {
      socket.emit("error_msg", { message: "No estás unido a este foro." });
      if (typeof ack === "function") ack({ ok: false, error: "No unido al foro." });
      return;
    }

    // Validar zona permanente
    if (data.forumId.startsWith(FORUM_PREFIX_ZONE)) {
      const zoneId = data.forumId.slice(FORUM_PREFIX_ZONE.length);
      if (!ZONES_BY_ID[zoneId]) {
        socket.emit("error_msg", { message: "La zona especificada no existe." });
        if (typeof ack === "function") ack({ ok: false, error: "Zona inválida." });
        return;
      }
    }

    // Asignar marca de tiempo canónica y sellar con firma del relay
    const relayTs = getNextRelayTs();
    const relaySig = signRelayMessage(data.id, data.forumId, relayTs, data.content);

    const sealed: MsgSealedPayload = {
      ...data,
      relayTs,
      relaySig,
    };

    // Fan-out a todos los miembros de la sala (incluyendo al autor)
    io.to(data.forumId).emit("msg_sealed", sealed);

    if (typeof ack === "function") {
      ack({ ok: true, relayTs, relaySig });
    }
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

    // Actualizar ocupación en las salas que abandonó
    for (const forumId of joinedRooms) {
      const occupancy = io.sockets.adapter.rooms.get(forumId)?.size ?? 0;
      io.to(forumId).emit("room_occupancy", { forumId, count: occupancy });
    }
    joinedRooms.clear();
  });
});

httpServer.listen(PORT, () => {
  console.log(`[${APP_NAME} relay] escuchando en puerto ${PORT}`);
  console.log(`[${APP_NAME} relay] clave pública lista para verificación de firmas`);
});
