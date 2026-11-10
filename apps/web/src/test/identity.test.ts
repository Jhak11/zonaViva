import { describe, it, expect } from "vitest";
import "fake-indexeddb/auto";
import {
  generateAlias,
  generateSession,
  importSession,
  signMessage,
  verifySignature,
} from "../modules/identity";

if (typeof localStorage === "undefined") {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, String(v)),
    removeItem: (k: string) => store.delete(k),
    clear: () => store.clear(),
  };
}

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

  it("generates distinct public keys and distinct suffixes on renewal", async () => {
    const s1 = await generateSession();
    const s2 = await generateSession();

    expect(s1.publicKey).not.toBe(s2.publicKey);
    expect(s1.privateKey).not.toBe(s2.privateKey);
    // Verificar que los últimos 10 caracteres (la porción no ASN.1) son distintos
    expect(s1.publicKey.slice(-10)).not.toBe(s2.publicKey.slice(-10));
  });

  describe("Seguridad XSS y Almacenamiento Protegido de Claves", () => {
    it("nunca almacena la clave privada en localStorage tras completar onboarding", async () => {
      const { useIdentityStore } = await import("@/stores/identityStore");
      const { getSecureKey } = await import("@/db/storage");

      localStorage.clear();
      await useIdentityStore.getState().completeOnboarding("UsuarioSeguro123");

      const rawLocalStorage = localStorage.getItem("zonaviva:session");
      expect(rawLocalStorage).not.toBeNull();
      const parsed = JSON.parse(rawLocalStorage!);

      // En localStorage NO debe existir la clave privada
      expect(parsed.privateKey).toBeUndefined();
      expect(parsed.publicKey).toBeDefined();
      expect(parsed.alias).toBe("UsuarioSeguro123");

      // La clave privada debe estar guardada en IndexedDB seguro
      const privKeyInDb = await getSecureKey<string>("identity_private_key");
      expect(privKeyInDb).toBeDefined();
      expect(privKeyInDb).toBe(useIdentityStore.getState().session?.privateKey);
    });

    it("migra automáticamente claves legadas de localStorage hacia IndexedDB", async () => {
      const { useIdentityStore } = await import("@/stores/identityStore");
      const { getSecureKey, removeSecureKey } = await import("@/db/storage");

      await removeSecureKey("identity_private_key");
      localStorage.clear();

      const legacySession = await generateSession("UsuarioMigrado");
      // Simulamos que el usuario tenía la sesión antigua con privateKey en localStorage
      localStorage.setItem("zonaviva:session", JSON.stringify(legacySession));
      localStorage.setItem("zonaviva:onboarding_completed", "true");

      // Al inicializar la sesión
      await useIdentityStore.getState().initSession();

      // Debe haberse migrado la clave privada a IndexedDB
      const migratedPriv = await getSecureKey<string>("identity_private_key");
      expect(migratedPriv).toBe(legacySession.privateKey);

      // Y en localStorage la clave privada debe haberse purgado
      const updatedLocalStorage = JSON.parse(localStorage.getItem("zonaviva:session")!);
      expect(updatedLocalStorage.privateKey).toBeUndefined();
      expect(updatedLocalStorage.publicKey).toBe(legacySession.publicKey);
    });

    it("el par de claves persistente E2EE no expone su clave privada en localStorage", async () => {
      const { getOrCreatePersistentE2EEKeyPair, resetPersistentE2EEKeyPair } = await import("@/modules/e2ee");
      const { getSecureKey } = await import("@/db/storage");

      resetPersistentE2EEKeyPair();

      const keyPair = await getOrCreatePersistentE2EEKeyPair();
      expect(keyPair.publicKey).toBeDefined();
      expect(keyPair.privateKey).toBeDefined();

      // localStorage NO debe contener la clave
      expect(localStorage.getItem("zonaviva:direct_e2ee_keypair")).toBeNull();

      // IndexedDB sí debe contener el registro protegido
      const secureStored = await getSecureKey<{ publicKey: string; privateKey: string }>("direct_e2ee_keypair");
      expect(secureStored).not.toBeNull();
      expect(secureStored?.privateKey).toBe(keyPair.privateKey);
    });
  });
});
