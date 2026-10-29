// ──────────────────────────────────────────────────────────────────────
//  Tipos compartidos del protocolo ZonaViva
// ──────────────────────────────────────────────────────────────────────

/** Coordenada geográfica simple */
export interface LatLng {
  lat: number;
  lng: number;
}

/** Zona geográfica permanente definida en el catálogo */
export interface Zone {
  /** Identificador estable, nunca cambia entre versiones. Ej: "puno-centro" */
  id: string;
  /** Nombre visible al usuario */
  name: string;
  /** Descripción corta */
  description: string;
  /** Tipo de geometría: círculo o polígono */
  type: "circle" | "polygon";
  /** Solo para type === "circle" */
  center?: LatLng;
  /** Radio en metros (solo para type === "circle") */
  radiusMeters?: number;
  /** Vértices del polígono (solo para type === "polygon") */
  polygon?: LatLng[];
  /** Posición aproximada para centrar el mapa (cualquier tipo) */
  mapCenter: LatLng;
  /** Zoom inicial sugerido para Leaflet */
  mapZoom: number;
}

/** Mensaje publicado en un foro */
export interface Message {
  /** ULID generado por el cliente antes de enviar (deduplicación) */
  id: string;
  /** "zone:<zoneId>" | "user:<uuid>" */
  forumId: string;
  /** Alias temporal visible */
  alias: string;
  /** Clave pública de sesión del autor (hex o base64url) */
  authorKey: string;
  /** Contenido de texto, máx. MAX_MESSAGE_LENGTH caracteres */
  content: string;
  /** Timestamp del cliente (informativo; NO se usa para ordenar) */
  clientTs: number;
  /** Timestamp asignado por el relay (define el orden canónico) */
  relayTs: number;
  /** Firma del autor sobre el contenido */
  sig: string;
  /** Firma del relay sobre (id, forumId, relayTs, hash(content)) */
  relaySig: string;
}

/** Foro guardado localmente en IndexedDB */
export interface Forum {
  /** "zone:<zoneId>" | "user:<uuid>" */
  id: string;
  type: "zone" | "user";
  name: string;
  /** Solo foros permanentes */
  zoneId?: string;
  /** Solo foros de usuario (precisión 5 o 6) */
  geohash?: string;
  createdAt: number;
  /** relayTs del último mensaje sincronizado */
  lastSyncRelayTs: number;
  /** Timestamp del último contacto (para caducidad de foros de usuario) */
  lastContactAt: number;
}

/** Sesión local del usuario */
export interface LocalSession {
  /** Alias temporal visible */
  alias: string;
  /** Clave pública ECDSA P-256 (base64url) */
  publicKey: string;
  /** Clave privada ECDSA P-256 (base64url, guardada en IndexedDB) */
  privateKey: string;
  /** Cuándo se creó la sesión */
  createdAt: number;
}

/** Mensaje en bandeja de salida (pendiente de enviar al reconectar) */
export interface OutboxMessage {
  id: string;
  forumId: string;
  content: string;
  clientTs: number;
  retries: number;
}

// ── Eventos del protocolo Socket.IO ────────────────────────────────────

export interface JoinForumPayload {
  forumId: string;
}

export interface LeaveForumPayload {
  forumId: string;
}

/** Payload que envía el cliente al publicar un mensaje */
export interface MsgPayload {
  id: string;
  forumId: string;
  alias: string;
  authorKey: string;
  content: string;
  clientTs: number;
  sig: string;
}

/** Mensaje sellado que retransmite el relay */
export interface MsgSealedPayload extends MsgPayload {
  relayTs: number;
  relaySig: string;
}

export interface SyncRequestPayload {
  forumId: string;
  since: number;
}

export interface SyncChunkPayload {
  forumId: string;
  messages: Message[];
  hasMore: boolean;
}

export interface SyncUnavailablePayload {
  forumId: string;
}

export interface PeerSyncRequestPayload {
  requestId: string;
  forumId: string;
  since: number;
}

export interface PeerSyncResponsePayload {
  requestId: string;
  forumId: string;
  messages: Message[];
  hasMore: boolean;
}

export interface ListForumsPayload {
  geohash: string;
}

export interface RegisterForumPayload {
  id: string;
  name: string;
  geohash: string;
  createdAt: number;
}

export interface QueueChatPayload {
  zoneId: string;
  ephemeralPublicKey: string;
}

export interface MatchedPayload {
  roomId: string;
  peerPublicKey: string;
}

export interface ChatMsgPayload {
  roomId: string;
  /** Texto cifrado con AES-GCM (base64url) */
  ciphertext: string;
  /** Nonce AES-GCM (base64url) */
  nonce: string;
}

export interface LeaveChatPayload {
  roomId: string;
}
