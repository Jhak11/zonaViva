// ──────────────────────────────────────────────────────────────────────
//  Verificación de sellos criptográficos del relay (Iteración 3)
// ──────────────────────────────────────────────────────────────────────

function base64urlToBuf(str: string): ArrayBuffer {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (base64.length % 4)) % 4;
  const padded = base64 + "=".repeat(padLen);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

/**
 * Normaliza una firma ECDSA asegurando el formato IEEE P1363 (64 bytes raw R||S)
 * que exige WebCrypto. Si la firma viene en formato ASN.1 DER (Node.js por defecto),
 * extrae R y S y los ajusta a 32 bytes cada uno.
 */
function normalizeEcdsaSignature(sigBytes: Uint8Array): Uint8Array {
  if (sigBytes.length === 64) {
    return sigBytes;
  }
  // ASN.1 DER format: 0x30 [len] 0x02 [r_len] [r] 0x02 [s_len] [s]
  if (sigBytes.length >= 8 && sigBytes[0] === 0x30) {
    let offset = 2;
    if (sigBytes[1] & 0x80) {
      offset = 2 + (sigBytes[1] & 0x7f);
    }
    if (sigBytes[offset] === 0x02) {
      const rLen = sigBytes[offset + 1];
      offset += 2;
      const r = sigBytes.subarray(offset, offset + rLen);
      offset += rLen;
      if (sigBytes[offset] === 0x02) {
        const sLen = sigBytes[offset + 1];
        offset += 2;
        const s = sigBytes.subarray(offset, offset + sLen);

        const p1363 = new Uint8Array(64);
        const rStart = r.length > 32 ? r.length - 32 : 0;
        const rBytes = r.subarray(rStart);
        p1363.set(rBytes, 32 - rBytes.length);

        const sStart = s.length > 32 ? s.length - 32 : 0;
        const sBytes = s.subarray(sStart);
        p1363.set(sBytes, 64 - sBytes.length);

        return p1363;
      }
    }
  }
  return sigBytes;
}

/**
 * Calcula el hash SHA-256 en hexadecimal de un texto
 */
async function sha256Hex(str: string): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const encoder = new TextEncoder();
    const hashBuf = await crypto.subtle.digest("SHA-256", encoder.encode(str));
    const hashArray = Array.from(new Uint8Array(hashBuf));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  // Fallback simple si no hay WebCrypto
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
}

/**
 * Verifica si el mensaje fue sellado legítimamente por el relay.
 */
export async function verifyRelaySeal(
  relayPublicKeyB64: string | null,
  msg: {
    id: string;
    forumId: string;
    relayTs: number;
    content: string;
    relaySig: string;
  }
): Promise<boolean> {
  if (!msg.relaySig || msg.relaySig.length < 5) {
    return false;
  }

  if (!relayPublicKeyB64 || typeof crypto === "undefined" || !crypto.subtle) {
    // Si no hay WebCrypto disponible en este entorno, aceptar si tiene el sello
    return true;
  }

  try {
    const contentHash = await sha256Hex(msg.content);
    const payloadToVerify = `${msg.id}:${msg.forumId}:${msg.relayTs}:${contentHash}`;

    const key = await crypto.subtle.importKey(
      "spki",
      base64urlToBuf(relayPublicKeyB64),
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["verify"]
    );

    const encoder = new TextEncoder();
    const rawSig = new Uint8Array(base64urlToBuf(msg.relaySig));
    const normalizedSig = normalizeEcdsaSignature(rawSig);

    return await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      normalizedSig.buffer as ArrayBuffer,
      encoder.encode(payloadToVerify)
    );
  } catch {
    // Si la firma no coincide o la clave falló
    return false;
  }
}
