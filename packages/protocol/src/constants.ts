// ──────────────────────────────────────────────────────────────────────
//  Constantes del protocolo ZonaViva
// ──────────────────────────────────────────────────────────────────────

/** Longitud máxima de un mensaje de foro (caracteres) */
export const MAX_MESSAGE_LENGTH = 1000;

/** Longitud máxima de un alias visible */
export const MAX_ALIAS_LENGTH = 32;

/** Longitud máxima del nombre de un foro creado por usuario */
export const MAX_FORUM_NAME_LENGTH = 64;

/** Tiempo de gracia antes de que el relay elimine un foro de usuario sin miembros (ms) */
export const FORUM_GRACE_PERIOD_MS = 24 * 60 * 60 * 1000; // 24 h

/** Máximo de mensajes por chunk de sincronización */
export const SYNC_CHUNK_SIZE = 50;

/** Timeout de sincronización antes de declarar "no disponible" (ms) */
export const SYNC_TIMEOUT_MS = 8_000;

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
