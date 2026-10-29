// ──────────────────────────────────────────────────────────────────────
//  ZonaViva Archivista – Iteración 3
//  Cliente Node.js que se une a los foros permanentes y preserva una copia
//  en memoria para abastecer a nuevos clientes vía retransmisión de sync.
//  NO es una base de datos central: actúa como un par más conectado.
// ──────────────────────────────────────────────────────────────────────
import { io } from "socket.io-client";
import {
  ZONES,
  FORUM_PREFIX_ZONE,
  type Message,
  type PeerSyncRequestPayload,
  type PeerSyncResponsePayload,
} from "@zonaviva/protocol";

const RELAY_URL = process.env.RELAY_URL ?? "http://127.0.0.1:3001";

console.log(`[Archivista] Conectando a relay en ${RELAY_URL}...`);

// Almacén en memoria por sala de foro
const messagesByForum = new Map<string, Message[]>();

// Inicializar contenedores de foros permanentes
for (const zone of ZONES) {
  const forumId = `${FORUM_PREFIX_ZONE}${zone.id}`;
  messagesByForum.set(forumId, []);
}

const socket = io(RELAY_URL, {
  transports: ["websocket"],
  reconnection: true,
  reconnectionDelay: 1000,
});

socket.on("connect", () => {
  console.log(`[Archivista] Conectado al relay con socket ID: ${socket.id}`);

  // Unirse a todos los foros permanentes del catálogo
  for (const zone of ZONES) {
    const forumId = `${FORUM_PREFIX_ZONE}${zone.id}`;
    socket.emit("join_forum", { forumId }, (res: { ok: boolean; count?: number }) => {
      if (res?.ok) {
        console.log(`[Archivista] Unido a sala permanente: ${zone.name} (${forumId})`);
        const count = messagesByForum.get(forumId)?.length ?? 0;
        socket.emit("report_has_history", { forumId, count });
      }
    });
  }
});

// Guardar mensajes sellados difundidos por el relay
socket.on("msg_sealed", (msg: Message) => {
  if (!messagesByForum.has(msg.forumId)) {
    messagesByForum.set(msg.forumId, []);
  }

  const list = messagesByForum.get(msg.forumId)!;
  if (!list.some((m) => m.id === msg.id)) {
    list.push(msg);
    // Ordenar canónicamente
    list.sort((a, b) => {
      if (a.relayTs !== b.relayTs) return a.relayTs - b.relayTs;
      return a.id.localeCompare(b.id);
    });
    // Notificar al relay que tiene historial
    socket.emit("report_has_history", { forumId: msg.forumId, count: list.length });
    console.log(`[Archivista] Mensaje preservado en ${msg.forumId} (total: ${list.length})`);
  }
});

// Responder peticiones de sincronización dirigidas a pares
socket.on("peer_sync_request", (req: PeerSyncRequestPayload) => {
  const allMessages = messagesByForum.get(req.forumId) ?? [];
  const filtered = allMessages.filter((m) => m.relayTs > req.since);

  console.log(
    `[Archivista] Solicitud de sync para ${req.forumId} (since: ${req.since}). Enviando ${filtered.length} mensajes.`
  );

  const response: PeerSyncResponsePayload = {
    requestId: req.requestId,
    forumId: req.forumId,
    messages: filtered.slice(0, 50),
    hasMore: filtered.length > 50,
  };

  socket.emit("peer_sync_response", response);
});

socket.on("disconnect", () => {
  console.log("[Archivista] Desconectado del relay. Reintentando...");
});
