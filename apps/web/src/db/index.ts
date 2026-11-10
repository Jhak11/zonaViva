// ──────────────────────────────────────────────────────────────────────
//  Base de datos local IndexedDB con Dexie (apps/web/src/db/index.ts)
//  El contenido vive en los dispositivos de los usuarios.
// ──────────────────────────────────────────────────────────────────────
import Dexie, { type Table } from "dexie";
import type {
  Message,
  Forum,
  OutboxMessage,
  DirectPeer,
  DirectRequest,
  DirectMessage,
} from "@zonaviva/protocol";

export interface SecureKeyRecord {
  id: string;
  keyData: any;
  createdAt: number;
}

export class ZonaVivaDatabase extends Dexie {
  messages!: Table<Message, string>;
  forums!: Table<Forum, string>;
  outbox!: Table<OutboxMessage, string>;
  directPeers!: Table<DirectPeer, string>;
  directRequests!: Table<DirectRequest, string>;
  directMessages!: Table<DirectMessage, string>;
  secureKeys!: Table<SecureKeyRecord, string>;

  constructor() {
    super("ZonaVivaDB");
    this.version(1).stores({
      // Clave primaria: id. Índices: forumId, relayTs, índice compuesto [forumId+relayTs]
      messages: "&id, forumId, relayTs, [forumId+relayTs]",
      forums: "&id, type, name, lastSyncRelayTs, lastContactAt",
      outbox: "&id, forumId, clientTs",
    });

    this.version(2).stores({
      messages: "&id, forumId, relayTs, [forumId+relayTs]",
      forums: "&id, type, name, isParticipant, lastSyncRelayTs, lastReadRelayTs, lastContactAt",
      outbox: "&id, forumId, clientTs",
    });

    this.version(3).stores({
      messages: "&id, forumId, relayTs, [forumId+relayTs]",
      forums: "&id, type, name, isParticipant, lastSyncRelayTs, lastReadRelayTs, lastContactAt",
      outbox: "&id, forumId, clientTs",
      directPeers: "&peerPublicKey, alias, channelId, lastInteractionTs",
      directRequests: "&id, peerPublicKey, status, direction, createdAt, cooldownUntil",
      directMessages: "&id, channelId, clientTs, [channelId+clientTs], fromPublicKey",
    });

    this.version(4).stores({
      messages: "&id, forumId, relayTs, [forumId+relayTs]",
      forums: "&id, type, name, isParticipant, lastSyncRelayTs, lastReadRelayTs, lastContactAt",
      outbox: "&id, forumId, clientTs",
      directPeers: "&peerPublicKey, alias, channelId, lastInteractionTs",
      directRequests: "&id, peerPublicKey, status, direction, createdAt, cooldownUntil",
      directMessages: "&id, channelId, clientTs, [channelId+clientTs], fromPublicKey",
      secureKeys: "&id",
    });
  }
}

export const db = new ZonaVivaDatabase();
