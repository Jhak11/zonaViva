import { describe, it, expect } from "vitest";
import {
  MsgPayloadSchema,
  AliasSchema,
  RegisterForumSchema,
  QueueChatSchema,
  MAX_MESSAGE_LENGTH,
} from "@zonaviva/protocol";

describe("Protocol Validation Schemas", () => {
  it("validates valid alias", () => {
    const valid = AliasSchema.safeParse("VicuñaVeloz123");
    expect(valid.success).toBe(true);
  });

  it("rejects empty alias or too long alias", () => {
    expect(AliasSchema.safeParse("").success).toBe(false);
    expect(AliasSchema.safeParse("a".repeat(50)).success).toBe(false);
  });

  it("validates forum message payload correctly", () => {
    const msg = {
      id: "01JBP8R3D6V7M4W0Q5G9S8T7Y1",
      forumId: "zone:puno-centro",
      alias: "CóndorAndino456",
      authorKey: "base64publicKeyDataSample",
      content: "Buenas tardes a todos en la Plaza de Armas de Puno.",
      clientTs: 1729000000000,
      sig: "base64signature",
    };

    const parsed = MsgPayloadSchema.safeParse(msg);
    expect(parsed.success).toBe(true);
  });

  it("rejects messages exceeding MAX_MESSAGE_LENGTH", () => {
    const msg = {
      id: "01JBP8R3D6V7M4W0Q5G9S8T7Y1",
      forumId: "zone:puno-centro",
      alias: "CóndorAndino456",
      authorKey: "base64publicKeyDataSample",
      content: "A".repeat(MAX_MESSAGE_LENGTH + 1),
      clientTs: 1729000000000,
      sig: "base64signature",
    };

    const parsed = MsgPayloadSchema.safeParse(msg);
    expect(parsed.success).toBe(false);
  });

  it("validates forum registration schema with geohash", () => {
    const forum = {
      id: "user:123e4567-e89b-12d3-a456-426614174000",
      name: "Vecinos Jirón Lima",
      geohash: "6m7h2b", // 6 chars
      createdAt: 1729000000000,
    };
    expect(RegisterForumSchema.safeParse(forum).success).toBe(true);
  });

  it("validates queue chat schema", () => {
    const queue = {
      zoneId: "puno-centro",
      ephemeralPublicKey: "ephemeralKeyBase64String",
    };
    expect(QueueChatSchema.safeParse(queue).success).toBe(true);
  });
});
