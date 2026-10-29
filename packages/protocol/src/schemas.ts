import { z } from "zod";
import { MAX_MESSAGE_LENGTH, MAX_ALIAS_LENGTH, MAX_FORUM_NAME_LENGTH } from "./constants.js";

// ──────────────────────────────────────────────────────────────────────
//  Esquemas Zod compartidos – validación en cliente y relay
// ──────────────────────────────────────────────────────────────────────

export const LatLngSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const AliasSchema = z
  .string()
  .min(1)
  .max(MAX_ALIAS_LENGTH)
  .regex(/^[\w\-. áéíóúüñÁÉÍÓÚÜÑ]+$/u, "Alias contiene caracteres no permitidos");

// ── Mensajes ──────────────────────────────────────────────────────────

export const MsgPayloadSchema = z.object({
  id: z.string().min(1).max(64),
  forumId: z.string().min(1).max(128),
  alias: AliasSchema,
  authorKey: z.string().min(1).max(512),
  content: z.string().min(1).max(MAX_MESSAGE_LENGTH),
  clientTs: z.number().int().positive(),
  sig: z.string().min(1).max(512),
});

export const MsgSealedSchema = MsgPayloadSchema.extend({
  relayTs: z.number().int().positive(),
  relaySig: z.string().min(1).max(512),
});

export const MessageSchema = MsgSealedSchema;

// ── Sincronización ────────────────────────────────────────────────────

export const SyncRequestSchema = z.object({
  forumId: z.string().min(1).max(128),
  since: z.number().int().min(0),
});

export const SyncChunkSchema = z.object({
  forumId: z.string().min(1).max(128),
  messages: z.array(MessageSchema),
  hasMore: z.boolean(),
});

// ── Foros ─────────────────────────────────────────────────────────────

export const JoinForumSchema = z.object({
  forumId: z.string().min(1).max(128),
});

export const RegisterForumSchema = z.object({
  id: z.string().min(1).max(128),
  name: z.string().min(1).max(MAX_FORUM_NAME_LENGTH),
  geohash: z.string().length(5).or(z.string().length(6)),
  createdAt: z.number().int().positive(),
});

export const ListForumsSchema = z.object({
  geohash: z.string().min(4).max(7),
});

// ── Chat aleatorio ────────────────────────────────────────────────────

export const QueueChatSchema = z.object({
  zoneId: z.string().min(1).max(128),
  ephemeralPublicKey: z.string().min(1).max(512),
});

export const ChatMsgSchema = z.object({
  roomId: z.string().min(1).max(128),
  ciphertext: z.string().min(1),
  nonce: z.string().min(1).max(64),
});

export const LeaveChatSchema = z.object({
  roomId: z.string().min(1).max(128),
});
