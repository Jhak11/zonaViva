import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { db } from "../db/index";
import {
  saveMessages,
  getForumMessages,
  getMessagesSince,
  addOutboxMessage,
  getOutboxMessages,
  removeOutboxMessage,
  ensureForumRecord,
  clearAllLocalData,
  mergeMessageLists,
  RETENTION_MS,
  pruneOldMessages,
} from "../db/storage";
import type { Message, OutboxMessage } from "@zonaviva/protocol";
import { verifyRelaySeal } from "../modules/relayCrypto";

function makeMsg(partial: Partial<Message> & Pick<Message, "id" | "forumId" | "content">): Message {
  const now = Date.now();
  return {
    alias: "Andes",
    authorKey: "key",
    clientTs: now,
    relayTs: now,
    sig: "sig",
    relaySig: "rsig",
    ...partial,
  };
}

describe("Iteración 3 – Almacenamiento Local (IndexedDB) y Sincronización", () => {
  beforeEach(async () => {
    await clearAllLocalData();
  });

  it("stores and retrieves forum messages ordered by relayTs", async () => {
    const forumId = "zone:mercado-central";
    await ensureForumRecord(forumId, "Jirón Los Laureles");
    const now = Date.now();

    const m1: Message = {
      id: "01JBP8R3D6V7M4W0Q5G9S8T7Y1",
      forumId,
      alias: "Andes1",
      authorKey: "key1",
      content: "Primer mensaje",
      clientTs: now - 20,
      relayTs: now - 20,
      sig: "sig1",
      relaySig: "relaySig1",
    };

    const m2: Message = {
      id: "01JBP8R3D6V7M4W0Q5G9S8T7Y2",
      forumId,
      alias: "Andes2",
      authorKey: "key2",
      content: "Segundo mensaje",
      clientTs: now - 10,
      relayTs: now - 10,
      sig: "sig2",
      relaySig: "relaySig2",
    };

    // Guardar en orden inverso
    await saveMessages([m2, m1]);

    const retrieved = await getForumMessages(forumId);
    expect(retrieved.length).toBe(2);
    expect(retrieved[0].id).toBe(m1.id);
    expect(retrieved[1].id).toBe(m2.id);
  });

  it("deduplicates messages upon repeated saves", async () => {
    const forumId = "zone:plaza-mayor";
    const msg: Message = {
      id: "01JBP8R3D6V7M4W0Q5G9S8T7Y1",
      forumId,
      alias: "Andes1",
      authorKey: "key1",
      content: "Mensaje único",
      clientTs: Date.now(),
      relayTs: Date.now(),
      sig: "sig1",
      relaySig: "relaySig1",
    };

    await saveMessages([msg]);
    await saveMessages([msg]); // Duplicado

    const count = await db.messages.count();
    expect(count).toBe(1);
  });

  it("answers peer sync queries (getMessagesSince) correctly", async () => {
    const forumId = "zone:unap-campus";
    const base = Date.now() - 1_000;
    const messages: Message[] = [
      {
        id: "msg-1",
        forumId,
        alias: "User1",
        authorKey: "k1",
        content: "Antiguo",
        clientTs: base,
        relayTs: base,
        sig: "s1",
        relaySig: "rs1",
      },
      {
        id: "msg-2",
        forumId,
        alias: "User2",
        authorKey: "k2",
        content: "Medio",
        clientTs: base + 100,
        relayTs: base + 100,
        sig: "s2",
        relaySig: "rs2",
      },
      {
        id: "msg-3",
        forumId,
        alias: "User3",
        authorKey: "k3",
        content: "Reciente",
        clientTs: base + 200,
        relayTs: base + 200,
        sig: "s3",
        relaySig: "rs3",
      },
    ];

    await saveMessages(messages);

    const sinceMid = await getMessagesSince(forumId, base + 50);
    expect(sinceMid.length).toBe(2);
    expect(sinceMid[0].id).toBe("msg-2");
    expect(sinceMid[1].id).toBe("msg-3");

    const sinceLast = await getMessagesSince(forumId, base + 200);
    expect(sinceLast.length).toBe(0);
  });

  it("merges forked histories without duplicates and in canonical order", () => {
    const forumId = "zone:mercado-central";
    const now = Date.now();
    const older = Array.from({ length: 5 }, (_, i) =>
      makeMsg({
        id: `old-${String(i + 1).padStart(3, "0")}`,
        forumId,
        content: `m${i + 1}`,
        relayTs: now - 500 + i,
      })
    );
    const newer = Array.from({ length: 3 }, (_, i) =>
      makeMsg({
        id: `new-${String(i + 101).padStart(3, "0")}`,
        forumId,
        content: `m${i + 101}`,
        relayTs: now - 200 + i,
      })
    );
    const overlap = [older[4], newer[0]];
    const merged = mergeMessageLists(older, [...newer, ...overlap]);
    expect(merged.map((m) => m.id)).toEqual([
      "old-001",
      "old-002",
      "old-003",
      "old-004",
      "old-005",
      "new-101",
      "new-102",
      "new-103",
    ]);
  });

  it("discards messages older than 3 days and does not serve them on sync", async () => {
    const forumId = "zone:plaza-mayor";
    const expired = makeMsg({
      id: "expired-1",
      forumId,
      content: "viejo",
      relayTs: Date.now() - RETENTION_MS - 5_000,
    });
    const fresh = makeMsg({
      id: "fresh-1",
      forumId,
      content: "nuevo",
      relayTs: Date.now() - 1_000,
    });

    await saveMessages([expired, fresh]);
    const stored = await getForumMessages(forumId);
    expect(stored.map((m) => m.id)).toEqual(["fresh-1"]);

    await db.messages.put(expired);
    await pruneOldMessages(forumId);
    const afterPrune = await getForumMessages(forumId);
    expect(afterPrune.map((m) => m.id)).toEqual(["fresh-1"]);

    const served = await getMessagesSince(forumId, 0);
    expect(served.every((m) => m.relayTs >= Date.now() - RETENTION_MS)).toBe(true);
    expect(served.map((m) => m.id)).toEqual(["fresh-1"]);
  });

  it("manages offline outbox queue properly", async () => {
    const outboxItem: OutboxMessage = {
      id: "out-1",
      forumId: "zone:mercado-central",
      content: "Mensaje redactado sin conexión",
      clientTs: Date.now(),
      retries: 0,
    };

    await addOutboxMessage(outboxItem);

    const pending = await getOutboxMessages("zone:mercado-central");
    expect(pending.length).toBe(1);
    expect(pending[0].content).toBe(outboxItem.content);

    // Al enviarse y confirmarse por el relay, se remueve
    await removeOutboxMessage("out-1");
    const emptyPending = await getOutboxMessages("zone:mercado-central");
    expect(emptyPending.length).toBe(0);
  });

  it("discards messages with empty or invalid relay seals", async () => {
    const msgWithoutSeal = {
      id: "01JBP8R3D6V7M4W0Q5G9S8T7Y1",
      forumId: "zone:plaza-mayor",
      relayTs: 1000,
      content: "Mensaje sin sello legítimo",
      relaySig: "",
    };

    const isValid = await verifyRelaySeal("somePublicKey", msgWithoutSeal);
    expect(isValid).toBe(false);
  });

  it("successfully verifies both IEEE P1363 and DER relay signatures", async () => {
    const nodeCrypto = await import("node:crypto");
    const kp = nodeCrypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    const pubSpkiB64 = kp.publicKey.export({ type: "spki", format: "der" }).toString("base64url");

    const msg = {
      id: "01JBP8R3D6V7M4W0Q5G9S8T7Y1",
      forumId: "zone:plaza-mayor",
      relayTs: 1730000000000,
      content: "Mensaje sellado legítimamente",
    };

    const contentHash = nodeCrypto.createHash("sha256").update(msg.content).digest("hex");
    const payloadToSign = `${msg.id}:${msg.forumId}:${msg.relayTs}:${contentHash}`;

    // 1. Firma en formato IEEE P1363 (estándar relay nuevo)
    const p1363Sig = nodeCrypto
      .createSign("SHA256")
      .update(payloadToSign)
      .sign({ key: kp.privateKey, dsaEncoding: "ieee-p1363" }, "base64url");

    const isP1363Valid = await verifyRelaySeal(pubSpkiB64, { ...msg, relaySig: p1363Sig });
    expect(isP1363Valid).toBe(true);

    // 2. Firma en formato DER (estándar legacy o fallback)
    const derSig = nodeCrypto
      .createSign("SHA256")
      .update(payloadToSign)
      .sign(kp.privateKey, "base64url");

    const isDerValid = await verifyRelaySeal(pubSpkiB64, { ...msg, relaySig: derSig });
    expect(isDerValid).toBe(true);
  });

  it("mensajes sellados antes de un reinicio siguen siendo válidos tras reiniciar el relay con la misma clave persistente", async () => {
    const nodeCrypto = await import("node:crypto");
    // Simulamos la clave persistente que se define en RELAY_PRIVATE_KEY_PEM
    const masterKeyPair = nodeCrypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    const masterPem = masterKeyPair.privateKey.export({ type: "pkcs8", format: "pem" }) as string;

    // "Sesión 1 del Relay": Carga la clave desde el PEM y sella un mensaje
    const relay1Priv = nodeCrypto.createPrivateKey(masterPem);
    const relay1Pub = nodeCrypto.createPublicKey(relay1Priv);
    const relay1PubB64 = relay1Pub.export({ type: "spki", format: "der" }).toString("base64url");

    const msg = {
      id: "01JBP8R3D6V7M4W0Q5G9S8T7Y1",
      forumId: "zone:plaza-mayor",
      relayTs: 1730000000000,
      content: "Mensaje emitido en la sesión 1 del servidor",
    };

    const contentHash = nodeCrypto.createHash("sha256").update(msg.content).digest("hex");
    const payloadToSign = `${msg.id}:${msg.forumId}:${msg.relayTs}:${contentHash}`;
    const sig1 = nodeCrypto
      .createSign("SHA256")
      .update(payloadToSign)
      .sign({ key: relay1Priv, dsaEncoding: "ieee-p1363" }, "base64url");

    const sealedMsg = { ...msg, relaySig: sig1 };

    // Verificamos que el cliente valida con el relay 1
    expect(await verifyRelaySeal(relay1PubB64, sealedMsg)).toBe(true);

    // "REINICIO DEL SERVIDOR RELAY": Se destruye la instancia 1 y se crea la instancia 2 cargando el mismo PEM
    const relay2Priv = nodeCrypto.createPrivateKey(masterPem);
    const relay2Pub = nodeCrypto.createPublicKey(relay2Priv);
    const relay2PubB64 = relay2Pub.export({ type: "spki", format: "der" }).toString("base64url");

    // Ambos relays tienen la misma clave pública
    expect(relay2PubB64).toBe(relay1PubB64);

    // El cliente nuevo o reconectado en la sesión 2 valida el mensaje histórico de la sesión 1:
    const isValidAfterRestart = await verifyRelaySeal(relay2PubB64, sealedMsg);
    expect(isValidAfterRestart).toBe(true);
  });
});
