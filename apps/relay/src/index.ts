// ──────────────────────────────────────────────────────────────────────
//  ZonaViva Relay – Iteración 1 (esqueleto)
//  En esta iteración el relay solo sirve para validar la conexión.
//  Los módulos completos (salas, sellado, emparejamiento) se añaden
//  en las iteraciones 2–5.
// ──────────────────────────────────────────────────────────────────────
import { createServer } from "http";
import { Server } from "socket.io";
import { PROTOCOL_VERSION, APP_NAME, MAX_CONNECTIONS_PER_IP } from "@zonaviva/protocol";

const PORT = Number(process.env.PORT ?? 3001);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";

// Conteo de conexiones por IP (en memoria, sin persistencia)
const connectionsByIp = new Map<string, number>();

const httpServer = createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({
    app: APP_NAME,
    relay: "ok",
    version: PROTOCOL_VERSION,
    timestamp: Date.now(),
  }));
});

const io = new Server(httpServer, {
  cors: {
    origin: CLIENT_ORIGIN,
    methods: ["GET", "POST"],
  },
  // Límite de tamaño de payload (se ampliará en Iter 2 con validación Zod)
  maxHttpBufferSize: 8_192, // 8 KB
});

io.on("connection", (socket) => {
  // Obtener IP sin guardarla en logs de contenido
  const ip =
    (socket.handshake.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ??
    socket.handshake.address;

  // Límite de conexiones por IP
  const count = (connectionsByIp.get(ip) ?? 0) + 1;
  if (count > MAX_CONNECTIONS_PER_IP) {
    socket.emit("error_limit", { message: "Demasiadas conexiones desde tu red." });
    socket.disconnect(true);
    return;
  }
  connectionsByIp.set(ip, count);

  // Bienvenida (no incluye IP)
  socket.emit("welcome", {
    app: APP_NAME,
    version: PROTOCOL_VERSION,
    ts: Date.now(),
  });

  console.log(`[relay] +conexión (total: ${io.engine.clientsCount})`);

  socket.on("disconnect", () => {
    const remaining = (connectionsByIp.get(ip) ?? 1) - 1;
    if (remaining <= 0) {
      connectionsByIp.delete(ip);
    } else {
      connectionsByIp.set(ip, remaining);
    }
    console.log(`[relay] -conexión (total: ${io.engine.clientsCount})`);
  });

  // Ping de salud (el cliente puede usarlo para medir latencia)
  socket.on("ping_relay", (cb) => {
    if (typeof cb === "function") cb({ ts: Date.now() });
  });
});

httpServer.listen(PORT, () => {
  console.log(`[${APP_NAME} relay] escuchando en puerto ${PORT}`);
  console.log(`[${APP_NAME} relay] CORS: ${CLIENT_ORIGIN}`);
});
