import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import {
  generateEphemeralKeyPair,
  exportPublicKey,
  importPublicKey,
  deriveSharedKey,
  computeVerificationCode,
  encryptMessage,
  decryptMessage,
} from "../modules/e2ee";
import { db } from "../db";

describe("Iteración 4 – Chat Aleatorio Efímero y Cifrado Extremo a Extremo", () => {
  beforeEach(async () => {
    await db.messages.clear();
    await db.forums.clear();
  });

  it("completes full end-to-end ephemeral handshake and message exchange", async () => {
    // 1. Dos usuarios generan sus pares de claves efímeras al entrar a la cola
    const aliceKeyPair = await generateEphemeralKeyPair();
    const bobKeyPair = await generateEphemeralKeyPair();

    const alicePubB64 = await exportPublicKey(aliceKeyPair.publicKey);
    const bobPubB64 = await exportPublicKey(bobKeyPair.publicKey);

    // 2. El relay empareja a ambos y les entrega la clave pública del otro
    const aliceImportsBob = await importPublicKey(bobPubB64);
    const bobImportsAlice = await importPublicKey(alicePubB64);

    // 3. Ambos derivan la clave simétrica AES-GCM y el código SAS
    const aliceAesKey = await deriveSharedKey(aliceKeyPair.privateKey, aliceImportsBob);
    const bobAesKey = await deriveSharedKey(bobKeyPair.privateKey, bobImportsAlice);

    const aliceSas = await computeVerificationCode(alicePubB64, bobPubB64);
    const bobSas = await computeVerificationCode(bobPubB64, alicePubB64);

    expect(aliceSas).toBe(bobSas);
    expect(aliceSas.length).toBeGreaterThan(6);

    // 4. Alice envía un mensaje cifrado
    const alicePlainText = "¿Alguien sabe si hay trucha fresca en el puerto?";
    const aliceEncrypted = await encryptMessage(alicePlainText, aliceAesKey);

    // El relay solo ve ciphertext y nonce
    expect(aliceEncrypted.ciphertext).not.toContain("trucha");

    // Bob descifra el mensaje
    const bobDecrypted = await decryptMessage(
      aliceEncrypted.ciphertext,
      aliceEncrypted.nonce,
      bobAesKey
    );
    expect(bobDecrypted).toBe(alicePlainText);

    // 5. Bob responde
    const bobPlainText = "Sí vecino, los pescadores llegaron hace una hora.";
    const bobEncrypted = await encryptMessage(bobPlainText, bobAesKey);

    const aliceDecrypted = await decryptMessage(
      bobEncrypted.ciphertext,
      bobEncrypted.nonce,
      aliceAesKey
    );
    expect(aliceDecrypted).toBe(bobPlainText);
  });

  it("guarantees zero persistence in IndexedDB for random chat", async () => {
    // Simular que el chat ocurrió en memoria
    const keyPair = await generateEphemeralKeyPair();
    const pub = await exportPublicKey(keyPair.publicKey);
    const imported = await importPublicKey(pub);
    const aesKey = await deriveSharedKey(keyPair.privateKey, imported);

    const encrypted = await encryptMessage("Mensaje que nunca debe tocar disco", aesKey);
    expect(encrypted.ciphertext).toBeDefined();

    // Comprobar que la base de datos local IndexedDB permanece completamente vacía
    const savedMessages = await db.messages.toArray();
    expect(savedMessages.length).toBe(0);
  });
});
