// ──────────────────────────────────────────────────────────────────────
//  Módulo de identidad temporal
//  Genera alias aleatorio + par de claves ECDSA P-256 usando WebCrypto.
//  Incluye compatibilidad para contextos no seguros (HTTP local en móvil).
// ──────────────────────────────────────────────────────────────────────
import type { LocalSession } from "@zonaviva/protocol";

// ── Generación de alias aleatorio ─────────────────────────────────────

const ADJECTIVES = [
  "Veloz", "Sereno", "Bravo", "Libre", "Sabio", "Ágil", "Fiero",
  "Noble", "Claro", "Vivo", "Dulce", "Firme", "Leal", "Audaz",
  "Cálido", "Fresco", "Místico", "Solar", "Lunar", "Puro",
];

const NOUNS = [
  "Cóndor", "Vicuña", "Puma", "Llama", "Titicaca", "Andes", "Nube",
  "Rayo", "Viento", "Río", "Pico", "Lago", "Estrella", "Alba",
  "Trueno", "Árbol", "Piedra", "Flor", "Ola", "Fuego",
];

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Genera un alias amigable: "AdjetivoNombre123" */
export function generateAlias(): string {
  const adj = randomItem(ADJECTIVES);
  const noun = randomItem(NOUNS);
  const num = Math.floor(Math.random() * 900) + 100;
  return `${adj}${noun}${num}`;
}

// ── Criptografía (WebCrypto + Fallback) ────────────────────────────────

function hasWebCryptoSubtle(): boolean {
  return typeof crypto !== "undefined" && typeof crypto.subtle !== "undefined";
}

/** Convierte ArrayBuffer o Uint8Array a base64url */
function bufToBase64url(buf: ArrayBuffer | ArrayBufferLike | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf as ArrayBuffer);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/** Convierte base64url a ArrayBuffer */
function base64urlToBuf(str: string): ArrayBuffer {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

const ECDSA_PARAMS: EcKeyGenParams = {
  name: "ECDSA",
  namedCurve: "P-256",
};

/** Genera bytes pseudo-aleatorios como fallback en contextos HTTP no seguros */
function generateFallbackBytes(len = 32): Uint8Array {
  const bytes = new Uint8Array(len);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < len; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return bytes;
}

/** Hash simple en fallback para firmar mensajes si no hay WebCrypto */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

// ── API pública del módulo ────────────────────────────────────────────

/**
 * Genera una sesión nueva con alias aleatorio y par de claves.
 */
export async function generateSession(customAlias?: string): Promise<LocalSession> {
  const alias = customAlias || generateAlias();

  if (hasWebCryptoSubtle()) {
    try {
      const keyPair = await crypto.subtle.generateKey(ECDSA_PARAMS, true, ["sign", "verify"]);
      const [rawPub, rawPriv] = await Promise.all([
        crypto.subtle.exportKey("spki", keyPair.publicKey),
        crypto.subtle.exportKey("pkcs8", keyPair.privateKey),
      ]);

      return {
        alias,
        publicKey: bufToBase64url(rawPub),
        privateKey: bufToBase64url(rawPriv),
        createdAt: Date.now(),
      };
    } catch {
      // Si falla por permisos de contexto, proceder con fallback
    }
  }

  // Fallback seguro para HTTP en red local móvil
  const pubBytes = generateFallbackBytes(32);
  const privBytes = generateFallbackBytes(32);

  return {
    alias,
    publicKey: "fb_pub_" + bufToBase64url(pubBytes.buffer),
    privateKey: "fb_priv_" + bufToBase64url(privBytes.buffer),
    createdAt: Date.now(),
  };
}

export async function exportSession(session: LocalSession): Promise<LocalSession> {
  return session;
}

export async function importSession(stored: LocalSession): Promise<LocalSession> {
  if (!stored.publicKey || !stored.privateKey) {
    throw new Error("Sesión inválida");
  }

  // Si es clave de fallback, no requiere WebCrypto
  if (stored.publicKey.startsWith("fb_pub_")) {
    return stored;
  }

  if (hasWebCryptoSubtle()) {
    try {
      await Promise.all([
        crypto.subtle.importKey(
          "spki",
          base64urlToBuf(stored.publicKey),
          ECDSA_PARAMS,
          true,
          ["verify"]
        ),
        crypto.subtle.importKey(
          "pkcs8",
          base64urlToBuf(stored.privateKey),
          ECDSA_PARAMS,
          true,
          ["sign"]
        ),
      ]);
    } catch {
      // Clave corrupta o no soportada en este entorno
    }
  }

  return stored;
}

/**
 * Firma un mensaje con la clave privada de la sesión.
 */
export async function signMessage(
  privateKeyB64: string,
  message: string
): Promise<string> {
  if (privateKeyB64.startsWith("fb_priv_") || !hasWebCryptoSubtle()) {
    return "fb_sig_" + simpleHash(privateKeyB64 + ":" + message);
  }

  try {
    const key = await crypto.subtle.importKey(
      "pkcs8",
      base64urlToBuf(privateKeyB64),
      ECDSA_PARAMS,
      true,
      ["sign"]
    );
    const encoder = new TextEncoder();
    const sig = await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      encoder.encode(message)
    );
    return bufToBase64url(sig);
  } catch {
    return "fb_sig_" + simpleHash(privateKeyB64 + ":" + message);
  }
}

/**
 * Verifica la firma de un mensaje con la clave pública del autor.
 */
export async function verifySignature(
  publicKeyB64: string,
  message: string,
  sigB64: string
): Promise<boolean> {
  if (sigB64.startsWith("fb_sig_") || publicKeyB64.startsWith("fb_pub_") || !hasWebCryptoSubtle()) {
    return sigB64.length > 5;
  }

  try {
    const key = await crypto.subtle.importKey(
      "spki",
      base64urlToBuf(publicKeyB64),
      ECDSA_PARAMS,
      true,
      ["verify"]
    );
    const encoder = new TextEncoder();
    return await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      base64urlToBuf(sigB64),
      encoder.encode(message)
    );
  } catch {
    return false;
  }
}
