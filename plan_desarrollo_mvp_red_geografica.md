# Plan de desarrollo del MVP: Red social geográfica con relay WebSocket

**Versión 1.1 · 28 de octubre de 2026**
**Tipo de producto:** aplicación web progresiva (PWA)
**Metodología:** iteraciones tipo Scrum, una funcionalidad completa por iteración

---

## Índice

1. [Descripción del proyecto](#1-descripción-del-proyecto)
2. [Alcance del MVP](#2-alcance-del-mvp)
3. [Decisiones clave de diseño](#3-decisiones-clave-de-diseño)
4. [Arquitectura](#4-arquitectura)
5. [Stack tecnológico](#5-stack-tecnológico)
6. [Vistas de la página web](#6-vistas-de-la-página-web)
7. [Plan de desarrollo por iteraciones](#7-plan-de-desarrollo-por-iteraciones)
8. [Cuestiones abiertas por definir](#8-cuestiones-abiertas-por-definir)
9. [Riesgos y limitaciones aceptadas](#9-riesgos-y-limitaciones-aceptadas)
10. [Definición de terminado, calidad y organización](#10-definición-de-terminado-calidad-y-organización)
11. [Después del MVP](#11-después-del-mvp)

---

## 1. Descripción del proyecto

### 1.1 Visión

Una red social web centrada en la **ubicación geográfica**. Las personas conversan con otros usuarios cercanos y participan en foros asociados a lugares físicos (barrios, plazas, mercados, calles) sin necesidad de registrarse con nombre real ni foto.

### 1.2 Problema que resuelve

Las redes sociales actuales conectan por afinidad o por contactos previos. No existe un espacio ligero, anónimo y local para hablar con quien está en el mismo lugar: qué pasa en el mercado, si hay tráfico en la avenida, qué evento hay en la plaza, o simplemente conversar con un vecino desconocido.

### 1.3 Objetivo del MVP

Demostrar que el modelo funciona en la práctica con un grupo limitado de usuarios y una zona geográfica inicial. **No** busca anonimato absoluto, resistencia total a fallos ni moderación completa.

### 1.4 Principios

| Principio | Significado en el MVP |
|---|---|
| **Proximidad** | Las conversaciones están ligadas a zonas reales. |
| **Anonimato práctico** | Sin nombre real ni foto. Alias temporal por sesión. |
| **Privacidad razonable** | No se publican coordenadas exactas. Los usuarios no ven la IP de los demás. |
| **Temporalidad** | Los chats aleatorios son efímeros. Los foros persisten según sus reglas. |
| **Contenido en los dispositivos** | El servidor **no almacena** mensajes; solo los reenvía. Cada participante guarda su copia. |

### 1.5 Tipos de espacio de comunicación

1. **Foros geográficos permanentes:** asociados a zonas predefinidas. Su identidad no depende de quién los creó.
2. **Foros creados por usuarios:** definen una zona (celda geográfica). Solo se descubren y usan desde dentro de esa zona.
3. **Chat aleatorio 1 a 1:** emparejamiento entre dos usuarios disponibles en una zona. Efímero y cifrado extremo a extremo.

### 1.6 Qué significa "descentralizado" en este MVP

Se redefine el término para ser honestos con lo que es técnicamente viable en un navegador:

- **Sí hay un servidor** (el relay), porque un navegador no puede descubrir a otro ni ocultar su IP sin un intermediario.
- **El servidor no es la fuente de verdad del contenido:** no tiene base de datos, no guarda historial y no registra mensajes.
- **El historial vive en los dispositivos** de los participantes y se recupera de ellos (a través del relay).

---

## 2. Alcance del MVP

### 2.1 Incluido

- Foros geográficos permanentes (lectura fuera de la zona, publicación solo dentro).
- Foros creados por usuarios con zona basada en geohash.
- Chat aleatorio efímero con cifrado extremo a extremo.
- Alias temporales y claves de sesión.
- Copia local del historial (IndexedDB) y sincronización entre participantes vía relay.
- Geolocalización con comprobación local en el cliente.
- Instalación como PWA.

### 2.2 Excluido explícitamente

| Función excluida | Nota |
|---|---|
| Reportes, bloqueos y antispam | Quedan fuera por decisión del proyecto. **Son obligatorios antes de abrir la red al público general** (ver sección 11). |
| Perfiles permanentes, seguidores, popularidad | Contradicen el principio de anonimato temporal. |
| Recomendaciones algorítmicas | No necesarias para validar la idea. |
| Verificación robusta de ubicación física | El GPS del cliente es falsificable. Se acepta. |
| Garantía de disponibilidad del historial | Depende de que haya pares conectados (o del archivista opcional). |
| Cifrado de grupo en foros | Los foros son públicos para su zona. |
| Anonimato frente al relay o análisis de tráfico | El relay conoce las IP de quienes se conectan a él. |
| Imágenes, archivos, audio y video | Solo texto en el MVP. |
| Aplicación nativa | Solo web (PWA). |

### 2.3 Mínimos técnicos que SÍ se incluyen (no son moderación)

Son medidas de supervivencia del servidor, no funciones sociales:

- Límite de tamaño por mensaje (p. ej., 1000 caracteres).
- Tope de conexiones simultáneas por IP (en memoria, sin guardar la IP en logs).
- Validación de formato de todos los eventos recibidos.

---

## 3. Decisiones clave de diseño

### 3.1 Comunicación entre pares: relay WebSocket (decidido)

Todos los clientes se conectan **solo al relay**, nunca entre ellos. Esto elimina la exposición de IP entre participantes por diseño y evita WebRTC, STUN, TURN y señalización.

**Qué ve el relay:** la IP de cada cliente, a qué sala está unido y metadatos de tamaño y tiempo. **Qué no hace:** guardar contenido ni registrar IP en logs. Esto es una limitación aceptada y debe comunicarse al usuario en la vista de privacidad.

### 3.2 Foros: sí hay intermediario, sin almacenamiento

- El relay mantiene **salas** en memoria (una por foro) y hace **fan-out** de los mensajes.
- Cada cliente guarda su copia completa en IndexedDB.
- Al entrar, el cliente pide el historial; el relay reenvía la petición a uno o dos miembros conectados con copia y retransmite sus respuestas. Nunca hay conexión directa.
- El relay asigna la **marca de tiempo oficial** (`relayTs`) a cada mensaje. Esto resuelve la inconsistencia de relojes entre dispositivos.

### 3.3 Publicar solo con conexión (simplificación importante)

Un cliente **no publica mientras está desconectado**. Si escribe sin conexión, el mensaje queda en una bandeja de salida local y se envía al reconectar, recibiendo entonces su `relayTs`. Con esto **desaparecen los conflictos de reconciliación entre réplicas divergentes**: toda la historia pasa por el relay y tiene un orden único.

### 3.4 Integridad del historial: firma del relay

Un par malicioso podría inyectar mensajes falsos al responder una sincronización. Solución barata: el relay **firma** `(id, forumId, relayTs, hash(contenido))` con una clave ECDSA P-256 propia, y los clientes verifican esa firma con la clave pública (embebida en la app). El relay no almacena nada, solo firma al vuelo.

### 3.5 Cifrado

| Espacio | Mecanismo |
|---|---|
| Transporte | TLS (`wss://`) |
| Chat aleatorio | Extremo a extremo con WebCrypto: ECDH P-256 para acordar clave, HKDF y AES-GCM para cifrar. Se ofrece un **código de verificación** comparable entre ambos. |
| Foros | Públicos para la zona; mensajes firmados con clave de sesión del autor. Sin cifrado de grupo. |

Limitación aceptada: el relay reenvía las claves públicas del chat y podría suplantarlas (ataque de intermediario). El código de verificación lo mitiga para quien quiera comprobarlo.

### 3.6 Geolocalización y privacidad de ubicación

- **Zonas permanentes:** catálogo predefinido (`zones.json`) con polígonos o círculos. La comprobación punto-en-zona ocurre **en el dispositivo**.
- **Foros de usuario:** zona representada por una **celda geohash**: precisión 6 (~1,2 km × 0,6 km, "barrio/cuadra") o precisión 5 (~5 km × 5 km, "sector").
- **Lo que recibe el relay:** el ID de zona o la celda geohash, **nunca coordenadas exactas**. Para listar foros de usuario cercanos, el relay sí conoce la celda aproximada del cliente; esto se declara en la vista de privacidad.
- El GPS se puede falsificar; la validación es funcional, no una prueba de presencia.

### 3.7 Ciclo de vida de los foros de usuario

- El foro se registra en el directorio efímero del relay al crearse.
- El relay lo elimina si pasa un tiempo de gracia sin miembros conectados (**propuesta: 24 h**, ver sección 8).
- Los metadatos del foro (nombre, celda, fecha) viajan dentro de la copia local, de modo que **si el relay se reinicia**, cualquier miembro que se reconecte puede re-registrar el foro.
- Al reconectar, un cliente elimina su copia local de un foro de usuario cuyo último contacto supere el tiempo de gracia.
- No se puede garantizar el borrado en dispositivos desconectados ni en copias que alguien guardó por su cuenta.

### 3.8 Archivista (componente opcional)

Un proceso Node que se conecta al relay como un cliente más, se une a los foros permanentes y conserva copia. Evita que el historial de los foros permanentes desaparezca cuando no hay nadie conectado. Sigue siendo un participante, no una base de datos central. **Se recomienda activarlo desde la Iteración 3** para que las demos sean consistentes.

---

## 4. Arquitectura

### 4.1 Vista general

```
┌─────────────────────────── Navegador (PWA) ───────────────────────────┐
│  Interfaz (React)                                                      │
│  ───────────────────────────────────────────────────────────────────   │
│  Módulos de aplicación:                                                │
│   Zonas/Geo │ Identidad │ Foros │ Chat aleatorio │ Cripto              │
│  ───────────────────────────────────────────────────────────────────   │
│  Módulos de datos y red:                                               │
│   Almacenamiento local (IndexedDB) │ Sincronización │ Cliente de red   │
└──────────────────────────────┬─────────────────────────────────────────┘
                               │  wss:// (Socket.IO)
┌──────────────────────────────▼─────────────────────────────────────────┐
│  RELAY (Node.js + TypeScript) — solo memoria                           │
│   Salas y fan-out │ Directorio efímero │ Cola de emparejamiento        │
│   Reenvío de sync │ Sellado y firma de mensajes │ Límites mínimos      │
│   SIN base de datos · SIN logs de contenido ni IP                      │
└──────────────────────────────▲─────────────────────────────────────────┘
                               │  wss:// (mismo protocolo)
                  (opcional) Archivista: cliente Node que guarda copias
```

Distribución estática: el frontend se sirve como archivos estáticos (sin lógica de servidor); el relay es un único servicio Node.

### 4.2 Módulos del cliente

| Módulo | Responsabilidad | No debe saber |
|---|---|---|
| **Interfaz** | Vistas, estado visual, accesibilidad. | Socket.IO, IndexedDB, WebCrypto. |
| **Zonas y geolocalización** | Obtener posición, calcular `zoneId` y geohash, autorizar leer/publicar/descubrir. | Cómo se envían o guardan mensajes. |
| **Identidad temporal** | Alias de sesión, par de claves de sesión, renovación. | Reglas de foros. |
| **Foros** | Reglas de foros permanentes y de usuario, crear/unirse/salir, ciclo de vida. | Detalles del transporte. |
| **Chat aleatorio** | Cola, emparejamiento, sesión efímera. | Almacenamiento (no guarda). |
| **Cripto** | ECDH, HKDF, AES-GCM, firmas, verificación de firma del relay. | Reglas de negocio. |
| **Almacenamiento local** | Dexie/IndexedDB: foros, mensajes, bandeja de salida, ajustes. | Red. |
| **Sincronización** | Pedir historial, fusionar, deduplicar, reintentar. | UI. |
| **Cliente de red** | **Único** módulo que conoce Socket.IO. Reconexión, acuses, eventos tipados. | Reglas de zona. |

La separación estricta del **cliente de red** permite cambiar de transporte más adelante (por ejemplo, WebRTC) sin tocar las reglas.

### 4.3 Módulos del relay

| Módulo | Responsabilidad |
|---|---|
| **Salas y fan-out** | Une/saca sockets de salas por foro y reenvía mensajes. |
| **Sellado** | Valida, asigna `relayTs`, firma y retransmite. |
| **Directorio efímero** | Foros de usuario activos por celda geohash, con expiración. |
| **Emparejamiento** | Cola por zona; crea sala privada de 2. |
| **Reenvío de sincronización** | Elige 1–2 miembros con copia, reenvía petición y respuestas. |
| **Límites mínimos** | Tamaño de mensaje, validación de esquema, tope por IP. |

### 4.4 Modelos de datos

**Mensaje**

```ts
interface Message {
  id: string;        // ULID generado por el cliente (deduplicación)
  forumId: string;   // "zone:<zoneId>" | "user:<uuid>"
  alias: string;     // alias temporal visible
  authorKey: string; // clave pública de sesión (para verificar sig)
  content: string;   // máx. 1000 caracteres
  clientTs: number;  // informativo, no se usa para ordenar
  relayTs: number;   // asignado por el relay: define el orden
  sig: string;       // firma del autor
  relaySig: string;  // firma del relay sobre (id, forumId, relayTs, hash)
}
```

Orden canónico: `(relayTs, id)` ascendente.

**Foro**

```ts
interface Forum {
  id: string;              // "zone:<zoneId>" | "user:<uuid>"
  type: "zone" | "user";
  name: string;
  zoneId?: string;         // permanentes
  geohash?: string;        // usuario (precisión 5 o 6)
  createdAt: number;
  lastSyncRelayTs: number; // último mensaje sincronizado
  lastContactAt: number;   // para caducidad de foros de usuario
}
```

**Sesión local:** alias, par de claves de sesión (ECDSA), fecha de creación y expiración.

**Bandeja de salida:** mensajes redactados sin conexión, pendientes de envío.

### 4.5 Protocolo de eventos (Socket.IO)

| Evento | Dirección | Propósito |
|---|---|---|
| `join_forum` | C → R | Unirse a la sala de un foro (con `forumId`). |
| `leave_forum` | C → R | Salir de la sala. |
| `msg` | C → R | Publicar mensaje. El relay responde con ack y difunde `msg_sealed`. |
| `msg_sealed` | R → C | Mensaje con `relayTs` y `relaySig`. |
| `sync_request` | C → R → par | Pide mensajes con `relayTs > since`. |
| `sync_chunk` | par → R → C | Bloque de mensajes (paginado). |
| `sync_unavailable` | R → C | Nadie conectado puede aportar historial. |
| `list_forums` | C → R | Lista foros de usuario activos en una celda geohash. |
| `register_forum` | C → R | Crea o re-registra un foro de usuario. |
| `queue_chat` | C → R | Entrar a la cola de emparejamiento de una zona. |
| `matched` | R → C | Emparejamiento con clave pública del otro. |
| `chat_msg` | C ↔ R ↔ C | Mensaje cifrado del chat. |
| `leave_chat` | C → R | Terminar el chat; el relay avisa al otro. |

### 4.6 Flujos principales

**Publicar en un foro**

1. El cliente comprueba localmente que está dentro de la zona.
2. Firma el mensaje con su clave de sesión y lo envía (`msg`).
3. El relay valida tamaño y esquema, asigna `relayTs`, firma y difunde `msg_sealed` a la sala.
4. Todos los miembros (incluido el autor) verifican la firma del relay y guardan en IndexedDB.

**Entrar a un foro y sincronizar**

1. `join_forum`.
2. El cliente envía `sync_request` con `since = lastSyncRelayTs`.
3. El relay reenvía a 1–2 miembros conectados con copia. Si ninguno responde en un tiempo límite, envía `sync_unavailable`.
4. Los pares devuelven `sync_chunk`; el cliente verifica firmas del relay, deduplica por `id`, guarda y actualiza `lastSyncRelayTs`.
5. La interfaz muestra "Sincronizado" o "Historial no disponible".

**Chat aleatorio**

1. `queue_chat(zoneId)` con la clave pública efímera.
2. El relay empareja a dos usuarios y envía `matched` con la clave pública del otro.
3. Ambos derivan la clave compartida (ECDH + HKDF) y cifran con AES-GCM.
4. Al salir cualquiera, el relay avisa al otro y se descartan claves y mensajes de memoria.

### 4.7 Despliegue

- **Frontend:** hosting estático con HTTPS (Cloudflare Pages, Netlify o similar).
- **Relay:** una única instancia con TLS (Fly.io, Railway o VPS con Caddy). El MVP **no** escala horizontalmente (estado en memoria); suficiente para cientos de conexiones concurrentes.
- **Archivista:** proceso separado, opcional.

---

## 5. Stack tecnológico

| Capa | Tecnología | Motivo |
|---|---|---|
| Lenguaje | TypeScript (cliente y relay) | Tipos compartidos del protocolo. |
| Frontend | React + Vite | Desarrollo rápido y ecosistema amplio. |
| Estilos | Tailwind CSS | Velocidad de maquetación mobile-first. |
| Estado | Zustand | Simple, sin ceremonia. |
| Rutas | React Router | Vistas descritas en la sección 6. |
| PWA | `vite-plugin-pwa` | Instalable y caché de la interfaz. |
| Mapa | Leaflet + OpenStreetMap | Gratis. Revisar la política de uso de tiles. |
| Geo | Geolocation API, `ngeohash`, `@turf/boolean-point-in-polygon` | Comprobación local de zonas. |
| Almacenamiento | IndexedDB con Dexie | API cómoda y consultas por índice. |
| Tiempo real | Socket.IO (cliente y servidor) | Salas, reconexión y acuses incluidos. |
| Cripto | WebCrypto nativo | Sin criptografía propia ni dependencias pesadas. |
| IDs | `ulid` | Ordenables y únicos. |
| Validación | `zod` (esquemas compartidos) | Validar cada evento en cliente y relay. |
| Relay | Node.js + Socket.IO, solo memoria | Sin base de datos. |
| Pruebas | Vitest (unitarias), Playwright (extremo a extremo, dos contextos de navegador) | Simular varios usuarios. |
| Monorepo | pnpm workspaces: `apps/web`, `apps/relay`, `apps/archivist`, `packages/protocol` | Esquemas y tipos compartidos. |
| CI | GitHub Actions | Lint, pruebas y despliegue. |

**Compatibilidad de navegadores:** WebCrypto (ECDH, ECDSA P-256, AES-GCM), IndexedDB y Geolocation funcionan en navegadores modernos. La Geolocation API exige **HTTPS**. Verificar el comportamiento de PWA en iOS Safari (límites de almacenamiento y suspensión de pestañas en segundo plano).

---

## 6. Vistas de la página web

Diseño **mobile-first**, con barra de navegación inferior en móvil.

### 6.1 Mapa de navegación

```
Bienvenida ──► Inicio (mapa/zona) ──┬─► Foros ──► Foro ──► (Crear foro)
 (1ª vez)                           ├─► Chat aleatorio
                                    └─► Ajustes y privacidad ──► Acerca de
```

| Ruta | Vista |
|---|---|
| `/bienvenida` | Onboarding |
| `/` | Inicio (mapa y zona) |
| `/foros` | Lista de foros |
| `/foro/:id` | Foro |
| `/foros/nuevo` | Crear foro |
| `/chat` | Chat aleatorio |
| `/ajustes` | Ajustes y privacidad |
| `/acerca` | Acerca de y términos |

### 6.2 Descripción de cada vista

**V1. Bienvenida / Onboarding** (solo la primera vez)
- Explicación breve de la idea en 3 pantallas.
- Aviso claro de privacidad: no se exige identidad, el relay ve tu IP pero no guarda mensajes, tu ubicación exacta no se comparte.
- Solicitud del permiso de ubicación con explicación previa de para qué se usa.
- Generación del alias temporal (editable o regenerable).
- Aceptación de términos y edad mínima.

**V2. Inicio (mapa y zona)**
- Mapa con las zonas predefinidas y tu ubicación aproximada (punto, sin precisión exacta compartida).
- Zona actual detectada, con opción de **cambiar de zona manualmente** para explorar (modo lectura).
- Indicador de estado: conectado, sincronizando, sin GPS o sin conexión.
- Accesos rápidos: foros de la zona, chat aleatorio, crear foro.

**V3. Lista de foros**
- Pestañas: **Zonas** (permanentes), **Cerca de mí** (de usuario, solo de tu celda) y **Mis foros** (los que conservo localmente).
- Cada tarjeta muestra: nombre, tipo, número aproximado de conectados, último mensaje local y estado de la copia.
- Estado vacío: "No hay foros de usuario cerca; crea el primero".

**V4. Foro**
- Cabecera: nombre, zona, participantes conectados, estado de sincronización (sincronizado / sincronizando / historial no disponible).
- Lista de mensajes ordenada por `(relayTs, id)`: alias, hora y contenido; los mensajes propios diferenciados.
- Campo de entrada:
  - **Dentro de la zona:** habilitado.
  - **Fuera de la zona:** deshabilitado, con aviso "Solo lectura: debes estar en la zona para publicar" (solo foros permanentes).
  - **Sin conexión:** los mensajes quedan en bandeja de salida con indicador de "pendiente".
- Acciones: salir del foro, ver información del foro.

**V5. Crear foro**
- Nombre y descripción corta.
- Alcance: *Barrio/cuadra* (geohash 6) o *Sector* (geohash 5).
- Vista previa de la zona sobre el mapa.
- Aviso: "Se elimina cuando nadie lo conserve conectado durante X horas".

**V6. Chat aleatorio** (tres estados en una misma vista)
- *Lobby:* seleccionar zona y botón "Buscar con quién hablar".
- *Buscando:* animación con opción de cancelar.
- *Conversación:* mensajes cifrados, botón "Terminar", botón "Siguiente" (buscar otro), código de verificación visible y aviso "Este chat no se guarda".
- Estado al terminar la otra persona: "Tu interlocutor salió".

**V7. Ajustes y privacidad**
- Alias actual y renovar sesión (regenera alias y claves).
- Estado del permiso de ubicación y precisión de zona usada.
- Explicación de qué ve el relay y qué se guarda en este dispositivo.
- Gestión de datos locales: ver almacenamiento usado, **borrar copia de un foro** o borrar todo.
- Instalar la aplicación (PWA).

**V8. Acerca de y términos**
- Descripción del proyecto, limitaciones (GPS falsificable, historial sin garantía), términos de uso y contacto.

**Estados transversales (componentes, no vistas)**
- Banner de sin conexión / reconectando.
- Diálogo de permiso de ubicación denegado (con instrucciones).
- Pantalla de error de conexión con el relay (reintentar).

---

## 7. Plan de desarrollo por iteraciones

**Convenciones**
- Cada iteración dura **1,5 a 2 semanas** y entrega una funcionalidad **demostrable de principio a fin**.
- Estimación total: **12 a 14 semanas** para 1–2 desarrolladores (incluye holgura).
- Cada iteración termina con una demo y una retrospectiva breve.
- Los puntos marcados **⚠ Por definir** deben cerrarse **antes o durante** la iteración indicada.

---

### Iteración 0 — Cimientos y prueba técnica *(3–5 días)*

**Objetivo:** validar la arquitectura de punta a punta con lo mínimo.

**Historias**
- Como equipo, queremos un monorepo con CI para trabajar ordenadamente.
- Como equipo, queremos comprobar que dos navegadores (uno en móvil) intercambian mensajes por internet a través del relay.

**Tareas técnicas**
- Monorepo pnpm con `apps/web`, `apps/relay`, `packages/protocol`.
- Relay Socket.IO mínimo con una sala de prueba; despliegue con TLS.
- Cliente web mínimo (una página) conectado al relay desplegado.
- Medir latencia y comportamiento al bloquear la pantalla del móvil.

**⚠ Por definir:** proveedor de hosting del relay y del frontend; dominio; nombre del proyecto.

**Criterios de aceptación**
- [ ] Dos dispositivos en redes distintas (uno móvil con datos) intercambian mensajes por `wss://`.
- [ ] El relay desplegado no escribe contenido ni IP en logs.
- [ ] Pipeline de CI ejecuta lint y pruebas en cada commit.
- [ ] Se documentó el comportamiento al suspender la pestaña en móvil (iOS y Android).

---

### Iteración 1 — Zonas, geolocalización y esqueleto de la app *(2 semanas)*

**Objetivo:** que el usuario entre, tenga alias y vea en qué zona está.

**Historias**
- Como usuario nuevo, quiero un onboarding claro que me explique la privacidad.
- Como usuario, quiero que la app detecte mi zona con GPS y me la muestre en un mapa.
- Como usuario, quiero poder elegir otra zona manualmente para explorar.

**Tareas técnicas**
- Vistas V1, V2 y V7 (versión inicial), navegación y layout mobile-first.
- Módulo de identidad: alias temporal y par de claves de sesión.
- Catálogo `zones.json` y comprobación punto-en-zona local.
- Manejo de permisos de ubicación (concedido, denegado, no disponible).
- Configuración de PWA (manifiesto e instalación).

**⚠ Por definir (bloqueante):**
- **Ciudad o zona inicial del piloto** y creación del catálogo de zonas (polígonos o círculos). Sugerencia: empezar con 3 a 5 zonas.
- Nombres de zonas e identificadores estables (`zoneId`) que **no cambiarán** entre versiones.
- Política de uso de tiles de OpenStreetMap y plan alternativo (proveedor de tiles) si el tráfico crece.
- Política de expiración del alias (por sesión o por duración fija).

**Criterios de aceptación**
- [ ] Un usuario nuevo completa el onboarding y obtiene un alias.
- [ ] La app detecta correctamente la zona cuando el dispositivo está dentro y muestra "fuera de zonas" cuando no.
- [ ] Si se deniega el GPS, la app sigue siendo usable en modo exploración manual.
- [ ] Ninguna coordenada exacta sale del dispositivo (verificado en la pestaña de red).
- [ ] La app se instala como PWA en Android y se abre correctamente en iOS Safari.

---

### Iteración 2 — Foros geográficos permanentes en vivo *(2 semanas)*

**Objetivo:** conversar en tiempo real en un foro de zona respetando las reglas geográficas.

**Historias**
- Como usuario, quiero ver la lista de foros de las zonas y unirme a uno.
- Como usuario dentro de la zona, quiero publicar y ver mensajes de otros al instante.
- Como usuario fuera de la zona, quiero leer el foro pero no poder publicar.

**Tareas técnicas**
- Vistas V3 (pestaña Zonas) y V4.
- Relay: salas por foro, validación de `forumId` contra el catálogo de zonas, sellado (`relayTs`), límites mínimos (tamaño y conexiones por IP).
- Cliente de red tipado (único módulo con Socket.IO) y esquemas `zod` compartidos.
- Regla de autorización: leer fuera, publicar solo dentro.
- Indicador de conectados y estado de conexión.

**⚠ Por definir:**
- **Cómo conoce el relay el catálogo de zonas** (importar el mismo `zones.json` desde el paquete compartido; recomendado).
- Límite de tamaño de mensaje definitivo y límite de longitud del nombre/alias.
- Tiempo máximo que se mantiene en memoria un mensaje para fan-out (no se guarda, solo reenvía).

**Criterios de aceptación**
- [ ] Dos usuarios dentro de una zona ven los mensajes del otro en menos de 1 s en condiciones normales.
- [ ] Un usuario fuera de la zona lee mensajes pero el campo de publicar está deshabilitado con explicación.
- [ ] El relay rechaza mensajes que exceden el tamaño o que no cumplen el esquema.
- [ ] El relay rechaza una sala `zone:` que no exista en el catálogo.
- [ ] Ningún usuario ve la IP de otro en ningún evento ni en la interfaz.
- [ ] Los mensajes tienen `relayTs` y se ordenan igual en todos los clientes.

---

### Iteración 3 — Persistencia y sincronización del historial *(2 semanas)*

**Objetivo:** que cada dispositivo conserve el foro y un recién llegado reciba el historial disponible.

**Historias**
- Como usuario, quiero que al volver a abrir la app siga viendo mis foros y mensajes.
- Como usuario nuevo en un foro, quiero recibir el historial de otros participantes.
- Como usuario, quiero saber con claridad si el historial no está disponible.
- Como usuario sin conexión, quiero poder escribir y que se envíe al reconectar.

**Tareas técnicas**
- Almacenamiento local con Dexie: foros, mensajes (índice por `(forumId, relayTs, id)`), bandeja de salida, ajustes.
- Módulo de sincronización: `sync_request` / `sync_chunk` con paginación, deduplicación por `id`, actualización de `lastSyncRelayTs`.
- Relay: selección de 1–2 miembros con copia, reenvío, tiempo límite y `sync_unavailable`.
- **Firma del relay** sobre cada mensaje y verificación en el cliente.
- Reconexión automática y recuperación de lo perdido (`since`).
- Bandeja de salida con reintentos.
- **Archivista opcional** (`apps/archivist`) para foros permanentes.
- Vista de ajustes: almacenamiento usado y borrado de copias.

**⚠ Por definir:**
- **Tamaño máximo del historial local por foro** (por cantidad de mensajes o por antigüedad) para no saturar IndexedDB; política de recorte.
- **Si se activa el archivista** en la demo y cuántos foros conserva.
- Cuántos pares se consultan a la vez y tiempo de espera antes de declarar "no disponible".
- Manejo del almacenamiento persistente (`navigator.storage.persist()`) y mensaje al usuario si el navegador lo limita.
- Qué hacer si la firma del relay no valida (descartar y avisar de forma discreta).

**Criterios de aceptación**
- [ ] Al cerrar y reabrir la app, el historial local sigue visible sin conexión.
- [ ] Un usuario nuevo recibe el historial cuando al menos un par conectado tiene copia.
- [ ] Si nadie puede aportar historial, la app muestra "Historial no disponible" y **no** simula una sincronización exitosa.
- [ ] No se duplican mensajes tras múltiples sincronizaciones o reconexiones.
- [ ] Un usuario que estuvo desconectado recupera los mensajes que perdió al reconectar.
- [ ] Un mensaje escrito sin conexión se envía al reconectar y aparece con su `relayTs`.
- [ ] Un mensaje con firma de relay inválida es descartado.
- [ ] El relay no tiene base de datos ni escribe mensajes en disco (revisión de código y de logs).

---

### Iteración 4 — Chat aleatorio efímero y cifrado extremo a extremo *(1,5–2 semanas)*

**Objetivo:** conversar 1 a 1 con un desconocido de la zona, sin dejar rastro.

**Historias**
- Como usuario, quiero que la app me empareje con otra persona disponible en mi zona.
- Como usuario, quiero poder terminar el chat o pasar a otra persona en cualquier momento.
- Como usuario, quiero que lo que escribo sea privado y no se guarde.

**Tareas técnicas**
- Vista V6 (lobby, buscando, conversación).
- Relay: cola por zona, emparejamiento FIFO, sala privada de 2, aviso al otro cuando uno sale, timeout de cola.
- Módulo cripto: ECDH P-256 efímero, HKDF, AES-GCM, nonce único por mensaje.
- Código de verificación derivado de ambas claves públicas.
- Limpieza total de claves y mensajes en memoria al terminar.

**⚠ Por definir:**
- Si el emparejamiento exige estar **dentro** de la zona (recomendado) o permite zonas remotas.
- Qué hacer si no hay nadie en cola: espera con tiempo límite y mensaje "No hay nadie ahora" (se recomienda no mostrar bots).
- Comportamiento ante desconexión súbita del interlocutor (tiempo de gracia antes de cerrar).
- Si "Siguiente" debe evitar re-emparejar con la misma persona.

**Criterios de aceptación**
- [ ] Dos usuarios en la misma zona se emparejan en menos de 5 s cuando ambos están en cola.
- [ ] Los mensajes viajan cifrados (el relay solo ve texto cifrado, verificado capturando el tráfico).
- [ ] Al terminar el chat no queda historial en IndexedDB ni en el relay.
- [ ] Cualquiera puede salir en cualquier momento y el otro recibe aviso inmediato.
- [ ] Ambos usuarios ven el mismo código de verificación.
- [ ] Si nadie está disponible, la app lo informa y permite cancelar.

---

### Iteración 5 — Foros creados por usuarios *(2 semanas)*

**Objetivo:** que cualquier usuario cree un foro local y otros cercanos lo descubran.

**Historias**
- Como usuario, quiero crear un foro con nombre y alcance de barrio o sector.
- Como usuario, quiero ver los foros de usuario activos en mi celda.
- Como usuario fuera de la zona del foro, no quiero que aparezca ni que pueda usarlo.
- Como creador, quiero que el foro siga funcionando aunque yo me desconecte.

**Tareas técnicas**
- Vista V5 y pestañas "Cerca de mí" y "Mis foros" en V3.
- Relay: directorio efímero por geohash, `register_forum`, `list_forums`, expiración por inactividad.
- Re-registro automático del foro por cualquier miembro tras reinicio del relay.
- Reutilización de persistencia y sincronización de la Iteración 3.
- Eliminación de copias locales al caducar el foro.
- Regla: descubrir, leer y publicar solo dentro de la celda.

**⚠ Por definir:**
- **Tiempo de gracia de vida de un foro vacío** (propuesta: 24 h).
- Límite de foros que puede crear una persona o sesión (necesario aunque no haya antispam, para evitar saturación del directorio).
- Qué ocurre en el borde de una celda geohash (usuarios cercanos al límite). Propuesta: considerar la celda propia **más las 8 vecinas** para descubrir, pero publicar solo en la celda del foro.
- Reglas de nombres duplicados.
- Si el foro puede tener descripción y reglas de texto libre.

**Criterios de aceptación**
- [ ] Un usuario crea un foro y otro usuario en la misma celda lo ve y entra.
- [ ] Un usuario fuera de la celda no lo descubre ni puede entrar.
- [ ] El foro sigue activo cuando su creador se desconecta, mientras otro miembro esté conectado.
- [ ] Tras reiniciar el relay, el foro reaparece cuando un miembro se reconecta.
- [ ] Un foro sin miembros conectados más allá del tiempo de gracia desaparece del directorio y las copias cooperantes se eliminan al reconectarse.
- [ ] La interfaz comunica que el borrado no puede garantizarse en dispositivos desconectados.

---

### Iteración 6 — Endurecimiento, privacidad y pruebas con usuarios *(2 semanas)*

**Objetivo:** dejar el MVP estable, verificable y listo para un piloto cerrado.

**Historias**
- Como usuario, quiero entender claramente qué datos se comparten y cuáles no.
- Como equipo, queremos comprobar que el sistema cumple sus promesas de privacidad.
- Como equipo, queremos observar el sistema con usuarios reales.

**Tareas técnicas**
- Auditoría de privacidad: ningún evento contiene coordenadas exactas; el relay no registra IP ni contenido; revisión de cabeceras y logs de la plataforma de hosting.
- Firma de mensajes de foro con la clave de sesión del autor y verificación en cliente.
- Renovación de sesión (nuevo alias y claves) desde Ajustes.
- Pruebas extremo a extremo con Playwright (varios contextos): desconexiones, reconexiones, sincronización, borrado.
- Pruebas de carga básicas del relay (p. ej., 200–500 conexiones simulando salas).
- Pulido de estados vacíos, errores y accesibilidad.
- Vista V8 y textos legales finales.
- Observabilidad mínima **sin datos personales**: contadores agregados en memoria (conexiones, salas, mensajes por minuto).
- Piloto cerrado con 10–30 personas y encuesta breve.

**⚠ Por definir:**
- **Términos de uso y política de privacidad** (textos reales); responsable legal del servicio y legislación aplicable de protección de datos.
- Plan de **contenido ilegal**: aunque no haya moderación en el MVP, definir un canal de contacto y la capacidad de cerrar un foro o salas desde el relay ante contenido grave.
- Criterios de salida del piloto y métricas de éxito (ver sección 8).
- Estrategia de rotación de la clave de firma del relay.

**Criterios de aceptación**
- [ ] La auditoría confirma que no se transmiten coordenadas exactas ni se registran IP o contenido.
- [ ] Las pruebas extremo a extremo de los tres tipos de comunicación pasan en CI.
- [ ] El relay soporta la carga objetivo definida sin pérdida de mensajes en la prueba.
- [ ] Un usuario puede renovar su sesión y su alias anterior deja de estar asociado a su clave.
- [ ] Se ejecutó un piloto cerrado y se documentaron los problemas encontrados.
- [ ] Términos y política de privacidad publicados y enlazados desde la app.
- [ ] Todos los criterios de aceptación del MVP (sección 7.1) se cumplen.

---

### 7.1 Criterios de aceptación globales del MVP

- Ningún servidor guarda mensajes: el relay solo reenvía y firma.
- Dos usuarios en una zona conversan sin ver nunca la IP del otro.
- Los mensajes se guardan localmente y se sincronizan entre participantes conectados.
- Un recién llegado recupera el historial si hay al menos un par conectado (o el archivista) con copia; si no, la app lo informa.
- Un foro permanente conserva su identidad sin importar quién lo creó.
- Un foro de usuario sigue disponible mientras algún participante esté conectado y desaparece de las copias cooperantes cuando caduca.
- Los chats aleatorios terminan sin conservar historial y están cifrados extremo a extremo.
- Las reglas de acceso geográfico funcionan con la ubicación del dispositivo, reconociendo que puede falsificarse.
- La app es instalable como PWA y usable en móvil.

### 7.2 Resumen del cronograma

| Iteración | Funcionalidad | Duración |
|---|---|---|
| 0 | Cimientos y prueba técnica | 3–5 días |
| 1 | Zonas, geolocalización y esqueleto | 2 semanas |
| 2 | Foros permanentes en vivo | 2 semanas |
| 3 | Persistencia y sincronización | 2 semanas |
| 4 | Chat aleatorio cifrado | 1,5–2 semanas |
| 5 | Foros creados por usuarios | 2 semanas |
| 6 | Endurecimiento y piloto | 2 semanas |
| **Total** | | **≈ 12–14 semanas** |

---

## 8. Cuestiones abiertas por definir

Resumen consolidado, ordenado por urgencia.

### 8.1 Bloqueantes tempranas (antes de la Iteración 2)

1. **Zona inicial y catálogo de zonas** (polígonos, nombres, IDs estables).
2. **Proveedor de hosting** del frontend y del relay; presupuesto mensual estimado.
3. **Nombre del proyecto y dominio** (necesario para HTTPS y PWA).

### 8.2 De producto

4. Tiempo de gracia de foros de usuario vacíos (propuesta: 24 h).
5. Límite de foros por persona y de mensajes por foro.
6. Duración del alias (sesión, día o hasta renovación manual).
7. Tamaño máximo y política de recorte del historial local.
8. Comportamiento en bordes de celda geohash (propuesta: 8 vecinas para descubrir).
9. Si el emparejamiento aleatorio exige estar físicamente en la zona.

### 8.3 Técnicas

10. Uso de **archivista**: sí o no para el piloto.
11. Rotación y almacenamiento seguro de la clave de firma del relay.
12. Compatibilidad real de PWA en iOS (límites de almacenamiento, suspensión en segundo plano).
13. Proveedor de tiles de mapa si OSM no basta.
14. Estrategia de escalado del relay (una instancia en el MVP; si crece, requiere un bus entre instancias).

### 8.4 Legales y de operación

15. Términos de uso, política de privacidad, edad mínima y legislación aplicable.
16. Procedimiento ante contenido ilegal (contacto y capacidad de cerrar salas) **antes** del piloto.
17. Métricas de éxito del MVP (propuestas):
    - Usuarios activos semanales en el piloto.
    - Porcentaje de sesiones con al menos un mensaje enviado.
    - Porcentaje de entradas a foro con historial recuperado correctamente.
    - Tiempo medio de emparejamiento en el chat aleatorio.

---

## 9. Riesgos y limitaciones aceptadas

| Riesgo | Impacto | Tratamiento en el MVP |
|---|---|---|
| GPS falsificado | Se puede publicar sin estar en la zona. | Aceptado; validación funcional. |
| El relay conoce las IP | Un relay malicioso puede observar conexiones. | Aceptado; sin logs; informado en privacidad. |
| Relay como punto único de fallo | Si cae, nadie se comunica. | Reconexión automática; mensaje claro; redespliegue rápido. |
| Pocos pares conectados | Historial intermitente. | Mensaje honesto; archivista opcional. |
| Pestañas suspendidas en móvil | Menos pares disponibles. | Reconexión y sincronización por `since`. |
| Almacenamiento del navegador limitado o borrado | Pérdida de copias locales. | `storage.persist()` y aviso; política de recorte. |
| Suplantación de claves en el chat por el relay | Posible intermediario en el cifrado. | Código de verificación; riesgo aceptado. |
| Par malicioso inyecta historial falso | Mensajes falsos en copias. | Firma del relay verificada por el cliente. |
| Ausencia de moderación | Abuso o contenido ilegal. | Piloto cerrado y pequeño; canal de contacto y cierre de salas; moderación obligatoria antes de abrir. |
| Saturación del relay | Caída por conexiones o mensajes excesivos. | Límites mínimos de tamaño y de conexiones por IP. |
| Correlación de alias por metadatos | Pérdida de anonimato. | Reducir identificadores persistentes; renovar sesión. |
| Borrado no garantizado | Copias antiguas pueden persistir. | Comunicado en la interfaz y en términos. |

---

## 10. Definición de terminado, calidad y organización

### 10.1 Definición de terminado (DoD) por historia

- Código revisado (pull request) y fusionado en la rama principal.
- Pruebas unitarias de la lógica nueva y, si aplica, prueba extremo a extremo.
- Esquemas del protocolo actualizados en `packages/protocol`.
- Funciona en Chrome Android y Safari iOS (mínimo).
- Sin coordenadas exactas ni datos personales en eventos o logs.
- Criterios de aceptación de la historia verificados y demostrados.

### 10.2 Estructura del repositorio

```
/
├─ apps/
│  ├─ web/         # PWA React
│  ├─ relay/       # Servidor Node + Socket.IO
│  └─ archivist/   # (opcional) cliente Node que conserva copias
├─ packages/
│  └─ protocol/    # Tipos, esquemas zod, zones.json, constantes
├─ docs/           # Este plan, decisiones de arquitectura (ADR)
└─ .github/workflows/
```

### 10.3 Ceremonias sugeridas

- **Planificación** al inicio de cada iteración: elegir historias y cerrar los "por definir".
- **Demo** al final: mostrar la funcionalidad con dos dispositivos reales.
- **Retrospectiva** breve: qué dificultades del mundo real aparecieron.
- Registrar decisiones importantes como ADR cortos en `docs/`.

---

## 11. Después del MVP

Orden sugerido de prioridades:

1. **Moderación:** reportes, bloqueo y límites antispam (obligatorios antes de abrir al público).
2. **Cifrado de grupo** opcional para foros privados.
3. **Verificación de ubicación más robusta** (señales adicionales, no solo GPS).
4. **WebRTC directo** para el chat 1 a 1 como optimización opcional (con TURN y relay forzado si se quiere ocultar IP).
5. **Escalado del relay** (varias instancias con un bus de mensajes) y relays comunitarios.
6. **Más contenido:** imágenes y respuestas a mensajes.
7. **Aplicación nativa** reutilizando el protocolo y las reglas ya definidas.

---

*Fin del documento. Versión 1.1 — sujeta a revisión al cerrar las cuestiones abiertas de la sección 8.*
