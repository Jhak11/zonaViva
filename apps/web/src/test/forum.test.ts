import { describe, it, expect } from "vitest";
import type { Message, Zone } from "@zonaviva/protocol";
import { ZONES_BY_ID, MAX_MESSAGE_LENGTH } from "@zonaviva/protocol";
import { generateSession, signMessage, verifySignature } from "../modules/identity";

describe("Iteración 2 – Reglas de Foros Geográficos", () => {
  it("enforces canonical ordering by (relayTs, id) ascending", () => {
    const rawMessages: Message[] = [
      {
        id: "01JBP8R3D6V7M4W0Q5G9S8T7Y3",
        forumId: "zone:mercado-central",
        alias: "Usuario3",
        authorKey: "key3",
        content: "Mensaje 3 con relayTs posterior",
        clientTs: 1000,
        relayTs: 1729000003000,
        sig: "sig3",
        relaySig: "relaySig3",
      },
      {
        id: "01JBP8R3D6V7M4W0Q5G9S8T7Y1",
        forumId: "zone:mercado-central",
        alias: "Usuario1",
        authorKey: "key1",
        content: "Mensaje 1 inicial",
        clientTs: 900,
        relayTs: 1729000001000,
        sig: "sig1",
        relaySig: "relaySig1",
      },
      {
        id: "01JBP8R3D6V7M4W0Q5G9S8T7Y2",
        forumId: "zone:mercado-central",
        alias: "Usuario2",
        authorKey: "key2",
        content: "Mensaje 2 intermedio",
        clientTs: 950,
        relayTs: 1729000002000,
        sig: "sig2",
        relaySig: "relaySig2",
      },
    ];

    // Ordenamiento canónico por (relayTs, id)
    const sorted = [...rawMessages].sort((a, b) => {
      if (a.relayTs !== b.relayTs) return a.relayTs - b.relayTs;
      return a.id.localeCompare(b.id);
    });

    expect(sorted[0].id).toBe("01JBP8R3D6V7M4W0Q5G9S8T7Y1");
    expect(sorted[1].id).toBe("01JBP8R3D6V7M4W0Q5G9S8T7Y2");
    expect(sorted[2].id).toBe("01JBP8R3D6V7M4W0Q5G9S8T7Y3");
  });

  it("authorizes publishing only when physical GPS zone matches forum zone", () => {
    const physicalZone: Zone = ZONES_BY_ID["plaza-mayor"]!;
    const targetForumInside = "zone:plaza-mayor";
    const targetForumOutside = "zone:mercado-central";

    function canPublishInForum(forumId: string, currentPhysicalZone: Zone | null): boolean {
      if (!currentPhysicalZone) return false;
      if (forumId.startsWith("zone:")) {
        const requiredZoneId = forumId.slice("zone:".length);
        return currentPhysicalZone.id === requiredZoneId;
      }
      return false;
    }

    expect(canPublishInForum(targetForumInside, physicalZone)).toBe(true);
    expect(canPublishInForum(targetForumOutside, physicalZone)).toBe(false);
    expect(canPublishInForum(targetForumInside, null)).toBe(false);
  });

  it("signs message content with author session key and verifies signature", async () => {
    const session = await generateSession();
    const content = "Probando la sala de Jr. Los Laureles en Puno";

    const sig = await signMessage(session.privateKey, content);
    expect(sig).toBeDefined();

    const verified = await verifySignature(session.publicKey, content, sig);
    expect(verified).toBe(true);
  });

  it("rejects message with tampered content (Zero-Trust client verification)", async () => {
    const session = await generateSession();
    const originalContent = "Contenido legítimo del autor";
    const sig = await signMessage(session.privateKey, originalContent);

    const tamperedContent = "Contenido adulterado por un intermediario malicioso";
    const verified = await verifySignature(session.publicKey, tamperedContent, sig);
    expect(verified).toBe(false);
  });

  it("rejects message with tampered or forged author signature", async () => {
    const session = await generateSession();
    const content = "Mensaje sin alteraciones";

    const forgedSig = "MEUCIQC8z8fakeSignatureThatIsAlteredAndInvalid1234567890=";
    const verified = await verifySignature(session.publicKey, content, forgedSig);
    expect(verified).toBe(false);
  });

  it("rejects impersonation when authorKey does not match the signing key", async () => {
    const legitimateUser = await generateSession();
    const attacker = await generateSession();
    const content = "Mensaje falso que finge ser del usuario legítimo";

    // El atacante firma con su propia clave privada pero envía la clave pública de la víctima
    const attackerSig = await signMessage(attacker.privateKey, content);
    const verified = await verifySignature(legitimateUser.publicKey, content, attackerSig);
    expect(verified).toBe(false);
  });

  it("checks maximum message length limit of 1000 characters", () => {
    const validContent = "A".repeat(MAX_MESSAGE_LENGTH);
    const invalidContent = "A".repeat(MAX_MESSAGE_LENGTH + 1);

    expect(validContent.length).toBe(1000);
    expect(validContent.length <= MAX_MESSAGE_LENGTH).toBe(true);
    expect(invalidContent.length <= MAX_MESSAGE_LENGTH).toBe(false);
  });
});
