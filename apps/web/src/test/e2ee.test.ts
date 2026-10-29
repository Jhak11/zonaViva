import { describe, it, expect } from "vitest";
import {
  generateEphemeralKeyPair,
  exportPublicKey,
  importPublicKey,
  deriveSharedKey,
  computeVerificationCode,
  encryptMessage,
  decryptMessage,
} from "../modules/e2ee";

describe("E2EE Cryptography Module (ECDH P-256 + HKDF + AES-GCM)", () => {
  it("generates and exports/imports ephemeral ECDH P-256 keys", async () => {
    const keyPair = await generateEphemeralKeyPair();
    expect(keyPair.publicKey).toBeDefined();
    expect(keyPair.privateKey).toBeDefined();

    const pubB64 = await exportPublicKey(keyPair.publicKey);
    expect(typeof pubB64).toBe("string");
    expect(pubB64.length).toBeGreaterThan(40);

    const imported = await importPublicKey(pubB64);
    expect(imported).toBeDefined();
    expect(imported.algorithm.name).toBe("ECDH");
  });

  it("derives the exact same symmetric key for Alice and Bob", async () => {
    // Generar claves de Alice y Bob
    const aliceKeys = await generateEphemeralKeyPair();
    const bobKeys = await generateEphemeralKeyPair();

    const alicePubB64 = await exportPublicKey(aliceKeys.publicKey);
    const bobPubB64 = await exportPublicKey(bobKeys.publicKey);

    // Intercambiar claves públicas
    const aliceImportsBob = await importPublicKey(bobPubB64);
    const bobImportsAlice = await importPublicKey(alicePubB64);

    // Derivar clave compartida
    const aliceShared = await deriveSharedKey(aliceKeys.privateKey, aliceImportsBob);
    const bobShared = await deriveSharedKey(bobKeys.privateKey, bobImportsAlice);

    expect(aliceShared).toBeDefined();
    expect(bobShared).toBeDefined();

    // Probar cifrado cruzado: Alice cifra, Bob descifra
    const message = "Hola desde el puerto de Puno!";
    const encrypted = await encryptMessage(message, aliceShared);

    expect(encrypted.ciphertext).not.toBe(message);
    expect(encrypted.nonce).toBeDefined();

    const decrypted = await decryptMessage(encrypted.ciphertext, encrypted.nonce, bobShared);
    expect(decrypted).toBe(message);

    // Bob responde, Alice descifra
    const response = "Saludos vecino, aquí junto al lago Titicaca.";
    const encryptedResponse = await encryptMessage(response, bobShared);
    const decryptedResponse = await decryptMessage(
      encryptedResponse.ciphertext,
      encryptedResponse.nonce,
      aliceShared
    );
    expect(decryptedResponse).toBe(response);
  });

  it("computes matching verification codes (SAS) regardless of participant order", async () => {
    const aliceKeys = await generateEphemeralKeyPair();
    const bobKeys = await generateEphemeralKeyPair();

    const alicePub = await exportPublicKey(aliceKeys.publicKey);
    const bobPub = await exportPublicKey(bobKeys.publicKey);

    // Código calculado por Alice y código calculado por Bob
    const aliceCode = await computeVerificationCode(alicePub, bobPub);
    const bobCode = await computeVerificationCode(bobPub, alicePub);

    expect(aliceCode).toBe(bobCode);
    expect(aliceCode).toMatch(/^\d{4} - \d{4}$/);
  });

  it("fails to decrypt when ciphertext or nonce is altered", async () => {
    const aliceKeys = await generateEphemeralKeyPair();
    const bobKeys = await generateEphemeralKeyPair();

    const bobPub = await importPublicKey(await exportPublicKey(bobKeys.publicKey));
    const aliceShared = await deriveSharedKey(aliceKeys.privateKey, bobPub);

    const { ciphertext, nonce } = await encryptMessage("Mensaje secreto", aliceShared);

    // Alterar el ciphertext
    const tampered = ciphertext.slice(0, -2) + (ciphertext.endsWith("A") ? "B" : "A");

    await expect(decryptMessage(tampered, nonce, aliceShared)).rejects.toThrow();
  });
});
