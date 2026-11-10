import { z } from "zod";
import {
  MAX_MESSAGE_LENGTH,
  MAX_ALIAS_LENGTH,
  MAX_FORUM_NAME_LENGTH,
  MAX_FORUM_DESCRIPTION_LENGTH,
  MIN_FORUM_RADIUS,
  MAX_FORUM_RADIUS,
  MAX_USER_FORUMS_PER_CLIENT,
  MAX_INTRO_MESSAGE_LENGTH,
} from "./constants.js";

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

export const PeerSyncRequestSchema = z.object({
  requestId: z.string().min(1).max(64),
  forumId: z.string().min(1).max(128),
  since: z.number().int().min(0),
});

export const PeerSyncResponseSchema = z.object({
  requestId: z.string().min(1).max(64),
  forumId: z.string().min(1).max(128),
  messages: z.array(MessageSchema),
  hasMore: z.boolean(),
});

// ── Foros ─────────────────────────────────────────────────────────────

export const JoinForumSchema = z.object({
  forumId: z.string().min(1).max(128),
});

// ── Foros Temporales de Usuario (Iteración 5) ─────────────────────────

export const CreateTemporaryForumSchema = z.object({
  id: z.string().startsWith("user:").min(6).max(128),
  name: z.string().min(3).max(MAX_FORUM_NAME_LENGTH),
  description: z.string().max(MAX_FORUM_DESCRIPTION_LENGTH).default(""),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radius: z.number().min(MIN_FORUM_RADIUS).max(MAX_FORUM_RADIUS),
  createdAt: z.number().int().positive(),
  creatorKey: z.string().min(1).max(512),
});

export const TemporaryForumSchema = CreateTemporaryForumSchema.extend({
  type: z.literal("user"),
  participantCount: z.number().int().nonnegative().optional(),
});

export const AnnounceUserForumsSchema = z.object({
  forums: z.array(TemporaryForumSchema).max(MAX_USER_FORUMS_PER_CLIENT),
});

export const LeaveUserForumPermanentlySchema = z.object({
  forumId: z.string().startsWith("user:").min(6).max(128),
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

export const CancelQueueSchema = z.object({
  zoneId: z.string().min(1).max(128).optional(),
});

// ── Zonas ─────────────────────────────────────────────────────────────

export const ZoneSchema = z.object({
  id: z.string().min(3).max(64),
  name: z.string().min(1).max(128),
  description: z.string().max(256),
  type: z.literal("permanent"),
  cells: z.array(z.string().length(7)),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

// ── Pares Permanentes y Solicitudes Directas ─────────────────────────

export const RegisterIdentitySchema = z.object({
  publicKey: z.string().min(1).max(512),
  alias: AliasSchema,
});

export const SendDirectRequestSchema = z.object({
  id: z.string().min(1).max(64),
  fromPublicKey: z.string().min(1).max(512),
  fromAlias: AliasSchema,
  toPublicKey: z.string().min(1).max(512),
  introMessage: z.string().max(MAX_INTRO_MESSAGE_LENGTH).optional(),
  sourceForumName: z.string().max(MAX_FORUM_NAME_LENGTH).optional(),
  e2eePublicKey: z.string().min(1).max(512),
  createdAt: z.number().int().positive(),
});

export const RespondDirectRequestSchema = z.object({
  requestId: z.string().min(1).max(64),
  action: z.enum(["accept", "reject"]),
  fromPublicKey: z.string().min(1).max(512),
  toPublicKey: z.string().min(1).max(512),
  peerAlias: AliasSchema.optional(),
  e2eePublicKey: z.string().min(1).max(512).optional(),
});

export const CancelDirectRequestSchema = z.object({
  requestId: z.string().min(1).max(64),
  toPublicKey: z.string().min(1).max(512),
});

export const DirectMsgSchema = z.object({
  id: z.string().min(1).max(64),
  channelId: z.string().min(1).max(512),
  toPublicKey: z.string().min(1).max(512),
  fromPublicKey: z.string().min(1).max(512),
  fromAlias: AliasSchema,
  ciphertext: z.string().min(1),
  nonce: z.string().min(1).max(64),
  clientTs: z.number().int().positive(),
});

export const DeleteDirectPeerSchema = z.object({
  fromPublicKey: z.string().min(1).max(512),
  toPublicKey: z.string().min(1).max(512),
});

