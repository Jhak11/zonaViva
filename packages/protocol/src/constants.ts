// ──────────────────────────────────────────────────────────────────────
//  Constantes del protocolo ZonaViva
// ──────────────────────────────────────────────────────────────────────

/** Longitud máxima de un mensaje de foro (caracteres) */
export const MAX_MESSAGE_LENGTH = 1000;

/** Longitud máxima de un alias visible */
export const MAX_ALIAS_LENGTH = 32;

/** Longitud máxima del nombre de un foro creado por usuario */
export const MAX_FORUM_NAME_LENGTH = 64;

/** Longitud máxima de la descripción de un foro creado por usuario */
export const MAX_FORUM_DESCRIPTION_LENGTH = 200;

/** Máximo de foros de usuario simultáneos en los que un cliente puede ser participante */
export const MAX_USER_FORUMS_PER_CLIENT = 15;

/** Radio por defecto para foros temporales de usuario (metros) */
export const DEFAULT_FORUM_RADIUS = 200;

/** Radio mínimo permitido para un foro temporal (metros) */
export const MIN_FORUM_RADIUS = 50;

/** Radio máximo permitido para un foro temporal (metros) */
export const MAX_FORUM_RADIUS = 2000;

/** Radios preconfigurados para selección en la interfaz (metros) */
export const ALLOWED_FORUM_RADII = [50, 100, 200, 500, 1000] as const;

/** Máximo de mensajes por chunk de sincronización */
export const SYNC_CHUNK_SIZE = 50;

/** Pares con copia a los que el relay reenvía cada sync_request */
export const SYNC_PEER_COUNT = 2;

/** Timeout de sincronización antes de declarar "no disponible" (ms) */
export const SYNC_TIMEOUT_MS = 8_000;

/** Los mensajes más antiguos que este plazo se descartan y no se vuelven a pedir */
export const MESSAGE_RETENTION_MS = 3 * 24 * 60 * 60 * 1000;

/** Máximo de foros de los que un cliente sirve historial al entrar a la plataforma */
export const MAX_SERVED_FORUMS = 5;

/** Número máximo de conexiones simultáneas permitidas por IP (en memoria del relay) */
export const MAX_CONNECTIONS_PER_IP = 10;

/** Prefijo de ID para foros de zona permanente */
export const FORUM_PREFIX_ZONE = "zone:";

/** Prefijo de ID para foros creados por usuario */
export const FORUM_PREFIX_USER = "user:";

/** Nombre de la aplicación */
export const APP_NAME = "ZonaViva";

/** Versión del protocolo (bumpeada si hay cambios incompatibles) */
export const PROTOCOL_VERSION = "1";

// ── Chat Directo y Pares Permanentes ──────────────────────────────────

/** Máximo de contactos permanentes guardados por usuario */
export const MAX_DIRECT_PEERS_PER_CLIENT = 20;

/** Longitud máxima del mensaje de presentación al solicitar contacto */
export const MAX_INTRO_MESSAGE_LENGTH = 120;

/** Tiempo de cooldown tras ser rechazada una solicitud directa (24 horas) */
export const DIRECT_REQUEST_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/** Tiempo de expiración automática para solicitudes de chat directo sin respuesta (48 horas) */
export const DIRECT_REQUEST_EXPIRATION_MS = 48 * 60 * 60 * 1000;


/** Precisión de geohash para el catálogo de zonas (≈153m × 153m) */
export const GRID_PRECISION = 7;

/** Radio mínimo del círculo de precisión del usuario (metros) */
export const USER_CIRCLE_MIN_RADIUS = 50;

/** Radio máximo del círculo de precisión del usuario (metros) */
export const USER_CIRCLE_MAX_RADIUS = 150;

/** Precisión GPS máxima aceptable (metros) */
export const MAX_ACCEPTABLE_ACCURACY = 300;

/** Distancia mínima de movimiento para actualizar posición (metros) */
export const MIN_MOVEMENT_THRESHOLD = 25;

/** Edad máxima de la posición antes de pedir actualización (ms) */
export const MAX_POSITION_AGE = 60_000; // 60 segundos

// ── Mapa y tiles ──────────────────────────────────────────────────────

/** URL del proveedor de tiles del mapa */
export const MAP_TILES_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

/** Atribución requerida por OSM */
export const MAP_TILES_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>';

/** Nivel de zoom por defecto */
export const MAP_DEFAULT_ZOOM = 15;

/** Nivel de zoom mínimo permitido */
export const MAP_MIN_ZOOM = 12;

/** Nivel de zoom máximo permitido */
export const MAP_MAX_ZOOM = 18;
