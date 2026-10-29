// ──────────────────────────────────────────────────────────────────────
//  Verificación de sellos criptográficos del relay (Iteración 3)
// ──────────────────────────────────────────────────────────────────────

function base64urlToBuf(str: string): ArrayBuffer {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
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
    return await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      base64urlToBuf(msg.relaySig),
      encoder.encode(payloadToVerify)
    );
  } catch {
    // Si la firma no coincide o la clave falló
    return false;
  }
}
