# 🗺️ DIAGRAMA DE ARQUITECTURA - ZonaViva

**Visualización completa del sistema, flujos de datos y dependencias**

---

## 1. ARQUITECTURA GENERAL

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              ZONAVIVA PLATFORM                                   │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────┐  ┌──────────────────────────────────┐
│         CLIENT LAYER (WEB)              │  │     SERVER LAYER                 │
│       (apps/web - Vite + React)         │  │  (apps/relay - Node.js)          │
│                                         │  │                                  │
│  ┌──────────────────────────────────┐  │  │  ┌──────────────────────────────┐│
│  │   UI LAYER (Components)          │  │  │  │   Socket.io Server           ││
│  │  - Pages (Inicio, Foro, Chat)   │  │  │  │   - Room management          ││
│  │  - Components (Map, Zone, GPS)  │  │  │  │   - Message routing          ││
│  └────────────┬─────────────────────┘  │  │  │   - Signature validation     ││
│               │                        │  │  │   - Message caching (24h)    ││
│               ↓                        │  │  │   - Relay signing            ││
│  ┌──────────────────────────────────┐  │  │  └──────────────────────────────┘│
│  │   GEO SERVICES LAYER (/geo)      │  │  │                                  │
│  │  - zoneCatalog.ts (Índice)      │  │  │  ┌──────────────────────────────┐│
│  │  - accessPolicy.ts (Reglas)    │  │  │  │   P2P Protocol               ││
│  │  - locationService.ts (GPS)    │  │  │  │   - ULID message IDs         ││
│  │  - geoCore.ts (Funciones puras)│  │  │  │   - Signature schemes        ││
│  └────────────┬─────────────────────┘  │  │  │   - Message ordering        ││
│               │                        │  │  └──────────────────────────────┘│
│               ↓                        │  │                                  │
│  ┌──────────────────────────────────┐  │  └──────────────────────────────────┘
│  │   STATE MANAGEMENT (Zustand)     │  │
│  │  - geoStore (Posición + Zonas)  │  │  ┌──────────────────────────────┐
│  │  - forumStore (Foros + Msgs)    │  │  │   ARCHIVIST LAYER            │
│  │  - identityStore (User)         │  │  │   (apps/archivist - Node.js) │
│  └────────────┬─────────────────────┘  │  │                              │
│               │                        │  │  - Histórico de mensajes   │
│               ↓                        │  │  - Recuperación de datos   │
│  ┌──────────────────────────────────┐  │  │  - Analytics               │
│  │   LOCAL STORAGE LAYER            │  │  └──────────────────────────────┘
│  │  - IndexedDB (Mensajes)         │  │
│  │  - LocalStorage (Preferencias)  │  │
│  └──────────────────────────────────┘  │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│              SHARED LAYER (@zonaviva/protocol)                                   │
│  - Types (Zone, Message, Forum, User, Session)                                 │
│  - Zod Schemas (Validación)                                                    │
│  - Constants (Geohash precision, timeouts, radii)                              │
│  - Zone Catalog (zones.json, zones.index.json, zones.geo.json)                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. FLUJO DE DATOS - LIFECYCLE COMPLETO

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                     USER JOURNEY - COMPLETE FLOW                              │
└──────────────────────────────────────────────────────────────────────────────┘

                              1. APP STARTUP
                              ─────────────

    User opens https://localhost:5173
                    ↓
    main.tsx → App.tsx
                    ↓
    useEffect: geoStore.startWatching()
                    ↓
    locationService.startWatchingPosition(
      onUpdate: (position) → {...},
      onError: (error) → {...}
    )
                    ↓
    Browser: "May this site access your location?"
                    ↓
        ┌─── User clicks "Allow" ───┐
        │                           │
        ↓                           ↓
    Browser gets GPS          Browser blocks GPS
    accuracy: 87m             ❌ Status: 'denied'
        ↓
    locationService emits onUpdate
        ↓
    
    
                        2. POSITION UPDATE
                        ──────────────────

    onUpdate(UserPosition {
      latitude: -15.8402,
      longitude: -70.0219,
      accuracy: 87,
      timestamp: Date.now()
    })
        ↓
    geoStore.setState({
      userPosition,
      userCells: getUserCells(position)
        → cellsTouchingCircle(-15.8402, -70.0219, 87, 7)
        → ["6mnjye4", "6mnjye5", "6mnjyeh", "6mnjye2"]
      detectedZones: getAccessibleZones(position)
        → getZonesByCells([...userCells])
        → [{id: "puno-centro", name: "Centro de Puno", ...}]
    })
        ↓
    Zustand notifies subscribers
        ↓
    React re-renders InicioPage
        ↓
    ┌─────────────────────────┐
    │ InicioPage UI updates:  │
    │ ✓ Zone: "Centro"        │
    │ ✓ GPS: ✓ Activo (±87m) │
    │ ✓ Map updates          │
    └─────────────────────────┘


                      3. USER PUBLISHES MESSAGE
                      ────────────────────────

    User in ChatPage of "puno-centro" zone
    Writes: "Hola!"
    Clicks "Send"
                    ↓
    ChatPage calls forumStore.publishMessage(
      content: "Hola!",
      session: UserSession,
      zone: Zone
    )
                    ↓
    forumStore validates:
      canPublishInZoneForum(userPosition, zoneId)
        ✓ Position fresh? (< 60s)
        ✓ Position accurate? (<= 300m)
        ✓ Circle touches zone cells?
                    ↓
    Creates Message {
      id: generateULID(),
      forumId: "zone:puno-centro",
      content: "Hola!",
      alias: "Usuario123",
      authorKey: publicKey,
      clientTs: Date.now(),
      sig: HMAC(content, privateKey)
    }
                    ↓
    socket.emit('message', message)
    ────────────────────────────────→ WebSocket
                                      ↓
                              RELAY RECEIVES
                              ─────────────
                                      
                              relay.socket.on('message', msg)
                                      ↓
                              Validates:
                              1. verify(sig, content, authorKey) ✓
                              2. messageId not in cache ✓
                              3. clientTs not too old ✓
                                      ↓
                              relay.sig = HMAC(content, relayKey)
                              relay.relayTs = Date.now()
                                      ↓
                              relay.cache.add(message)
                              relay.seenMessages.add(messageId)
                                      ↓
                              socket.broadcast.to('zone:puno-centro')
                                .emit('message', message)
                              
                              ←────────── Broadcast to other users
                    ↓
    OTHER USERS RECEIVE
    ──────────────────
                    ↓
    socket.on('message', message)
                    ↓
    forumStore.addMessage(message)
                    ↓
    1. Verify: HMAC(content, authorKey) ✓
    2. Save to IndexedDB: db.messages.add(message)
                    ↓
    ChatPage re-renders
                    ↓
    ┌──────────────────────┐
    │ Chat shows:          │
    │ [Usuario123] Hola!   │
    │ 2 seconds ago        │
    └──────────────────────┘


                    4. USER CHANGES LOCATION
                    ───────────────────────

    User walks 30 meters
                    ↓
    GPS detects new position:
    { lat: -15.8405, lng: -70.0225, accuracy: 85 }
                    ↓
    locationService calculates:
      distance = distanceMeters(
        -15.8402, -70.0219,    ← old
        -15.8405, -70.0225     ← new
      ) = ~30 meters
                    ↓
    >= MIN_MOVEMENT_THRESHOLD (25m)?
    ✓ YES → emit onUpdate
                    ↓
    geoStore recalculates:
      newCells: ["6mnjye4", "6mnjye5", "6mnjyeh"]
      newZones: ["puno-centro"]
                    ↓
    Did zones change?
    ✓ NO (still "puno-centro")
    Continue same context
                    ↓
    User walks 500 meters
                    ↓
    GPS: new position far away
    distance = ~500 meters
                    ↓
    geoStore recalculates:
      newCells: ["6mnjyf2", "6mnjyf3"]
      newZones: ["puno-puerto"] ← CHANGED!
                    ↓
    InicioPage shows:
    "Now in: Puerto y Lago Titicaca"
```

---

## 3. DATA FLOW - GEOLOCATION SERVICES

```
┌────────────────────────────────────────────────────────────────────────┐
│              GEOLOCATION SERVICES INTEGRATION DIAGRAM                   │
└────────────────────────────────────────────────────────────────────────┘

                    Browser Geolocation API
                    (native, not our code)
                            ↑
                            │ High accuracy
                            │ Sample every 1-5s
                            │
        ┌───────────────────┴──────────────────┐
        │                                      │
    locationService.ts                       locationService.ts
    watchPosition() → onUpdate              watchPosition() → onError
        │                                      │
        ↓                                      ↓
    UserPosition {                         GeolocationPositionError
      latitude: -15.8402,                  {
      longitude: -70.0219,                   code: 1|2|3 (PERMISSION_DENIED|...)
      accuracy: 87,                          message: string
      timestamp: 1729xxx                   }
    }                                        │
        │                                    ↓
        │                          geoStore.setState({
        │                            status: 'error'|'denied',
        │                            error: message
        │                          })
        │
        ├─ Filter movement ────────────────────────────────────────┐
        │  if (distance >= MIN_MOVEMENT_THRESHOLD) {               │
        │    continue                                              │
        │  } else {                                                │
        │    return (skip)                                         │
        │  }                                                       │
        │                                                          │
        │  ← Prevents spam updates, saves CPU                     │
        │                                                          │
        ↓                                                          │
    geoStore.setState({                                           │
      userPosition: position,                                     │
      userCells: [                          ← geoCore.ts         │
        ...cellsTouchingCircle(              (pure functions)    │
          lat, lng, radius=87, precision=7                       │
        )                                                         │
      ],                                                          │
      detectedZones: [                      ← zoneCatalog.ts    │
        ...getZonesByCells(userCells)        (index lookup)     │
      ]                                                           │
    })                                                            │
        │                                                         │
        ↓                                                         │
    Zustand notifies subscribers                                  │
        │                                                         │
        ├─→ InicioPage         (re-render)   ────────────────────┘
        ├─→ ChatPage           (re-render)
        ├─→ ForoPage           (re-render)
        ├─→ ZoneMap            (re-render)
        └─→ Custom hooks       (re-render)
```

---

## 4. ZONE DETECTION LOGIC

```
┌────────────────────────────────────────────────────────────────────────┐
│            HOW ZONES ARE DETECTED FROM GPS POSITION                    │
└────────────────────────────────────────────────────────────────────────┘

INPUT:
  User location: (-15.8402, -70.0219)
  GPS accuracy: 87 meters (circular uncertainty)
  
  Visualization:
  
    ┌─────────────┐
    │  87m radius │
    │  circle     │
    │  around     │
    │  user ●     │
    └─────────────┘
    
    Map cells (153m × 153m each):
    ┌──────┬──────┬──────┐
    │6mn..4│6mn..5│6mn..h│
    ├──────┼──────┼──────┤
    │6mn..2│●U ←──┤6mn..3│ ← User + circle
    ├──────┼──────┼──────┤
    │6mn..6│6mn..7│6mn..k│
    └──────┴──────┴──────┘

┌─ STEP 1: CALCULATE EFFECTIVE RADIUS ────────────────────────────────┐
│                                                                      │
│  effectiveRadius = Clamp(accuracy, MIN=50, MAX=150)                │
│                                                                      │
│  if (87 >= 50 && 87 <= 150) return 87                              │
│  if (40 < 50) return 50                                             │
│  if (200 > 150) return 150                                          │
│                                                                      │
│  Result: radius = 87 meters                                         │
└──────────────────────────────────────────────────────────────────────┘

┌─ STEP 2: FIND CELLS TOUCHING CIRCLE ────────────────────────────────┐
│                                                                      │
│  cells = cellsTouchingCircle(                                        │
│    lat=-15.8402,                                                    │
│    lng=-70.0219,                                                    │
│    radius=87,                                                        │
│    precision=7                                                      │
│  )                                                                   │
│                                                                      │
│  Algorithm:                                                         │
│  1. Get center cell: "6mnjye4"                                      │
│  2. Get neighbors: ["6mnjye5", "6mnjyeh", ...]                     │
│  3. For each cell:                                                  │
│     - Decode cell → bbox (rectangle)                               │
│     - Calculate distance from center to bbox                       │
│     - If distance <= radius: INCLUDE                               │
│  4. Return all included cells                                       │
│                                                                      │
│  Result: cells = ["6mnjye4", "6mnjye5", "6mnjyeh", "6mnjye2"]     │
└──────────────────────────────────────────────────────────────────────┘

┌─ STEP 3: MAP CELLS TO ZONES ────────────────────────────────────────┐
│                                                                      │
│  For each cell in cells:                                            │
│    zoneId = zoneIndex[cell]                                         │
│                                                                      │
│  zoneIndex is: {"6mnjye4": "puno-centro", ...}                    │
│                                                                      │
│  Lookups:                                                           │
│    "6mnjye4" → "puno-centro"                                        │
│    "6mnjye5" → "puno-centro"                                        │
│    "6mnjyeh" → "puno-centro"                                        │
│    "6mnjye2" → "puno-centro"                                        │
│                                                                      │
│  Result: zones = ["puno-centro"]                                    │
└──────────────────────────────────────────────────────────────────────┘

OUTPUT:
  Detected zones: ["puno-centro"]
  
  User can publish to: ["puno-centro"]
  User can see buttons: "Chat de Centro de Puno"
```

---

## 5. DEPENDENCY GRAPH

```
┌────────────────────────────────────────────────────────────────────────┐
│                   MODULE DEPENDENCY DIAGRAM                            │
└────────────────────────────────────────────────────────────────────────┘

                        @zonaviva/protocol
                        (Shared Types & Data)
                               ↑
                    ┌──────────┼──────────┐
                    │          │          │
                    
        geoCore.ts        zoneCatalog.ts   accessPolicy.ts
        (Pure Functions)  (Zone Catalog)   (Access Rules)
            ↑                  ↑                ↑
            │                  │                │
            └──────────┬───────┴────────┬───────┘
                       │                │
                  locationService.ts   geoStore.ts
                  (GPS Service)        (State Management)
                       ↑                    ↑
                       │                    │
                       └────────┬───────────┘
                                │
                        Components & Pages
                        - InicioPage
                        - ChatPage
                        - ForoPage
                        - ZoneMap
                        - StatusDot
                               
Dependencies flow:
- geoCore: NO dependencies (pure)
- zoneCatalog: depends on geoCore (for zone lookups)
- accessPolicy: depends on geoCore + zoneCatalog
- locationService: NO dependencies on other geo services
- geoStore: depends on locationService + accessPolicy
- Components: depend on geoStore only (not direct geo services)
```

---

## 6. DATA STRUCTURES - FLOW

```
┌────────────────────────────────────────────────────────────────────────┐
│                    KEY DATA STRUCTURES FLOW                            │
└────────────────────────────────────────────────────────────────────────┘

USER POSITION
─────────────
  interface UserPosition {
    latitude: number;        ← GPS sensor
    longitude: number;       ← GPS sensor
    accuracy: number;        ← GPS sensor (standard deviation)
    timestamp: number;       ← Date.now()
  }
        ↓
   Process: locationService.startWatchingPosition()
        ↓
   Output: geoStore.userPosition


USER CELLS
──────────
  string[]  ← Array of geohash strings
  
  Generation:
  1. Get userPosition
  2. Calculate effective radius
  3. Call cellsTouchingCircle()
  4. Returns: ["6mnjye4", "6mnjye5", "6mnjyeh", ...]
  
  Storage: geoStore.userCells


DETECTED ZONES
──────────────
  Zone[]  ← Array of Zone objects
  
  Generation:
  1. Get userCells
  2. For each cell, lookup zoneId in index
  3. Collect unique zones
  4. Return Zone[] with full data
  
  Each Zone {
    id: string;           ← "puno-centro"
    name: string;         ← "Centro de Puno"
    description: string;
    type: "permanent";
    cells: string[];      ← All cells in zone
  }
  
  Storage: geoStore.detectedZones


MESSAGE
───────
  interface Message {
    id: string;           ← ULID (client-generated)
    forumId: string;      ← "zone:puno-centro"
    content: string;
    alias: string;        ← "User123" (anonymous)
    authorKey: string;    ← Public key (hex/base64)
    clientTs: number;     ← Date.now()
    relayTs?: number;     ← Assigned by relay
    sig: string;          ← HMAC(content, privateKey)
    sig_relay?: string;   ← HMAC(content, relayKey)
  }
  
  Lifecycle:
  1. Create in ChatPage
  2. Add sig (author sign)
  3. Send to relay via socket
  4. Relay validates + adds sig_relay
  5. Relay broadcasts to others
  6. Others receive + verify sig
  7. Save to IndexedDB
  
  Storage: forumStore.messages[forumId]
           IndexedDB: 'messages' table
```

---

## 7. PERMISSION & VALIDATION FLOW

```
┌────────────────────────────────────────────────────────────────────────┐
│          VALIDATION PIPELINE FOR PUBLISHING MESSAGES                   │
└────────────────────────────────────────────────────────────────────────┘

START: User clicks "Send" button
        ↓
   [ Access Policy Check ]
        ↓
    ┌─ isPositionFresh()
    │  if (Date.now() - position.timestamp > 60000ms) {
    │    REJECT: "Ubicación desactualizada"
    │  }
    ├ PASS?
    │        ↓
    ├─ isPositionAccurate()
    │  if (position.accuracy > 300m) {
    │    REJECT: "Precisión insuficiente (400m)"
    │  }
    ├ PASS?
    │        ↓
    ├─ circularIntersectsZone()
    │  cells = cellsTouchingCircle(lat, lng, radius)
    │  if (getZoneIdByCell(cell) NOT IN cells) {
    │    REJECT: "No estás en esta zona"
    │  }
    ├ PASS?
    │        ↓
    ├─ ALLOW PUBLISH ✓
    │        ↓
    └─[ Message Creation ]
        ↓
   [ Client-Side Signing ]
        ↓
    sig = HMAC(content, privateKey)
        ↓
   [ Send to Relay via Socket ]
        ↓
        ~~~~ WebSocket transmission ~~~~
        ↓
   [ Relay Validation ]
        ↓
    ┌─ verifySignature()
    │  HMAC(content, authorKey) === sig?
    │  REJECT if false
    ├ PASS?
    │        ↓
    ├─ checkDuplicate()
    │  messageId in seenMessages?
    │  REJECT if yes
    ├ PASS?
    │        ↓
    ├─ checkTimestamp()
    │  clientTs not > 24 hours old?
    │  REJECT if old
    ├ PASS?
    │        ↓
    ├─ ADD TO CACHE & BROADCAST
    │  relay.cache[forumId].add(message)
    │  relay.sig = HMAC(content, relayKey)
    │  relay.relayTs = Date.now()
    │  socket.broadcast.to(forumId).emit(message)
    │        ↓
    └─[ Recipients Receive ]
         ↓
        ~~~~ WebSocket reception ~~~~
         ↓
    [ Recipient Validation ]
         ↓
    verifySignature(message.sig, message.content, message.authorKey)
         ↓
    ACCEPT: Save to IndexedDB
         ↓
    ChatPage.tsx re-renders with new message
```

---

## 8. OFFLINE FUNCTIONALITY

```
┌────────────────────────────────────────────────────────────────────────┐
│            OFFLINE-FIRST ARCHITECTURE                                  │
└────────────────────────────────────────────────────────────────────────┘

SCENARIO 1: Online Mode (Connected to Relay)
─────────────────────────────────────────────

  User action
       ↓
  geoStore/forumStore update
       ↓
  Send to relay via Socket.io
       ↓
  Relay validates & broadcasts
       ↓
  Others receive in real-time
       ↓
  ALSO: Save locally to IndexedDB (redundancy)


SCENARIO 2: Offline Mode (No Connection)
─────────────────────────────────────────

  User writes message
       ↓
  [ Service Worker detects offline ]
       ↓
  Message queued in IndexedDB
  NOT sent to relay (yet)
       ↓
  UI shows: "Message pending" ⏳
       ↓
  [ User regains connection ]
       ↓
  Service Worker detects online
       ↓
  Queue processor:
    for each queued message {
      send to relay
      mark as sent
    }
       ↓
  UI updates: "Message sent" ✓
       ↓
  Relay processes normally


SCENARIO 3: Multiple Offline Users Meet
────────────────────────────────────────

  User A (offline)  ← [Gap] → User B (offline)
  
  Both write messages
       ↓
  Both have local IndexedDB copies
  Both show in their local chat
  Others don't see (no relay)
       ↓
  [ Both go online ]
       ↓
  Both send messages to relay
       ↓
  Relay merges, assigns timestamps
       ↓
  Both download merged history
       ↓
  Chat is now synchronized
```

---

## 9. SECURITY FLOW

```
┌────────────────────────────────────────────────────────────────────────┐
│                 CRYPTOGRAPHIC SECURITY FLOW                            │
└────────────────────────────────────────────────────────────────────────┘

SESSION CREATION (One-time per user)
────────────────────────────────────

  [ User Clicks "Create Session" ]
       ↓
  identityStore.createSession()
       ↓
  Generate keypair:
    publicKey = crypto.generateKey()
    privateKey = crypto.generateKey()
       ↓
  Generate alias:
    alias = random name + emoji
       ↓
  Store locally:
    - publicKey (can share)
    - privateKey (NEVER share, never send to relay)
    - alias (ephemeral identity)
    - sessionId = ULID()
       ↓
  Session persisted in IndexedDB


MESSAGE SIGNING & VERIFICATION
──────────────────────────────

  [ Author Signs ]                    [ Relay Validates ]
  
  Message {                           Receives Message
    content: "Hola!",                 
  }                                   verify(
       ↓                                sig,
                                        content,
  sig = HMAC(                           authorKey
    message=content,            
    key=privateKey              ✓ PASS → Continue
  )                             ✗ FAIL → Reject
  
  Message {
    content: "Hola!",          [ Recipients Verify ]
    sig: <hash>,
    authorKey: <public>        Receives Message
  }
       ↓                        
  Send to relay               verify(
                                sig,
  ~~~~ WebSocket ~~~~           content,
                                authorKey
  Relay receives             
       ↓                      ✓ PASS → Show message
  validate signature         ✗ FAIL → Reject
       ↓
  Add relay signature:
    sig_relay = HMAC(
      message=content,
      key=relayKey
    )
       ↓
  Broadcast to others


ATTACK PREVENTION
─────────────────

  Attack: Replay message duplicate
  Prevention:
    relay.seenMessages = Set()
    if (messageId in seenMessages) REJECT
    else seenMessages.add(messageId)
    
  Attack: Modify message content
  Prevention:
    sig = HMAC(content, privateKey)
    If content changed → sig no longer valid
    Recipient detects tampering
    
  Attack: Impersonate user
  Prevention:
    Only person with privateKey can create valid sig
    Relay broadcasts sig for verification
    Others verify with publicKey
    
  Attack: Send from wrong zone
  Prevention:
    Client-side: canPublishInZoneForum() gates publication
    This is NOT enforced server-side (no server knows coords)
    Users police themselves (UX/social pressure)
    Relay only ensures message authenticity
```

---

## 10. DEPLOYMENT ARCHITECTURE

```
┌────────────────────────────────────────────────────────────────────────┐
│                    PRODUCTION DEPLOYMENT                               │
└────────────────────────────────────────────────────────────────────────┘

PRODUCTION SETUP
────────────────

┌──────────────────────────────────────────────────────────────────────┐
│ CDN (Cloudflare / AWS CloudFront)                                   │
│  - Static assets (JS, CSS, images)                                  │
│  - Caching strategy: 1 year for versioned assets                    │
│  - Invalidate on deploy                                              │
└──────────────────────────────────────────────────────────────────────┘
                              ↑
                              │
                   dist/index.html (no cache)
                   dist/assets/*.js (hash-versioned)
                   
┌──────────────────────────────────────────────────────────────────────┐
│ Web Server (Nginx / Apache)                                          │
│  - Serve static files                                                │
│  - Reverse proxy to relay                                            │
│  - HTTPS termination                                                 │
│  - CORS headers                                                      │
└──────────────────────────────────────────────────────────────────────┘
       ↑
       │
    /api/* → Relay
    /socket.io → Relay WebSocket

┌──────────────────────────────────────────────────────────────────────┐
│ Relay Cluster                                                        │
│  - Multiple instances for scalability                                │
│  - Load balanced (Round-robin)                                       │
│  - Shared message cache (Redis)                                      │
│  - Database for persistence                                          │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│ Archivist (Historical Storage)                                       │
│  - PostgreSQL / MongoDB                                              │
│  - Archive old messages (>24h)                                       │
│  - Analytics queries                                                 │
└──────────────────────────────────────────────────────────────────────┘

MONITORING & METRICS
────────────────────

  Collect:
  - User count online
  - Messages per second
  - Relay response time
  - Zone popularity
  - Error rates
  
  Tools:
  - Prometheus (metrics collection)
  - Grafana (dashboards)
  - Sentry (error tracking)
  - LogRocket (session replay)
```

---

## CONCLUSIÓN

Este diagrama de arquitectura muestra:

1. **Capas bien definidas**: UI → Servicios → Storage → Protocol
2. **Flujos de datos claros**: Desde GPS hasta publicación
3. **Validaciones en múltiples puntos**: Cliente + servidor
4. **Offline-first design**: Funciona sin conexión
5. **Security by design**: Firmas cryptográficas, sin compartir coordenadas

**Para más detalles técnicos**, consulta:
- `INFORME_TECNICO_COMPLETO.md` - Documentación profunda
- `GUIA_PRACTICA_DESARROLLO.md` - Guía de codificación
- Código fuente comentado
