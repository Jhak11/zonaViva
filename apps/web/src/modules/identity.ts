// ──────────────────────────────────────────────────────────────────────
//  Módulo de identidad temporal
//  Genera alias aleatorio + par de claves ECDSA P-256 usando WebCrypto.
//  NO depende de librerías externas de criptografía.
// ──────────────────────────────────────────────────────────────────────
import type { LocalSession } from "@zonaviva/protocol";

// ── Generación de alias aleatorio ─────────────────────────────────────

/** Adjetivos y sustantivos en español para alias amigables */
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

// ── Criptografía (WebCrypto) ──────────────────────────────────────────

/** Convierte ArrayBuffer a base64url */
function bufToBase64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
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

/** Genera un par de claves ECDSA P-256 */
async function generateKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(ECDSA_PARAMS, true, ["sign", "verify"]);
}

/** Exporta una CryptoKey pública a base64url (formato SPKI) */
async function exportPublicKey(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey("spki", key);
  return bufToBase64url(raw);
}

/** Exporta una CryptoKey privada a base64url (formato PKCS8) */
async function exportPrivateKey(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey("pkcs8", key);
  return bufToBase64url(raw);
}

/** Importa una clave pública desde base64url */
async function importPublicKey(b64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "spki",
    base64urlToBuf(b64),
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["verify"]
  );
}

/** Importa una clave privada desde base64url */
async function importPrivateKey(b64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "pkcs8",
    base64urlToBuf(b64),
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign"]
  );
}

// ── API pública del módulo ────────────────────────────────────────────

/**
 * Genera una sesión nueva con alias aleatorio y par de claves.
 * Devuelve un LocalSession con claves exportadas (base64url) listas para guardar.
 */
export async function generateSession(): Promise<LocalSession> {
  const keyPair = await generateKeyPair();
  const [publicKey, privateKey] = await Promise.all([
    exportPublicKey(keyPair.publicKey),
    exportPrivateKey(keyPair.privateKey),
  ]);
  return {
    alias: generateAlias(),
    publicKey,
    privateKey,
    createdAt: Date.now(),
  };
}

/**
 * Exporta la sesión (ya está en base64url desde generateSession).
 * Esta función existe para uniformidad si en el futuro se necesita transformación.
 */
export async function exportSession(session: LocalSession): Promise<LocalSession> {
  return session;
}

/**
 * Importa y valida una sesión guardada (re-importa las claves para comprobar integridad).
 * Lanza si las claves son inválidas.
 */
export async function importSession(stored: LocalSession): Promise<LocalSession> {
  // Validar que las claves se pueden importar correctamente
  await Promise.all([
    importPublicKey(stored.publicKey),
    importPrivateKey(stored.privateKey),
  ]);
  return stored;
}

/**
 * Firma un mensaje con la clave privada de la sesión.
 * @returns firma en base64url
 */
export async function signMessage(
  privateKeyB64: string,
  message: string
): Promise<string> {
  const key = await importPrivateKey(privateKeyB64);
  const encoder = new TextEncoder();
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    encoder.encode(message)
  );
  return bufToBase64url(sig);
}

/**
 * Verifica la firma de un mensaje con la clave pública del autor.
 */
export async function verifySignature(
  publicKeyB64: string,
  message: string,
  sigB64: string
): Promise<boolean> {
  try {
    const key = await importPublicKey(publicKeyB64);
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
