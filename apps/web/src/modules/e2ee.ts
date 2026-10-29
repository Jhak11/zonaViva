// ──────────────────────────────────────────────────────────────────────
//  Módulo de Cifrado Extremo a Extremo (E2EE) para Chat Efímero
//  Utiliza WebCrypto nativo:
//  - Par de claves efímeras: ECDH sobre curva NIST P-256
//  - Derivación de clave compartida: ECDH deriveBits + HKDF (SHA-256)
//  - Cifrado simétrico autenticado: AES-GCM (256 bits) con nonce único de 12 bytes
//  - SAS (Short Authentication String): Código de verificación comparable
// ──────────────────────────────────────────────────────────────────────

export function bufToBase64url(buf: ArrayBuffer | ArrayBufferLike | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf as ArrayBuffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

export function base64urlToBuf(str: string): Uint8Array {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (base64.length % 4)) % 4;
  const padded = base64 + "=".repeat(padLen);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** Genera un par de claves efímero ECDH P-256 en memoria */
export async function generateEphemeralKeyPair(): Promise<CryptoKeyPair> {
  return await crypto.subtle.generateKey(
    {
      name: "ECDH",
      namedCurve: "P-256",
    },
    true,
    ["deriveKey", "deriveBits"]
  );
}

/** Exporta la clave pública ECDH en formato raw (65 bytes punto no comprimido) en base64url */
export async function exportPublicKey(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey("raw", key);
  return bufToBase64url(raw);
}

/** Importa una clave pública ECDH recibida en formato raw base64url */
export async function importPublicKey(b64url: string): Promise<CryptoKey> {
  const rawBytes = base64urlToBuf(b64url);
  return await crypto.subtle.importKey(
    "raw",
    rawBytes as unknown as BufferSource,
    {
      name: "ECDH",
      namedCurve: "P-256",
    },
    false,
    []
  );
}

/**
 * Deriva la clave compartida AES-GCM de 256 bits usando ECDH + HKDF SHA-256
 */
export async function deriveSharedKey(
  myPrivateKey: CryptoKey,
  peerPublicKey: CryptoKey
): Promise<CryptoKey> {
  // 1. Derivar bits compartidos con ECDH (256 bits)
  const sharedBits = await crypto.subtle.deriveBits(
    {
      name: "ECDH",
      public: peerPublicKey,
    },
    myPrivateKey,
    256
  );

  // 2. Importar los bits como clave HKDF
  const hkdfKey = await crypto.subtle.importKey(
    "raw",
    sharedBits,
    "HKDF",
    false,
    ["deriveKey"]
  );

  // 3. Derivar la clave AES-GCM de 256 bits con salt e info de dominio
  return await crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new TextEncoder().encode("zonaviva-random-chat-salt-v1"),
      info: new TextEncoder().encode("zonaviva-aes-gcm-256"),
    },
    hkdfKey,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Calcula un código de verificación de 8 dígitos (SAS) ordenando lexicográficamente
 * las dos claves públicas. Ambos participantes verán idéntico código para comparar.
 */
export async function computeVerificationCode(
  pubKeyA: string,
  pubKeyB: string
): Promise<string> {
  // Ordenar para garantizar el mismo resultado independientemente del rol
  const [first, second] = [pubKeyA, pubKeyB].sort();
  const data = new TextEncoder().encode(`${first}:${second}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const view = new DataView(digest);

  // Dos números de 4 dígitos entre 0000 y 9999
  const num1 = (view.getUint32(0, false) % 9000) + 1000;
  const num2 = (view.getUint32(4, false) % 9000) + 1000;

  return `${num1} - ${num2}`;
}

/**
 * Cifra un texto usando AES-GCM con un nonce aleatorio único de 12 bytes
 */
export async function encryptMessage(
  plaintext: string,
  aesKey: CryptoKey
): Promise<{ ciphertext: string; nonce: string }> {
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);

  const cipherBuf = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: nonce,
    },
    aesKey,
    encoded
  );

  return {
    ciphertext: bufToBase64url(cipherBuf),
    nonce: bufToBase64url(nonce),
  };
}

/**
 * Descifra un mensaje cifrado con AES-GCM. Si falla la autenticación, arroja error.
 */
export async function decryptMessage(
  ciphertextB64: string,
  nonceB64: string,
  aesKey: CryptoKey
): Promise<string> {
  const nonce = base64urlToBuf(nonceB64);
  const cipherBytes = base64urlToBuf(ciphertextB64);

  const plainBuf = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: nonce as unknown as BufferSource,
    },
    aesKey,
    cipherBytes as unknown as BufferSource
  );

  return new TextDecoder().decode(plainBuf);
}
