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
  /** Identificador estable, nunca cambia entre versiones. Ej: "mercado-central" */
  id: string;
  /** Nombre visible al usuario */
  name: string;
  /** Descripción corta */
  description: string;
  /** Tipo de zona (siempre "permanent" para zonas del catálogo) */
  type: "permanent";
  /** Array de celdas geohash que componen la zona */
  cells: string[];
  /** Código de color hexadecimal para visualización distintiva en mapas */
  color?: string;
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

/** Foro temporal creado por usuario con ámbito circular */
export interface TemporaryForum {
  /** "user:<ulid>" */
  id: string;
  type: "user";
  name: string;
  description: string;
  latitude: number;
  longitude: number;
  /** Radio circular en metros */
  radius: number;
  createdAt: number;
  /** Clave pública de sesión del fundador */
  creatorKey: string;
  /** Cantidad de participantes activos conectados en la red */
  participantCount?: number;
}

/** Foro guardado localmente en IndexedDB */
export interface Forum {
  /** "zone:<zoneId>" | "user:<ulid>" */
  id: string;
  type: "zone" | "user";
  name: string;
  description?: string;
  /** Solo foros permanentes */
  zoneId?: string;
  /** Campos para foros temporales de usuario (ámbito circular) */
  latitude?: number;
  longitude?: number;
  radius?: number;
  creatorKey?: string;
  /** Solo foros de usuario legacy (precisión 5 o 6) */
  geohash?: string;
  createdAt: number;
  /** relayTs del último mensaje sincronizado */
  lastSyncRelayTs: number;
  /** Timestamp del último contacto (para caducidad de foros de usuario) */
  lastContactAt: number;
  /** Indica si el usuario actual es participante formal de este foro */
  isParticipant?: boolean;
  /** Timestamp de cuándo se unió como participante */
  joinedAt?: number;
  /** Timestamp (relayTs) del último mensaje leído en este foro */
  lastReadRelayTs?: number;
  /** Conteo en memoria de mensajes no leídos */
  unreadCount?: number;
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

export interface CancelQueuePayload {
  zoneId?: string;
}

export interface PeerLeftPayload {
  roomId: string;
}

export interface QueueTimeoutPayload {
  zoneId: string;
}

// ── Pares Permanentes y Mensajería Directa E2EE ──────────────────────

/** Par permanente guardado en la libreta de contactos local */
export interface DirectPeer {
  /** Clave pública de identidad ECDSA P-256 del par */
  peerPublicKey: string;
  /** Alias visible */
  alias: string;
  /** ID único del canal ("direct:<pubA>_<pubB>") */
  channelId: string;
  /** Clave pública ECDH P-256 para intercambio de llaves E2EE */
  e2eePublicKey: string;
  /** Timestamp de creación */
  createdAt: number;
  /** Timestamp de última interacción (para ordenar chats) */
  lastInteractionTs: number;
  /** Conteo en memoria de mensajes no leídos */
  unreadCount?: number;
  /** Vista previa del último mensaje */
  lastMessagePreview?: string;
  /** Indica si el otro par ha eliminado o renovado su perfil */
  isDeletedByPeer?: boolean;
}

/** Solicitud de chat directo (entrante o saliente) */
export interface DirectRequest {
  id: string;
  peerPublicKey: string;
  peerAlias: string;
  direction: "incoming" | "outgoing";
  status: "pending" | "accepted" | "rejected" | "expired";
  introMessage?: string;
  sourceForumName?: string;
  e2eePublicKey: string;
  createdAt: number;
  /** Para peticiones rechazadas: fecha hasta la cual no se puede reintentar */
  cooldownUntil?: number;
}

/** Mensaje directo guardado localmente (descifrado) */
export interface DirectMessage {
  id: string;
  channelId: string;
  fromPublicKey: string;
  toPublicKey: string;
  fromAlias: string;
  content: string;
  clientTs: number;
  isOutgoing: boolean;
}

export interface RegisterIdentityPayload {
  publicKey: string;
  alias: string;
}

export interface SendDirectRequestPayload {
  id: string;
  fromPublicKey: string;
  fromAlias: string;
  toPublicKey: string;
  introMessage?: string;
  sourceForumName?: string;
  e2eePublicKey: string;
  createdAt: number;
}

export interface RespondDirectRequestPayload {
  requestId: string;
  action: "accept" | "reject";
  fromPublicKey: string;
  toPublicKey: string;
  peerAlias?: string;
  e2eePublicKey?: string;
}

export interface CancelDirectRequestPayload {
  requestId: string;
  toPublicKey: string;
}

export interface DirectMsgPayload {
  id: string;
  channelId: string;
  toPublicKey: string;
  fromPublicKey: string;
  fromAlias: string;
  ciphertext: string;
  nonce: string;
  clientTs: number;
}

export interface DeleteDirectPeerPayload {
  fromPublicKey: string;
  toPublicKey: string;
}


