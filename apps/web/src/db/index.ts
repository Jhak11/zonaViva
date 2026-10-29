// ──────────────────────────────────────────────────────────────────────
//  Base de datos local IndexedDB con Dexie (apps/web/src/db/index.ts)
//  El contenido vive en los dispositivos de los usuarios.
// ──────────────────────────────────────────────────────────────────────
import Dexie, { type Table } from "dexie";
import type { Message, Forum, OutboxMessage } from "@zonaviva/protocol";

export class ZonaVivaDatabase extends Dexie {
  messages!: Table<Message, string>;
  forums!: Table<Forum, string>;
  outbox!: Table<OutboxMessage, string>;

  constructor() {
    super("ZonaVivaDB");
    this.version(1).stores({
      // Clave primaria: id. Índices: forumId, relayTs, índice compuesto [forumId+relayTs]
      messages: "&id, forumId, relayTs, [forumId+relayTs]",
      forums: "&id, type, name, lastSyncRelayTs, lastContactAt",
      outbox: "&id, forumId, clientTs",
    });
  }
}

export const db = new ZonaVivaDatabase();
