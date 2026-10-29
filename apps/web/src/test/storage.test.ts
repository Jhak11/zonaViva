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
} from "../db/storage";
import type { Message, OutboxMessage } from "@zonaviva/protocol";
import { verifyRelaySeal } from "../modules/relayCrypto";

describe("Iteración 3 – Almacenamiento Local (IndexedDB) y Sincronización", () => {
  beforeEach(async () => {
    await clearAllLocalData();
  });

  it("stores and retrieves forum messages ordered by relayTs", async () => {
    const forumId = "zone:puno-laureles";
    await ensureForumRecord(forumId, "Jirón Los Laureles");

    const m1: Message = {
      id: "01JBP8R3D6V7M4W0Q5G9S8T7Y1",
      forumId,
      alias: "Andes1",
      authorKey: "key1",
      content: "Primer mensaje",
      clientTs: 100,
      relayTs: 1000,
      sig: "sig1",
      relaySig: "relaySig1",
    };

    const m2: Message = {
      id: "01JBP8R3D6V7M4W0Q5G9S8T7Y2",
      forumId,
      alias: "Andes2",
      authorKey: "key2",
      content: "Segundo mensaje",
      clientTs: 110,
      relayTs: 2000,
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
    const forumId = "zone:puno-centro";
    const msg: Message = {
      id: "01JBP8R3D6V7M4W0Q5G9S8T7Y1",
      forumId,
      alias: "Andes1",
      authorKey: "key1",
      content: "Mensaje único",
      clientTs: 100,
      relayTs: 1000,
      sig: "sig1",
      relaySig: "relaySig1",
    };

    await saveMessages([msg]);
    await saveMessages([msg]); // Duplicado

    const count = await db.messages.count();
    expect(count).toBe(1);
  });

  it("answers peer sync queries (getMessagesSince) correctly", async () => {
    const forumId = "zone:puno-puerto";
    const messages: Message[] = [
      {
        id: "msg-1",
        forumId,
        alias: "User1",
        authorKey: "k1",
        content: "Antiguo",
        clientTs: 10,
        relayTs: 100,
        sig: "s1",
        relaySig: "rs1",
      },
      {
        id: "msg-2",
        forumId,
        alias: "User2",
        authorKey: "k2",
        content: "Medio",
        clientTs: 20,
        relayTs: 200,
        sig: "s2",
        relaySig: "rs2",
      },
      {
        id: "msg-3",
        forumId,
        alias: "User3",
        authorKey: "k3",
        content: "Reciente",
        clientTs: 30,
        relayTs: 300,
        sig: "s3",
        relaySig: "rs3",
      },
    ];

    await saveMessages(messages);

    // Solicitar mensajes posteriores a relayTs 150
    const since150 = await getMessagesSince(forumId, 150);
    expect(since150.length).toBe(2);
    expect(since150[0].id).toBe("msg-2");
    expect(since150[1].id).toBe("msg-3");

    // Solicitar mensajes posteriores a 300 (ninguno)
    const since300 = await getMessagesSince(forumId, 300);
    expect(since300.length).toBe(0);
  });

  it("manages offline outbox queue properly", async () => {
    const outboxItem: OutboxMessage = {
      id: "out-1",
      forumId: "zone:puno-laureles",
      content: "Mensaje redactado sin conexión",
      clientTs: Date.now(),
      retries: 0,
    };

    await addOutboxMessage(outboxItem);

    const pending = await getOutboxMessages("zone:puno-laureles");
    expect(pending.length).toBe(1);
    expect(pending[0].content).toBe(outboxItem.content);

    // Al enviarse y confirmarse por el relay, se remueve
    await removeOutboxMessage("out-1");
    const emptyPending = await getOutboxMessages("zone:puno-laureles");
    expect(emptyPending.length).toBe(0);
  });

  it("discards messages with empty or invalid relay seals", async () => {
    const msgWithoutSeal = {
      id: "01JBP8R3D6V7M4W0Q5G9S8T7Y1",
      forumId: "zone:puno-centro",
      relayTs: 1000,
      content: "Mensaje sin sello legítimo",
      relaySig: "",
    };

    const isValid = await verifyRelaySeal("somePublicKey", msgWithoutSeal);
    expect(isValid).toBe(false);
  });
});
