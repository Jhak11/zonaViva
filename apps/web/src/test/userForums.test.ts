import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import {
  CreateTemporaryForumSchema,
  AnnounceUserForumsSchema,
  LeaveUserForumPermanentlySchema,
  ALLOWED_FORUM_RADII,
  type TemporaryForum,
  type Message,
} from "@zonaviva/protocol";
import { distanceMeters } from "../geo/geoCore";
import {
  saveUserForum,
  getParticipatingUserForums,
  markForumAsRead,
  leaveUserForumPermanently,
  saveMessages,
  clearAllLocalData,
} from "../db/storage";

describe("Iteración 5 – Foros Temporales de Usuario", () => {
  beforeEach(async () => {
    await clearAllLocalData();
  });

  describe("1. Validación de Esquemas del Protocolo", () => {
    it("valida creación de foro temporal con datos correctos", () => {
      const payload = {
        id: "user:01JBP8R3D6V7M4W0Q5G9S8T7Y1",
        name: "Feria Agropecuaria Bellavista",
        description: "Encuentro de productores locales de tubérculos andinos",
        radius: 200,
        latitude: -15.8402,
        longitude: -70.0219,
        createdAt: Date.now(),
        creatorKey: "pubkey_test",
      };

      const result = CreateTemporaryForumSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it("rechaza radios no autorizados", () => {
      const invalidRadius = {
        id: "user:01JBP8R3D6V7M4W0Q5G9S8T7Y1",
        name: "Foro Inválido",
        description: "Radio no permitido",
        radius: 10, // menor que MIN_FORUM_RADIUS (50)
        latitude: -15.8402,
        longitude: -70.0219,
        createdAt: Date.now(),
        creatorKey: "pubkey_test",
      };

      const result = CreateTemporaryForumSchema.safeParse(invalidRadius);
      expect(result.success).toBe(false);
    });

    it("valida todos los radios permitidos por la especificación", () => {
      for (const r of ALLOWED_FORUM_RADII) {
        const payload = {
          id: `user:01JBP8R3D6V7M4W0Q5G9S8T7Y${r}`,
          name: `Foro Radio ${r}m`,
          description: "Test de radio",
          radius: r,
          latitude: -15.8402,
          longitude: -70.0219,
          createdAt: Date.now(),
          creatorKey: "pubkey_test",
        };
        expect(CreateTemporaryForumSchema.safeParse(payload).success).toBe(true);
      }
    });

    it("valida anuncios y abandono permanente de foros", () => {
      const announcePayload = {
        forums: [
          {
            id: "user:01JBP8R3D6V7M4W0Q5G9S8T7Y1",
            type: "user" as const,
            name: "Foro Vecinos Barrio Bellavista",
            description: "Seguridad y limpieza",
            latitude: -15.835,
            longitude: -70.025,
            radius: 100,
            createdAt: Date.now(),
            creatorKey: "pubkey123",
          },
        ],
      };
      expect(AnnounceUserForumsSchema.safeParse(announcePayload).success).toBe(true);

      const leavePayload = {
        forumId: "user:01JBP8R3D6V7M4W0Q5G9S8T7Y1",
      };
      expect(LeaveUserForumPermanentlySchema.safeParse(leavePayload).success).toBe(true);
    });
  });

  describe("2. Geometría Circular, Proximidad y Solapamiento", () => {
    const centerLat = -15.8402;
    const centerLng = -70.0219;
    const radiusMeters = 200;

    it("detecta usuario dentro del círculo (puede publicar)", () => {
      // Punto a ~50 metros al este
      const userLat = -15.8402;
      const userLng = -70.02143; // delta ~50m
      const dist = distanceMeters(userLat, userLng, centerLat, centerLng);

      expect(dist).toBeLessThan(radiusMeters);
      const isInside = dist <= radiusMeters;
      expect(isInside).toBe(true);
    });

    it("detecta usuario fuera del círculo (modo solo lectura)", () => {
      // Punto a ~400 metros al sur
      const userLat = -15.8438;
      const userLng = -70.0219;
      const dist = distanceMeters(userLat, userLng, centerLat, centerLng);

      expect(dist).toBeGreaterThan(radiusMeters + 50);
      const isInside = dist <= radiusMeters + 50;
      expect(isInside).toBe(false);
    });

    it("permite el solapamiento de dos o más foros circulares", () => {
      const forumA: TemporaryForum = {
        id: "user:forum_a",
        type: "user",
        name: "Foro A - Artesanos",
        description: "Feria de arte",
        latitude: -15.8402,
        longitude: -70.0219,
        radius: 200,
        createdAt: Date.now(),
        creatorKey: "creator_a",
      };

      const forumB: TemporaryForum = {
        id: "user:forum_b",
        type: "user",
        name: "Foro B - Música y Cultura",
        description: "Música en vivo",
        latitude: -15.8408, // a ~70 metros
        longitude: -70.0221,
        radius: 150,
        createdAt: Date.now(),
        creatorKey: "creator_b",
      };

      // Un usuario ubicado exactamente entre ambos
      const userPos = { latitude: -15.8405, longitude: -70.022 };
      const distA = distanceMeters(userPos.latitude, userPos.longitude, forumA.latitude, forumA.longitude);
      const distB = distanceMeters(userPos.latitude, userPos.longitude, forumB.latitude, forumB.longitude);

      // Ambos foros cubren la posición física del usuario simultáneamente
      expect(distA).toBeLessThan(forumA.radius);
      expect(distB).toBeLessThan(forumB.radius);
    });
  });

  describe("3. Persistencia en IndexedDB, Participación Activa y Notificaciones", () => {
    it("guarda foro temporal y calcula correctamente mensajes no leídos", async () => {
      const forumData: TemporaryForum = {
        id: "user:01JBP8R3D6V7M4W0Q5G9S8T7Y1",
        type: "user",
        name: "Comité de Barrio Victoria",
        description: "Reunión de coordinación vecinal",
        latitude: -15.841,
        longitude: -70.023,
        radius: 100,
        createdAt: Date.now() - 10000,
        creatorKey: "creator_pub_key",
      };

      // 1. Guardar metadatos de foro temporal
      await saveUserForum(forumData, true);

      // Regla estricta: si aún no hay mensajes guardados, no figura como participante
      let myForums = await getParticipatingUserForums();
      expect(myForums.length).toBe(0);

      // 2. Llega un mensaje cuando el usuario no tiene el foro abierto
      const now = Date.now();
      const msg1: Message = {
        id: "01JBP8R3D6V7M4W0Q5G9S8T7M1",
        forumId: forumData.id,
        alias: "Vecino1",
        authorKey: "key_vecino1",
        content: "¿A qué hora inicia la reunión?",
        clientTs: now,
        relayTs: now,
        sig: "sig1",
        relaySig: "rsig1",
      };
      await saveMessages([msg1]);

      // Al guardar al menos 1 mensaje, ya figura como participante activo con 1 mensaje no leído
      myForums = await getParticipatingUserForums();
      expect(myForums.length).toBe(1);
      expect(myForums[0].id).toBe(forumData.id);
      expect(myForums[0].messageCount).toBe(1);
      expect(myForums[0].unreadCount).toBe(1);

      // 3. El usuario entra al foro y lo marca como leído
      await markForumAsRead(forumData.id, now);
      myForums = await getParticipatingUserForums();
      expect(myForums[0].unreadCount).toBe(0);
    });

    it("elimina foro y todos sus mensajes al abandonar permanentemente", async () => {
      const forumData: TemporaryForum = {
        id: "user:01JBP8R3D6V7M4W0Q5G9S8T7Y2",
        type: "user",
        name: "Foro a Eliminar",
        description: "Foro de prueba para eliminación",
        latitude: -15.84,
        longitude: -70.02,
        radius: 50,
        createdAt: Date.now(),
        creatorKey: "key",
      };

      await saveUserForum(forumData, true);
      const msg: Message = {
        id: "01JBP8R3D6V7M4W0Q5G9S8T7M2",
        forumId: forumData.id,
        alias: "Vecino",
        authorKey: "key_v",
        content: "Mensaje temporal",
        clientTs: Date.now(),
        relayTs: Date.now(),
        sig: "sig",
        relaySig: "rsig",
      };
      await saveMessages([msg]);

      let myForums = await getParticipatingUserForums();
      expect(myForums.length).toBe(1);

      // Abandonar foro permanentemente
      await leaveUserForumPermanently(forumData.id);

      myForums = await getParticipatingUserForums();
      expect(myForums.length).toBe(0);
    });
  });
});
