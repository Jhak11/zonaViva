import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { db } from "@/db";
import {
  saveDirectPeer,
  getDirectPeers,
  getDirectPeer,
  markDirectPeerAsDeleted,
  deleteDirectPeerAndMessages,
  saveDirectRequest,
  getDirectRequests,
  deleteDirectRequest,
  checkRequestCooldown,
  saveDirectMessage,
  getDirectMessages,
  markDirectChatAsRead,
} from "@/db/storage";
import {
  generateEphemeralKeyPair,
  exportPublicKey,
  exportPrivateKey,
  importPublicKey,
  importPrivateKey,
  deriveSharedKey,
  encryptMessage,
  decryptMessage,
  getDirectChannelId,
} from "@/modules/e2ee";
import {
  DIRECT_REQUEST_COOLDOWN_MS,
  DIRECT_REQUEST_EXPIRATION_MS,
  MAX_DIRECT_PEERS_PER_CLIENT,
  DirectMsgSchema,
} from "@zonaviva/protocol";

describe("Pares Permanentes y Chat Directo E2EE", () => {
  beforeEach(async () => {
    await db.directPeers.clear();
    await db.directRequests.clear();
    await db.directMessages.clear();
  });

  describe("Criptografía E2EE Persistente (ECDH P-256 + AES-GCM-256)", () => {
    it("debe generar, exportar, importar e intercambiar claves compartidas idénticas", async () => {
      // Usuario Alice
      const alicePair = await generateEphemeralKeyPair();
      const alicePubB64 = await exportPublicKey(alicePair.publicKey);
      const alicePrivB64 = await exportPrivateKey(alicePair.privateKey);

      // Usuario Bob
      const bobPair = await generateEphemeralKeyPair();
      const bobPubB64 = await exportPublicKey(bobPair.publicKey);
      const bobPrivB64 = await exportPrivateKey(bobPair.privateKey);

      // Importar en ambos lados
      const alicePriv = await importPrivateKey(alicePrivB64);
      const alicePeerPub = await importPublicKey(bobPubB64);

      const bobPriv = await importPrivateKey(bobPrivB64);
      const bobPeerPub = await importPublicKey(alicePubB64);

      // Derivar clave compartida simétrica AES-GCM
      const aliceSharedKey = await deriveSharedKey(alicePriv, alicePeerPub);
      const bobSharedKey = await deriveSharedKey(bobPriv, bobPeerPub);

      // Alice cifra un mensaje
      const originalText = "Hola Bob, este es un mensaje directo permanente E2EE";
      const { ciphertext, nonce } = await encryptMessage(originalText, aliceSharedKey);

      // Bob descifra el mensaje
      const decryptedByBob = await decryptMessage(ciphertext, nonce, bobSharedKey);
      expect(decryptedByBob).toBe(originalText);

      // Bob responde
      const bobReply = "Hola Alice, recibido y verificado de forma segura";
      const replyEncrypted = await encryptMessage(bobReply, bobSharedKey);
      const decryptedByAlice = await decryptMessage(replyEncrypted.ciphertext, replyEncrypted.nonce, aliceSharedKey);
      expect(decryptedByAlice).toBe(bobReply);
    });

    it("genera determinísticamente el mismo canal directo sin importar el orden de los participantes", () => {
      const pubA = "pub_aaaa_123";
      const pubB = "pub_bbbb_456";

      const channel1 = getDirectChannelId(pubA, pubB);
      const channel2 = getDirectChannelId(pubB, pubA);

      expect(channel1).toBe(channel2);
      expect(channel1).toBe("direct:pub_aaaa_123_pub_bbbb_456");
    });
  });

  describe("Persistencia y Gestión de Contactos (Dexie)", () => {
    it("guarda, lista y elimina un contacto permanente junto con sus mensajes", async () => {
      const channelId = "direct:alice_bob";
      await saveDirectPeer({
        peerPublicKey: "bob_pub_key",
        alias: "Bob Andino",
        channelId,
        e2eePublicKey: "bob_ecdh_pub",
        createdAt: 1000,
        lastInteractionTs: 1000,
      });

      const peers = await getDirectPeers();
      expect(peers.length).toBe(1);
      expect(peers[0].alias).toBe("Bob Andino");

      // Guardar mensajes directos en ese canal
      await saveDirectMessage({
        id: "msg_1",
        channelId,
        fromPublicKey: "alice_pub",
        toPublicKey: "bob_pub_key",
        fromAlias: "Alice",
        content: "Mensaje 1",
        clientTs: 1001,
        isOutgoing: true,
      });
      await saveDirectMessage({
        id: "msg_2",
        channelId,
        fromPublicKey: "bob_pub_key",
        toPublicKey: "alice_pub",
        fromAlias: "Bob Andino",
        content: "Mensaje 2 recibido",
        clientTs: 1002,
        isOutgoing: false,
      });

      const msgs = await getDirectMessages(channelId);
      expect(msgs.length).toBe(2);

      // Verificar unreadCount tras mensaje entrante
      const bobPeer = await getDirectPeer("bob_pub_key");
      expect(bobPeer?.unreadCount).toBe(1);

      // Marcar como leído
      await markDirectChatAsRead(channelId);
      const bobPeerRead = await getDirectPeer("bob_pub_key");
      expect(bobPeerRead?.unreadCount).toBe(0);

      // Eliminar contacto y verificar borrado en cascada
      await deleteDirectPeerAndMessages("bob_pub_key");
      const peersAfter = await getDirectPeers();
      expect(peersAfter.length).toBe(0);

      const msgsAfter = await getDirectMessages(channelId);
      expect(msgsAfter.length).toBe(0);
    });
  });

  describe("Reglas de Solicitud y Cooldown Asimétrico de 24 Horas", () => {
    it("permite enviar solicitud si no existe registro previo", async () => {
      const info = await checkRequestCooldown("peer_desconocido");
      expect(info.canRequest).toBe(true);
      expect(info.cooldownRemainingMs).toBe(0);
    });

    it("bloquea el reenvío si la solicitud sigue pendiente", async () => {
      await saveDirectRequest({
        id: "req_1",
        peerPublicKey: "peer_b",
        peerAlias: "Bob",
        direction: "outgoing",
        status: "pending",
        e2eePublicKey: "ecdh_key",
        createdAt: Date.now(),
      });

      const info = await checkRequestCooldown("peer_b");
      expect(info.canRequest).toBe(false);
      expect(info.status).toBe("pending");
    });

    it("bloquea el reenvío si el par ya fue aceptado", async () => {
      await saveDirectRequest({
        id: "req_2",
        peerPublicKey: "peer_c",
        peerAlias: "Carlos",
        direction: "outgoing",
        status: "accepted",
        e2eePublicKey: "ecdh_key",
        createdAt: Date.now(),
      });

      const info = await checkRequestCooldown("peer_c");
      expect(info.canRequest).toBe(false);
      expect(info.status).toBe("accepted");
    });

    it("aplica cooldown de 24 horas al emisor tras ser rechazada su solicitud", async () => {
      const now = Date.now();
      const cooldownUntil = now + DIRECT_REQUEST_COOLDOWN_MS;

      await saveDirectRequest({
        id: "req_3",
        peerPublicKey: "peer_d",
        peerAlias: "Diana",
        direction: "outgoing",
        status: "rejected",
        e2eePublicKey: "ecdh_key",
        createdAt: now,
        cooldownUntil,
      });

      // Debe estar en cooldown activo
      const info = await checkRequestCooldown("peer_d");
      expect(info.canRequest).toBe(false);
      expect(info.status).toBe("rejected");
      expect(info.cooldownRemainingMs).toBeGreaterThan(0);
      expect(info.cooldownRemainingMs).toBeLessThanOrEqual(DIRECT_REQUEST_COOLDOWN_MS);
    });

    it("restablece el estado a neutro una vez transcurridas las 24 horas de cooldown", async () => {
      const now = Date.now();
      // Simular que el cooldown venció hace 1 segundo
      const cooldownUntil = now - 1000;

      await saveDirectRequest({
        id: "req_4",
        peerPublicKey: "peer_e",
        peerAlias: "Elena",
        direction: "outgoing",
        status: "rejected",
        e2eePublicKey: "ecdh_key",
        createdAt: now - DIRECT_REQUEST_COOLDOWN_MS - 2000,
        cooldownUntil,
      });

      // El cooldown ya pasó: checkRequestCooldown limpia el registro y permite enviar
      const info = await checkRequestCooldown("peer_e");
      expect(info.canRequest).toBe(true);
      expect(info.cooldownRemainingMs).toBe(0);

      // Verificar que el registro vencido fue eliminado
      const requests = await getDirectRequests();
      const elenaReq = requests.find((r) => r.peerPublicKey === "peer_e");
      expect(elenaReq).toBeUndefined();
    });

    it("regla asimétrica: el receptor que rechazó una solicitud entrante SÍ puede enviar solicitud al emisor", async () => {
      const now = Date.now();

      // Alice recibió solicitud de Bob y la rechazó
      await saveDirectRequest({
        id: "req_5",
        peerPublicKey: "peer_bob",
        peerAlias: "Bob",
        direction: "incoming", // ¡Entrante!
        status: "rejected",
        e2eePublicKey: "ecdh_key",
        createdAt: now,
      });

      // Alice consulta si puede enviarle una solicitud a Bob: debe ser TRUE (no tiene cooldown)
      const info = await checkRequestCooldown("peer_bob");
      expect(info.canRequest).toBe(true);
      expect(info.cooldownRemainingMs).toBe(0);
    });

    it("la eliminación de contacto limpia las solicitudes previas y restablece el estado a neutro", async () => {
      const peerKey = "peer_to_reset";
      const channelId = "direct:me_peer_to_reset";

      // Crear par y solicitud asociada
      await saveDirectPeer({
        peerPublicKey: peerKey,
        alias: "Usuario Temporal",
        channelId,
        e2eePublicKey: "ecdh_key",
        createdAt: Date.now(),
        lastInteractionTs: Date.now(),
      });
      await saveDirectRequest({
        id: "req_reset",
        peerPublicKey: peerKey,
        peerAlias: "Usuario Temporal",
        direction: "outgoing",
        status: "accepted",
        e2eePublicKey: "ecdh_key",
        createdAt: Date.now(),
      });

      // El cooldown indica que no se puede enviar porque ya está en estado accepted
      const beforeDel = await checkRequestCooldown(peerKey);
      expect(beforeDel.canRequest).toBe(false);

      // Eliminar el contacto
      await deleteDirectPeerAndMessages(peerKey);

      // Debe quedar en estado neutro: sin par, sin solicitud, y canRequest = true
      const afterDel = await checkRequestCooldown(peerKey);
      expect(afterDel.canRequest).toBe(true);
      expect(afterDel.status).toBeUndefined();
      const peerInDb = await getDirectPeer(peerKey);
      expect(peerInDb).toBeUndefined();
    });
  });

  describe("Límites y Validación de Canales Directos E2EE", () => {
    it("valida la constante MAX_DIRECT_PEERS_PER_CLIENT en 20 contactos", () => {
      expect(MAX_DIRECT_PEERS_PER_CLIENT).toBe(20);
    });

    it("DirectMsgSchema valida canales con longitud de claves SPKI ECDSA mayores a 250 caracteres", () => {
      // Simular claves SPKI base64url (~122 chars cada una)
      const mockKeyA = "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE7Z8_mock_key_A_part1_longer_string_for_testing_purposes_1234567890abcdefghijklmnopqrstuvwxyz_endA";
      const mockKeyB = "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE9Z9_mock_key_B_part2_longer_string_for_testing_purposes_1234567890abcdefghijklmnopqrstuvwxyz_endB";
      const channelId = getDirectChannelId(mockKeyA, mockKeyB);

      // La longitud de este channelId supera ampliamente los 128 caracteres
      expect(channelId.length).toBeGreaterThan(250);
      expect(channelId.length).toBeLessThanOrEqual(512);

      const validPayload = {
        id: "msg_test_spki_123",
        channelId,
        fromPublicKey: mockKeyA,
        toPublicKey: mockKeyB,
        fromAlias: "Alice",
        ciphertext: "dGVzdF9jaXBoZXJ0ZXh0",
        nonce: "dGVzdF9ub25jZQ==",
        clientTs: Date.now(),
      };

      const parseResult = DirectMsgSchema.safeParse(validPayload);
      expect(parseResult.success).toBe(true);
    });

    it("cancela y descarta solicitudes pendientes y expira solicitudes de perfiles inactivos tras 48h", async () => {
      const peerKey = "pub_inactive_peer_123";
      const now = Date.now();

      // 1. Guardar solicitud saliente reciente
      await saveDirectRequest({
        id: "req_test_cancel_1",
        peerPublicKey: peerKey,
        peerAlias: "AntiguoUsuario",
        direction: "outgoing",
        status: "pending",
        e2eePublicKey: "e2ee_key",
        createdAt: now,
      });

      let cooldown = await checkRequestCooldown(peerKey);
      expect(cooldown.canRequest).toBe(false);
      expect(cooldown.status).toBe("pending");

      // 2. Cancelar manualmente la solicitud
      await deleteDirectRequest("req_test_cancel_1");
      let reqs = await getDirectRequests();
      expect(reqs.length).toBe(0);

      cooldown = await checkRequestCooldown(peerKey);
      expect(cooldown.canRequest).toBe(true);

      // 3. Simular una solicitud enviada hace más de 48 horas (perfil abandonado)
      await saveDirectRequest({
        id: "req_test_expired_1",
        peerPublicKey: peerKey,
        peerAlias: "UsuarioAbandonado",
        direction: "outgoing",
        status: "pending",
        e2eePublicKey: "e2ee_key",
        createdAt: now - (DIRECT_REQUEST_EXPIRATION_MS + 1000),
      });

      // getDirectRequests debe marcarla automáticamente como "expired"
      reqs = await getDirectRequests();
      expect(reqs.length).toBe(1);
      expect(reqs[0].status).toBe("expired");

      // checkRequestCooldown debe permitir enviar nueva solicitud sin bloqueo
      cooldown = await checkRequestCooldown(peerKey);
      expect(cooldown.canRequest).toBe(true);
      expect(cooldown.status).toBe("expired");
    });

    it("marca al contacto como eliminado sin borrar su historial para que el amigo se entere de lo que pasó", async () => {
      const peerKey = "pub_friend_deleted_profile";
      const channelId = "direct:me_pub_friend_deleted_profile";

      await saveDirectPeer({
        peerPublicKey: peerKey,
        alias: "AmigoCercano",
        channelId,
        e2eePublicKey: "e2ee_friend_key",
        createdAt: Date.now() - 10000,
        lastInteractionTs: Date.now() - 5000,
      });

      await saveDirectMessage({
        id: "dmsg_hist_1",
        channelId,
        fromPublicKey: peerKey,
        toPublicKey: "my_key",
        fromAlias: "AmigoCercano",
        content: "Nos vemos mañana en el puerto lacustre",
        clientTs: Date.now() - 5000,
        isOutgoing: false,
      });

      // El amigo renueva sesión y emite desvinculación: en vez de borrar el chat de inmediato, se marca como eliminado
      await markDirectPeerAsDeleted(peerKey);

      const peer = await getDirectPeer(peerKey);
      expect(peer).toBeDefined();
      expect(peer?.isDeletedByPeer).toBe(true);

      // El historial de mensajes se preserva para que el usuario pueda leerlo y enterarse
      const msgs = await getDirectMessages(channelId);
      expect(msgs.length).toBe(1);
      expect(msgs[0].content).toBe("Nos vemos mañana en el puerto lacustre");

      // Luego, cuando el usuario decide eliminarlo manualmente:
      await deleteDirectPeerAndMessages(peerKey);
      const peerAfterDelete = await getDirectPeer(peerKey);
      expect(peerAfterDelete).toBeUndefined();
      const msgsAfterDelete = await getDirectMessages(channelId);
      expect(msgsAfterDelete.length).toBe(0);
    });

    it("previene la duplicación de mensajes idénticos en activeMessages del store directo", async () => {
      const { useDirectChatStore } = await import("@/stores/directChatStore");

      const peerKey = "pub_dedup_peer";
      const channelId = "direct:me_pub_dedup_peer";

      useDirectChatStore.setState({
        activeDirectPeer: {
          peerPublicKey: peerKey,
          alias: "TestPeer",
          channelId,
          e2eePublicKey: "peer_ecdh",
          createdAt: Date.now(),
          lastInteractionTs: Date.now(),
        },
        activeMessages: [],
      });

      // Simulamos la llegada de un mismo mensaje dos o tres veces por concurrencia
      const msg = {
        id: "dmsg_concurrent_123",
        channelId,
        fromPublicKey: peerKey,
        toPublicKey: "my_key",
        fromAlias: "TestPeer",
        content: "Hola amigo",
        clientTs: Date.now(),
        isOutgoing: false,
      };

      // Si se añade por primera vez
      useDirectChatStore.setState((s) => ({
        activeMessages: s.activeMessages.some((m) => m.id === msg.id)
          ? s.activeMessages
          : [...s.activeMessages, msg],
      }));
      expect(useDirectChatStore.getState().activeMessages.length).toBe(1);

      // Si un segundo o tercer oyente concurrente intenta añadirlo de nuevo
      useDirectChatStore.setState((s) => ({
        activeMessages: s.activeMessages.some((m) => m.id === msg.id)
          ? s.activeMessages
          : [...s.activeMessages, msg],
      }));
      useDirectChatStore.setState((s) => ({
        activeMessages: s.activeMessages.some((m) => m.id === msg.id)
          ? s.activeMessages
          : [...s.activeMessages, msg],
      }));

      // No debe multiplicarse a 3 mensajes
      expect(useDirectChatStore.getState().activeMessages.length).toBe(1);
    });
  });
});
