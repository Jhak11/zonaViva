import { describe, it, expect } from "vitest";
import {
  generateAlias,
  generateSession,
  importSession,
  signMessage,
  verifySignature,
} from "../modules/identity";

describe("Identity Module", () => {
  it("generates a friendly Spanish alias", () => {
    const alias = generateAlias();
    expect(alias).toBeDefined();
    expect(alias.length).toBeGreaterThan(4);
    // Should end with digits
    expect(/\d+$/.test(alias)).toBe(true);
  });

  it("generates a valid ECDSA P-256 session and imports it", async () => {
    const session = await generateSession();
    expect(session.alias).toBeDefined();
    expect(session.publicKey).toBeDefined();
    expect(session.privateKey).toBeDefined();
    expect(session.createdAt).toBeGreaterThan(0);

    // Verify session can be imported without throwing
    const imported = await importSession(session);
    expect(imported.publicKey).toBe(session.publicKey);
  });

  it("signs a message and verifies the signature successfully", async () => {
    const session = await generateSession();
    const payload = JSON.stringify({ text: "¡Hola desde la Plaza de Puno!", ts: Date.now() });

    const signature = await signMessage(session.privateKey, payload);
    expect(signature).toBeDefined();
    expect(signature.length).toBeGreaterThan(10);

    const isValid = await verifySignature(session.publicKey, payload, signature);
    expect(isValid).toBe(true);
  });

  it("rejects altered messages or invalid signatures", async () => {
    const session = await generateSession();
    const payload = "Mensaje original";
    const signature = await signMessage(session.privateKey, payload);

    // Tampered payload
    const isValidTampered = await verifySignature(
      session.publicKey,
      "Mensaje alterado",
      signature
    );
    expect(isValidTampered).toBe(false);

    // Different session public key
    const otherSession = await generateSession();
    const isValidOtherKey = await verifySignature(
      otherSession.publicKey,
      payload,
      signature
    );
    expect(isValidOtherKey).toBe(false);
  });
});
