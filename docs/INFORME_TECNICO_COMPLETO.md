# 📚 INFORME TÉCNICO COMPLETO - ZonaViva

**Plataforma de Red Social Geográfica con Foros P2P Descentralizados**

**Fecha:** 2 de noviembre de 2026  
**Versión:** 3.1 (Zonas Oficiales OSM, Distinción Visual y Topología Sin Islas)  
**Estado:** En Desarrollo - Fase 3 Completada & Zonas Reestructuradas ✅

---

## 📖 Tabla de Contenidos

1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Arquitectura General](#arquitectura-general)
3. [Stack Tecnológico](#stack-tecnológico)
4. [Estructura del Proyecto](#estructura-del-proyecto)
5. [Conceptos Clave](#conceptos-clave)
6. [Módulos Principales](#módulos-principales)
7. [Flujo de Datos](#flujo-de-datos)
8. [Guía Técnica por Componente](#guía-técnica-por-componente)
9. [Privacidad y Seguridad](#privacidad-y-seguridad)
10. [Procedimientos de Desarrollo](#procedimientos-de-desarrollo)

---

# 1. RESUMEN EJECUTIVO

## Visión General

**ZonaViva** es una plataforma de red social geográfica que permite a usuarios comunicarse en foros temáticos basados en su ubicación. La innovación principal es que:

- ✅ **Completamente descentralizada**: Los foros son P2P (peer-to-peer), no hay servidor central
- ✅ **Basada en geolocalización**: Solo se puede publicar si estás en la zona correcta
- ✅ **Privada por diseño**: La posición exacta NUNCA se envía al servidor
- ✅ **Offline-first**: Funciona sin conexión, se sincroniza cuando hay red

## Piloto Inicial

- **Ubicación:** Puno, Perú
- **Zonas Oficiales:** 6 zonas delimitadas matemáticamente desde OpenStreetMap (OSM GeoJSON):
  1. `mercado-central`: Mercado Central de Puno (`#f97316`)
  2. `mercado-union`: Mercado Unión y Dignidad (`#ec4899`)
  3. `mercado-bellavista`: Mercado Bellavista (`#eab308`)
  4. `plaza-mayor`: Plaza Mayor de Puno (`#8b5cf6`)
  5. `parque-pino`: Parque Pino (`#10b981`)
  6. `unap-campus`: Universidad Nacional del Altiplano (`#0284c7`)
- **Topología Estricta:** Cero Solapamiento (0 celdas compartidas) y Cero Islas (100% conectividad contigua en cada zona)
- **Iteración actual:** 5

## Objetivos de Fase 2 (COMPLETADOS ✅)

1. ✅ Implementar catálogo de zonas con geohashes
2. ✅ Crear servicios de geolocalización
3. ✅ Integrar con store (Zustand)
4. ✅ Validar acceso basado en posición
5. ✅ Preparar UI para Fase 3

---

# 2. ARQUITECTURA GENERAL

## 2.1 Arquitectura de Alto Nivel

```
┌─────────────────────────────────────────────────────────────────┐
│                     ZonaViva - Stack Completo                   │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                         WEB (Vite + React)                       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  UI Layers (Components, Pages)                             │ │
│  │  - ZoneMap, InicioPage, ForoPage, ChatPage                 │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Geolocation Services (/geo)                               │ │
│  │  - zoneCatalog, accessPolicy, locationService              │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Stores (Zustand)                                          │ │
│  │  - geoStore, forumStore, identityStore                     │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Local Storage / IndexedDB (Offline)                       │ │
│  └────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
           ↑                                          ↑
           │ (WebSocket)                             │ (HTTPS)
           │                                         │
┌──────────────────────────────────────────────────────────────────┐
│                    RELAY (Node.js + Socket.io)                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  P2P Message Routing                                       │ │
│  │  - Recibe y distribuye mensajes entre nodos                │ │
│  │  - Cache temporal de mensajes (24h)                        │ │
│  │  - Gestión de salas de foro                                │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Validación de Firmas                                      │ │
│  │  - Verifica firmas de relay                                │ │
│  │  - Rechaza mensajes inválidos                              │ │
│  └────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
           ↑                                          ↑
           │ (P2P)                                   │ (Storage)
           │                                         │
┌──────────────────────────────────────────────────────────────────┐
│                   ARCHIVIST (Node.js)                            │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Archivado Histórico                                       │ │
│  │  - Almacena mensajes históricos                            │ │
│  │  - Recuperación de datos antiguos                          │ │
│  └────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│               PROTOCOL (@zonaviva/protocol)                      │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Tipos, Esquemas, Constantes Compartidas                  │ │
│  │  - Zone, Message, Forum, User                              │ │
│  │  - Validación con Zod                                      │ │
│  │  - Catálogo de zonas (zones.json)                          │ │
│  └────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

## 2.2 Topología de Datos

```
Navegador del Usuario A        Navegador del Usuario B        Relay Central
      ↓                               ↓                           ↓
   [Foro X]                      [Foro X]                    [Foro X Cache]
   Msg 1-50                      Msg 1-100                   Msg 1-200
   
   ↑─────────────────────────────────────────────────────────↑
   └─── Socket.io (Sync bidireccional) ──────────────────────┘
   
El relay NO escribe en disco
El relay es "sin estado" (stateless) para Foros X
Los navegadores tienen copias locales (IndexedDB)
La sincronización es automática cuando se conectan usuarios
```

---

# 3. STACK TECNOLÓGICO

## 3.1 Frontend (apps/web)

| Tecnología | Versión | Propósito |
|-----------|---------|----------|
| **React** | 18.x | Framework UI |
| **TypeScript** | 5.4+ | Type-safety |
| **Vite** | 5.4+ | Bundler y dev server |
| **Zustand** | Latest | State management |
| **React Router** | 6.x | Routing |
| **Leaflet** | 1.9+ | Mapas interactivos |
| **Tailwind CSS** | 3.x | Styling |
| **Zod** | 3.23+ | Validación |
| **ngeohash** | 0.6+ | Geohash encoding/decoding |
| **Socket.io** | 4.x | WebSocket (relay) |
| **Vitest** | 1.6+ | Testing |

## 3.2 Backend (apps/relay)

| Tecnología | Versión | Propósito |
|-----------|---------|----------|
| **Node.js** | 24.x | Runtime |
| **TypeScript** | 5.4+ | Type-safety |
| **Express** | 4.x | HTTP framework |
| **Socket.io** | 4.x | WebSocket server |
| **tsx** | 4.7+ | TypeScript runner |

## 3.3 Archiver (apps/archivist)

| Tecnología | Versión | Propósito |
|-----------|---------|----------|
| **Node.js** | 24.x | Runtime |
| **TypeScript** | 5.4+ | Type-safety |
| **SQLite/PostgreSQL** | Latest | Almacenamiento histórico |

## 3.4 Protocol (@zonaviva/protocol)

| Tecnología | Versión | Propósito |
|-----------|---------|----------|
| **TypeScript** | 5.4+ | Tipos compartidos |
| **Zod** | 3.23+ | Validación |
| **ngeohash** | 0.6+ | Geohash utilities |

---

# 4. ESTRUCTURA DEL PROYECTO

## 4.1 Árbol de Directorios

```
plataforma-red-social/
├── apps/
│   ├── web/                          # App web (cliente)
│   │   ├── src/
│   │   │   ├── components/           # Componentes React
│   │   │   ├── pages/                # Páginas (routing)
│   │   │   ├── stores/               # Zustand stores
│   │   │   ├── geo/                  # Servicios de geolocalización
│   │   │   ├── modules/              # Módulos compartidos (legacy)
│   │   │   ├── layouts/              # Layouts
│   │   │   ├── hooks/                # Custom React hooks
│   │   │   ├── db/                   # IndexedDB/Storage local
│   │   │   ├── test/                 # Tests
│   │   │   └── main.tsx              # Entry point
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   └── package.json
│   │
│   ├── relay/                        # Servidor relay (P2P)
│   │   ├── src/
│   │   │   ├── index.ts              # Entry point
│   │   │   └── ...
│   │   ├── dist/
│   │   └── package.json
│   │
│   └── archivist/                    # Archivador histórico
│       ├── src/
│       │   └── index.ts
│       └── package.json
│
├── packages/
│   └── protocol/                     # Tipos compartidos
│       ├── src/
│       │   ├── types.ts              # Interfaces principales
│       │   ├── schemas.ts            # Zod schemas
│       │   ├── constants.ts          # Constantes globales
│       │   └── zones.ts              # Catálogo de zonas
│       ├── zones/                    # Archivos de zonas
│       │   ├── zones.json            # Catálogo principal
│       │   ├── zones.index.json      # Índice celda→zona
│       │   └── zones.geo.json        # Features GeoJSON
│       ├── scripts/
│       │   ├── validateZones.ts      # Validación
│       │   ├── generateZoneFiles.ts  # Generación de índices
│       │   └── syncZones.ts          # Sincronización a TS
│       ├── dist/                     # Output compilado
│       └── package.json
│
├── docs/
│   ├── INFORME_TECNICO_COMPLETO.md  # Este archivo
│   ├── FASE_1_COMPLETADA.md
│   ├── FASE_2_COMPLETADA.md
│   ├── plan_mejoras_geolocalizacion_mapa.md
│   └── ...
│
├── .git/
├── pnpm-lock.yaml
└── pnpm-workspace.yaml
```

## 4.2 Estructura de Archivos Críticos

### Protocol - zones/zones.json
```json
{
  "version": 1,
  "gridPrecision": 7,
  "pilotBounds": [[-15.87, -70.03], [-15.83, -70.01]],
  "zones": [
    {
      "id": "puno-centro",
      "name": "Centro de Puno",
      "description": "Plaza Mayor, Catedral...",
      "type": "permanent",
      "cells": [
        "6mnjye4", "6mnjye5", "6mnjyeh", ...
      ]
    },
    ...
  ]
}
```

### Web - geoStore.ts
```typescript
interface GeoState {
  permission: GeoPermission;
  status: LocationServiceStatus;
  userPosition: UserPosition | null;
  userCells: string[];
  detectedZones: Zone[];
  // ... acciones
}
```

---

# 5. CONCEPTOS CLAVE

## 5.1 Geohashing

### ¿Qué es un geohash?

Un **geohash** es una forma de codificar coordenadas geográficas en una cadena de caracteres. Divide el mundo en rectángulos jerárquicos.

**Ejemplo:**
- Coordenadas: `lat=-15.8402, lng=-70.0219` (Puno)
- Geohash de precisión 7: `6mnjye4`
- Geohash de precisión 6: `6mnjye`

**Precisión:**
| Precisión | Ancho (m) | Alto (m) | Uso |
|-----------|-----------|---------|-----|
| 5 | 4892 | 4892 | Ciudades grandes |
| 6 | 1220 | 610 | Barrios |
| 7 | 153 | 153 | Cuadras (ZonaViva) |
| 8 | 38 | 19 | Casas |

### Ventajas para ZonaViva

```
✅ Proximidad: Celdas cercanas tienen prefijos similares
✅ Compresión: Área entera en 7 caracteres
✅ Privacidad: No es la ubicación exacta
✅ Discretización: Convierte coordenadas continuas en cuadrículas
```

## 5.2 Zonas vs Celdas

### Sistema de Zonas

```
ZONA = Conjunto de celdas elegidas manualmente

Ejemplo:
─────────────────────────
│ 6mn │ 6mn │ 6mn │ 6mn │
│ je4 │ je5 │ je6 │ je7 │  = Zona "puno-centro"
│     │     │     │     │
│ 6mn │ 6mn │ 6mn │ 6mn │
│ ye4 │ ye5 │ ye6 │ ye7 │
─────────────────────────
Total: 8 celdas en puno-centro
```

### Características

- ✅ **Sin solapamientos**: Una celda ∈ una sola zona
- ✅ **Forma irregular**: Las zonas tienen bordes "dentados" (como píxeles)
- ✅ **Cubierta parcial**: Muchas celdas de Puno no pertenecen a ninguna zona
- ✅ **Definición manual**: El administrador elige qué celdas forman cada zona

## 5.3 Círculo de Precisión del Usuario

```
Usuario en: (-15.8402, -70.0219)
GPS accuracy: 87 metros

Círculo de precisión:
- Min radius: 50m (constante)
- Max radius: 150m (constante)
- Actual radius: 87m (accuracy del GPS)

El sistema calcula: ¿Qué CELDAS toca este círculo?
→ Si toca celdas de zona X, usuario PUEDE publicar en X
```

## 5.4 Flujo de Acceso a Foro

```
Usuario intenta publicar en Foro de "puno-centro"

1. ¿Tiene GPS activo?
   NO → Rechazar ❌

2. ¿La posición es FRESCA (< 60 segundos)?
   NO → Rechazar ❌

3. ¿La posición es PRECISA (<= 300m)?
   NO → Rechazar ❌

4. ¿El círculo de precisión toca alguna celda de "puno-centro"?
   NO → Rechazar ❌
   SÍ → PERMITIR PUBLICAR ✅
```

---

# 6. MÓDULOS PRINCIPALES

## 6.1 Servicios de Geolocalización (/geo)

### 6.1.1 geoCore.ts - Funciones Puras

**Propósito:** Cálculos de geolocalización sin estado

```typescript
// Conversiones geohash
coordinatesToGeohash(lat, lng, precision) → string
decodeGeohash(hash) → { lat, lng, bbox }

// Distancias
distanceMeters(lat1, lng1, lat2, lng2) → number
distanceToRect(lat, lng, bbox) → number

// Cálculos de precisión
calculateEffectiveRadius(accuracy) → number
  // Clamp(accuracy, MIN=50, MAX=150)

// Celdas que toca un círculo
cellsTouchingCircle(lat, lng, radius, precision) → string[]
  // Devuelve array de geohashes que intersectan el círculo

// Validaciones
isValidGeohash(hash, precision) → boolean
getNeighborGeohashes(hash) → string[]

// Geometría
geohashCellArea(precision) → number (m²)
formatArea(m²) → string ("153m²" o "0.15km²")
```

**Características:**
- ✅ Puras: No tienen efectos secundarios
- ✅ Testables: 27 tests pasando
- ✅ Documentadas: JSDoc completo
- ✅ Uso: Cálculos intensivos sin latencia

### 6.1.2 zoneCatalog.ts - Gestión de Catálogo

**Propósito:** Cargar y buscar zonas eficientemente

```typescript
// Singleton - se carga una sola vez
getCatalog() → ZoneCatalog
getZoneIndex() → Record<string, zoneId>

// Búsquedas
getZoneIdByCell(geohash) → string | undefined    // O(1)
getZoneById(zoneId) → Zone | undefined
getZonesByCells(geohashes[]) → Zone[]

// Verificaciones
isCellInZone(geohash) → boolean
isInPilotArea(lat, lng) → boolean
getPilotBounds() → [[minLat, minLng], [maxLat, maxLng]]
```

**Datos:**
```typescript
interface Zone {
  id: string;           // "puno-centro"
  name: string;         // "Centro de Puno"
  description: string;
  type: "permanent";
  cells: string[];      // ["6mnjye4", "6mnjye5", ...]
}
```

### 6.1.3 accessPolicy.ts - Reglas de Acceso

**Propósito:** Determinar si usuario puede publicar/leer

```typescript
// Posición
interface UserPosition {
  latitude: number;
  longitude: number;
  accuracy: number;     // metros
  timestamp: number;    // Date.now()
}

// Verificaciones de posición
isPositionFresh(position) → boolean     // < 60s
isPositionAccurate(position) → boolean  // <= 300m

// Cálculo de acceso
getUserCells(position) → string[]
getAccessibleZones(position) → Zone[]

// Regla principal
canPublishInZoneForum(position, zoneId) → AccessCheck
  // ¿Puede este usuario publicar en esta zona?
  // Respuesta: { canPublish, reason, detectedZones, touchedCells }

// Helpers UI
getLocationStatusMessage(position) → string
  // "Ubicación activa (±87m)" o "Ubicación desactualizada"
```

### 6.1.4 locationService.ts - GPS

**Propósito:** Interfaz única con Geolocation API del navegador

```typescript
// Estados
type LocationServiceStatus = 
  | 'inactive'    // No inició
  | 'requesting'  // Pidiendo permiso
  | 'active'      // Funcionando
  | 'denied'      // Permiso denegado
  | 'unavailable' // Sin GPS
  | 'error'       // Error desconocido

// Control
isGeolocationAvailable() → boolean
getLocationServiceStatus() → LocationServiceStatus
getLastKnownPosition() → UserPosition | null

startWatchingPosition(onUpdate, onError) → void
  // Inicia watchPosition
  // Filtra: solo emite si movimiento >= 25m
  // enableHighAccuracy: true
  // maximumAge: 0 (siempre fresco)

stopWatchingPosition() → void

// One-shot
getCurrentPosition() → Promise<UserPosition>
requestLocationPermission() → Promise<boolean>
```

**Características:**
- ✅ Filtrado de movimiento: No emite cada GPS sample
- ✅ Gestión de permisos: Maneja PERMISSION_DENIED
- ✅ Singleton: Único watchPosition activo
- ✅ Callbacks: onUpdate y onError desacoplados

## 6.2 State Management (stores/)

### 6.2.1 geoStore.ts

**Propósito:** Centralizar estado de geolocalización y zonas

```typescript
interface GeoState {
  // Permisos y estado
  permission: "granted" | "denied" | "prompt" | "unavailable";
  status: LocationServiceStatus;
  
  // Posición actual
  userPosition: UserPosition | null;
  userCells: string[];        // Celdas que toca el círculo
  detectedZones: Zone[];      // Zonas donde puede publicar
  
  // Selección manual
  manualZone: Zone | null;    // Usuario selecciona zoom
  simulatedZone: Zone | null; // Modo prueba
  
  // UI
  followUserPosition: boolean; // Modo "Centrar en mí"
  error: string | null;
  
  // Acciones
  startWatching() → void;
  stopWatching() → void;
  setManualZone(zone) → void;
  setSimulatedZone(zone) → void;
  setFollowUserPosition(bool) → void;
  effectiveZone() → Zone | null;  // Manual o detectada
}
```

**Integración con locationService:**

```
locationService emite UserPosition
         ↓
geoStore.startWatching() recibe
         ↓
Calcula: getUserCells() → string[]
         ↓
Calcula: getAccessibleZones() → Zone[]
         ↓
Actualiza estado
         ↓
Componentes se re-renderizán
```

### 6.2.2 forumStore.ts

**Propósito:** Gestionar foros, mensajes y sincronización P2P

```typescript
interface ForumState {
  // Foros
  forums: Record<forumId, Forum>;
  subscribedForums: string[];     // Foros donde estoy
  servedForumIds: string[];       // Foros que sirvo (nodo)
  activeForumId: string | null;
  
  // Mensajes
  messages: Record<forumId, Message[]>;
  
  // Acciones
  joinForum(forumId) → Promise<void>;
  leaveForum(forumId) → Promise<void>;
  leaveAllForums() → Promise<void>;
  
  publishMessage(content, session, zone) → Promise<void>;
  // Firma localmente, envía al relay
  
  // Sincronización P2P
  syncForum(forumId) → Promise<void>;
  // Descarga mensajes del relay si faltan
}
```

### 6.2.3 identityStore.ts

**Propósito:** Gestionar identidad y sesión del usuario

```typescript
interface IdentityState {
  session: Session | null;  // Usuario actual
  
  // Acciones
  createSession() → void;   // Crea alias + keypair
  logout() → void;
  // ...
}
```

## 6.3 Componentes UI (components/)

### 6.3.1 ZoneMap.tsx - Mapa Interactivo

**Props:**
```typescript
interface ZoneMapProps {
  zones: Zone[];
  activeZone: Zone | null;
  onZoneClick: (zone: Zone) => void;
}
```

**Funcionalidad:**
- Renderiza mapa con Leaflet
- Muestra zonas como capas
- Click en zona = seleccionar
- Planned (Fase 3): Mostrar círculo de precisión del usuario

### 6.3.2 StatusDot.tsx - Indicador GPS

**Props:**
```typescript
interface Props {
  status: LocationServiceStatus;
}
```

**Estados:**
```
🟢 active    → Verde, GPS funcionando
🟡 requesting → Amarillo pulsante, pidiendo permiso
🔴 denied    → Rojo, permiso denegado
⚪ unavailable → Gris, sin GPS en dispositivo
⚫ error     → Rojo oscuro, error GPS
```

### 6.3.3 GeoPermissionBanner.tsx - Banner de Permisos

**Props:**
```typescript
interface Props {
  permission: GeoPermission;
  onRequest: () => void;
}
```

**Casos:**
- `prompt` → Mostrar "Activa ubicación"
- `denied` → Mostrar "Ubica ion bloqueada"
- `granted` → No mostrar
- `unavailable` → Mostrar "Sin GPS"

---

# 7. FLUJO DE DATOS

## 7.1 Flujo Startup Completo

```
Usuario abre ZonaViva
      ↓
main.tsx carga App.tsx
      ↓
App.tsx inicializa stores (Zustand)
  - geoStore
  - forumStore
  - identityStore
      ↓
useEffect → geoStore.startWatching()
      ↓
locationService.startWatchingPosition(
  onUpdate = (position) => {
    geoStore.setState({
      userPosition: position,
      userCells: getUserCells(position),
      detectedZones: getAccessibleZones(position)
    })
  },
  onError = (error) => {
    geoStore.setState({ error, status: 'error' })
  }
)
      ↓
Navegador pide permiso GPS
      ↓
Usuario acepta / rechaza
      ↓
Si acepta:
  - Ubicación se obtiene cada 2-5 segundos (según GPS)
  - Si movimiento >= 25m → onUpdate se ejecuta
  - geoStore se actualiza
  - Componentes se re-renderizán
      ↓
InicioPage muestra:
  - Zona detectada
  - Botón de foros en esa zona
  - Indicador GPS
```

## 7.2 Flujo de Publicación

```
Usuario en zona "puno-centro", escribe mensaje
      ↓
ForoPage.tsx botón "Publicar" se ejecuta
      ↓
publishMessage(content, session, activeZone)
      ↓
forumStore.publishMessage() hace:
  1. Valida: canPublishInZoneForum(userPosition, zoneId)?
  2. Genera: Message { id, forumId, content, sig }
  3. Firma: HMAC(content) con keypair del usuario
  4. Envía al Relay: socket.emit('message', message)
      ↓
Relay recibe mensaje
      ↓
Relay valida firma (verifySignature)
      ↓
Relay firma con su keypair (sig_relay)
      ↓
Relay distribuye a otros usuarios en la sala
      ↓
Otros usuarios reciben → forumStore.addMessage()
      ↓
Guardan en IndexedDB local
      ↓
ChatPage.tsx re-renderiza con nuevo mensaje
```

## 7.3 Flujo de Sincronización P2P

```
Usuario A entra a foro que ya tiene mensajes locales

forumStore.syncForum("zone:puno-centro")
      ↓
¿Tengo todos los mensajes?
      ↓
NO → Calcula rango faltante [msgId_X, msgId_Y]
      ↓
Envía al Relay: socket.emit('sync:range', range)
      ↓
Relay busca en cache local
      ↓
Relay devuelve mensajes del rango
      ↓
Usuario A recibe
      ↓
Merge con locales (sin duplicados)
      ↓
Guardar en IndexedDB
      ↓
ChatPage.tsx re-renderiza
      ↓
Si Usuario B tiene mensajes diferentes:
  Relay fusiona (merge determinista)
      ↓
Ambos terminan con el mismo historial
```

---

# 8. GUÍA TÉCNICA POR COMPONENTE

## 8.1 Cómo Navegar el Código

### Punto de Entrada

**apps/web/src/main.tsx**
```typescript
// 1. Renderiza App.tsx
// 2. Vite se encarga de bundlear
// 3. Los stores se inicializan en App.tsx
```

### Root Component

**apps/web/src/App.tsx**
```typescript
// Inicializa:
// - Identity (crea sesión si no existe)
// - Routing (React Router)
// - Layouts (AppLayout)
```

### Layout Principal

**apps/web/src/layouts/AppLayout.tsx**
```typescript
// Contiene:
// - Navbar con StatusDot
// - Router outlet (páginas)
// - Banners (permisos, offline)
```

### Páginas Principales

1. **InicioPage.tsx** - Dashboard
   - Muestra zona detectada
   - Botón para ver foros de la zona
   - Selector manual de zona
   - Mapa interactivo

2. **ForosPage.tsx** - Lista de foros
   - Foros de la zona actual
   - Foros activos (subscritos)
   - Botón crear foro

3. **ForoPage.tsx** - Vista de foro
   - Información de zona
   - Lista de participantes
   - Botón de chat

4. **ChatPage.tsx** - Chat del foro
   - Historial de mensajes
   - Input para escribir
   - Botones salir/notificaciones

5. **AjustesPage.tsx** - Configuración
   - Datos del usuario
   - Foros subscritos
   - Opción salir de foros

## 8.2 Patrones de Código

### Patrón: Hook Custom + Store

```typescript
// ❌ Evitar: acceder directamente a APIs
const position = navigator.geolocation.getCurrentPosition(...)

// ✅ Preferir: hook custom
const { userPosition, detectedZones } = useGeoStore();

// ¿Por qué?
// - Centralizado
// - Reactive (re-render automático)
// - Testeable
```

### Patrón: Validación con Zod

```typescript
// ❌ Evitar: validación manual
if (!message || message.length > 500) {
  throw new Error("Invalid");
}

// ✅ Preferir: Zod schema
const MessageSchema = z.object({
  content: z.string().min(1).max(500)
});

const validated = MessageSchema.parse({ content: msg });
```

### Patrón: Types antes de Implementación

```typescript
// ✅ Definir interfaces primero
interface Zone {
  id: string;
  name: string;
  cells: string[];
}

// Luego implementar funciones
function getZonesForCells(cells: string[]): Zone[] {
  // ...
}
```

## 8.3 Flujo de Desarrollo para Nueva Feature

### Ejemplo: Agregar "distancia a zona"

**Paso 1: Definir tipos (protocol/src/types.ts)**
```typescript
interface ZoneDistance {
  zone: Zone;
  distanceMeters: number;
  isAccessible: boolean;
}
```

**Paso 2: Funciones puras (geo/geoCore.ts)**
```typescript
function calculateDistanceToZone(
  userLat: number,
  userLng: number,
  zone: Zone,
  precision: number
): number {
  // Calcula distancia mínima desde usuario a cualquier celda
  // Devuelve 0 si está dentro
}
```

**Paso 3: Integrar en accessPolicy.ts**
```typescript
function getZonesWithDistance(position: UserPosition): ZoneDistance[] {
  return getAllZones().map(zone => ({
    zone,
    distanceMeters: calculateDistanceToZone(...),
    isAccessible: canPublishInZoneForum(position, zone.id).canPublish
  }));
}
```

**Paso 4: Conectar a store (geoStore.ts)**
```typescript
interface GeoState {
  // ...
  zonesWithDistance: ZoneDistance[];
}

// En startWatching()
set({
  // ...
  zonesWithDistance: getZonesWithDistance(position)
});
```

**Paso 5: UI (component)**
```typescript
const { zonesWithDistance } = useGeoStore();

return (
  <div>
    {zonesWithDistance.map(({ zone, distanceMeters }) => (
      <div key={zone.id}>
        {zone.name} - {distanceMeters}m
      </div>
    ))}
  </div>
);
```

**Paso 6: Test**
```typescript
describe("ZoneDistance", () => {
  it("calculates distance correctly", () => {
    const distance = calculateDistanceToZone(...);
    expect(distance).toBeCloseTo(expectedDistance, 0);
  });
});
```

---

# 9. PRIVACIDAD Y SEGURIDAD

## 9.1 Principios de Privacidad

### Privacidad por Diseño

```
NUNCA se envía:
❌ Coordenadas exactas (lat, lng)
❌ Accuracy del GPS
❌ Timestamp

SÍ se envía:
✅ Geohash de precisión 7 (~153m)
✅ Zona detectada
✅ ZoneId (no coordenadas)

Razón: El Relay NO necesita saber DONDE estás, solo
       EN QUÉ ZONA estás, para router mensajes.
```

### Datos en Repos

```
Local (navegador):
- Coordenadas exactas: ✅ EN IndexedDB (no sale del dispositivo)
- Historial de foros: ✅ EN IndexedDB

Enviado al Relay:
- Solo ZoneId: ✅ SÍ
- Mensajes: ✅ SÍ (firmados)
- Posición: ❌ NO

Enviado a Archivista:
- Histórico de mensajes: ✅ SÍ (anónimo)
```

## 9.2 Seguridad

### Firma de Mensajes

```
Usuario A (Private Key: A_priv)
      ↓
Crea mensaje: { forumId, content, alias, authorKey: A_pub }
      ↓
Firma: sig = HMAC(content, A_priv)
      ↓
Envía: { message, sig }
      ↓
Relay (valida)
      ↓
Verifica: HMAC(content, A_pub) === sig ✅
      ↓
Si valida: Firma con Relay_sig
      ↓
Distribuye: { message, sig_author, sig_relay }
      ↓
Usuario B (recibe)
      ↓
Verifica: HMAC(content, A_pub) === sig_author ✅
      ↓
Acepta mensaje
```

### Prevención de Replay Attacks

```
Cada mensaje tiene:
- id: ULID (generado por cliente, timestamp + random)
- timestamp: relayTs (asignado por relay)

Relay rechaza duplicados:
if (messageId in seenMessages) {
  reject("Already seen");
}
```

---

# 10. PROCEDIMIENTOS DE DESARROLLO

## 10.1 Setup Inicial

### Instalación

```bash
# Clonar repo
git clone <repo-url>
cd plataforma-red-social

# Instalar dependencias
pnpm install

# Compilar protocol
cd packages/protocol
pnpm build

# Volver a root
cd ../..
```

### Variables de Entorno

```bash
# apps/web/.env.local
VITE_RELAY_URL=http://localhost:3001
VITE_ARCHIVIST_URL=http://localhost:3002

# apps/relay/.env
PORT=3001
RELAY_KEY_PATH=./relay.key
```

## 10.2 Desarrollo Local

### Terminal 1: Relay
```bash
cd apps/relay
pnpm dev
# Escucha en http://localhost:3001
```

### Terminal 2: Web
```bash
cd apps/web
pnpm dev
# Escucha en https://localhost:5173
```

### Terminal 3: Tests
```bash
cd apps/web
pnpm test
# O para watch
pnpm test --watch
```

## 10.3 Workflow de Zonas

### Workflow Completo

```bash
cd packages/protocol

# 1. Editar zones.json (agregar/modificar zonas)
nano zones/zones.json

# 2. Validar (sin solapamientos)
pnpm zones:validate

# 3. Generar índices y GeoJSON
pnpm zones:build

# 4. Sincronizar a TypeScript
pnpm zones:sync

# 5. TODO EN UNO
pnpm zones:all

# 6. Recompilar
pnpm build

# 7. Volver a root y recompilar todo
cd ../..
pnpm build
```

### Agregar Nueva Zona

**Paso 1: Calcular celdas**
```bash
# Usar herramienta online o script
# Zona debe cubrirse con geohashes de precisión 7
# Aproximadamente 153m × 153m cada celda
```

**Paso 2: Actualizar zones.json**
```json
{
  "id": "puno-nueva",
  "name": "Nueva Zona",
  "description": "...",
  "type": "permanent",
  "cells": ["6mnjye4", "6mnjye5", ...]
}
```

**Paso 3: Validar y sincronizar**
```bash
pnpm zones:all
pnpm build
```

**Paso 4: Commit**
```bash
git add zones/zones.json src/zones.ts
git commit -m "feat: add nueva zone"
git push
```

## 10.4 Testing

### Ejecutar tests

```bash
# Tests geoCore (27 tests)
pnpm test geoCore --run

# Todos los tests
pnpm test --run

# Watch mode
pnpm test

# Con coverage
pnpm test --coverage
```

### Escribir nuevo test

```typescript
// apps/web/src/geo/miFeature.test.ts
import { describe, it, expect } from "vitest";
import { miFunction } from "./miFeature";

describe("Mi Feature", () => {
  it("debe hacer algo", () => {
    const resultado = miFunction(input);
    expect(resultado).toBe(expected);
  });
});
```

## 10.5 Build para Producción

```bash
# Compilar protocol
cd packages/protocol
pnpm build

# Build web
cd ../web
pnpm build
# Output: dist/

# Build relay
cd ../relay
pnpm build
# Output: dist/

# Start relay en producción
node dist/index.js

# Servir web (usar servidor HTTP, no vite)
# Usar nginx, Vercel, Netlify, etc.
```

## 10.6 Debugging

### DevTools del Navegador

```typescript
// Logs en componentes
const { userPosition, detectedZones } = useGeoStore();
console.log("Position:", userPosition);
console.log("Detected zones:", detectedZones);

// En Store
const store = useGeoStore.getState();
console.log(store);
```

### Debugger de Node (Relay)

```bash
node --inspect dist/index.js
# Luego: chrome://inspect
```

### Logs del Relay

```bash
# Habilitar logs con LOG_LEVEL
LOG_LEVEL=debug pnpm dev
```

---

# 11. ROADMAP Y PRÓXIMAS FASES

## Fase 1: ✅ COMPLETADA (Base de Datos)

- ✅ Constantes de geolocalización
- ✅ Funciones puras geoCore
- ✅ Validación de zonas
- ✅ Generación de índices
- ✅ zones.json sin solapamientos

## Fase 2: ✅ COMPLETADA (Servicios)

- ✅ zoneCatalog.ts
- ✅ accessPolicy.ts
- ✅ locationService.ts
- ✅ geoStore integrado
- ✅ Tipo Zone actualizado

## Fase 3: ✅ COMPLETADA (UI y Mapa Interactivo)

- ✅ ZonesLayer.tsx (renderizar celdas en mapa con geometrías y feedback visual de acceso)
- ✅ UserPositionLayer.tsx (marcador + círculo de precisión 50-150m + feedback de señal y privacidad)
- ✅ GeoStatusBadge.tsx (indicador GPS enriquecido, estados activo/débil/denegado/fuera de zonas)
- ✅ ZoneMap.tsx (integración completa de capas, pan suave, auto-follow y botón "Centrar en mí")
- ✅ InicioPage.tsx (integración de follow user position, feedback de presencia física vs exploración)

## Fase 4: 🎯 PLANIFICADA (Optimizaciones)

- ⏳ Caché de zonas (Web Worker)
- ⏳ Compresión de mensajes
- ⏳ Sincronización Delta
- ⏳ Modo offline mejorado
- ⏳ Indicador de latencia

## Fase 5: 🎯 FUTURO (Características)

- ⏳ Reacciones a mensajes (emoji)
- ⏳ Mención de usuarios (@usuario)
- ⏳ Búsqueda de mensajes
- ⏳ Moderación de contenido
- ⏳ Notificaciones push

---

# 12. TROUBLESHOOTING

## Problema: "ws proxy error: ECONNREFUSED"

**Causa:** El relay no está corriendo

**Solución:**
```bash
# Terminal 1: Inicia relay
cd apps/relay
pnpm dev

# Terminal 2: Inicia web
cd apps/web
pnpm dev
```

## Problema: "Cannot find module '@zonaviva/protocol'"

**Causa:** Protocol no fue compilado

**Solución:**
```bash
cd packages/protocol
pnpm build
cd ../..
pnpm install
```

## Problema: "Ubicación no disponible"

**Causa:** GPS deshabilitado o permisos denegados

**Soluciones:**
1. Verificar permisos del navegador
2. Usar HTTPS (requerido para GPS)
3. Usar developer tools de Chrome para simular GPS

## Problema: Tests fallan con "Cannot find module"

**Causa:** Imports relativos mal configurados

**Solución:** Verificar alias en `vite.config.ts`
```typescript
resolve: {
  alias: {
    "@": path.resolve(__dirname, "./src"),
  },
}
```

---

# 13. REFERENCIAS Y RECURSOS

## Documentación Oficial

- [React Documentation](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Vite Guide](https://vitejs.dev/guide/)
- [Zustand Documentation](https://github.com/pmndrs/zustand)
- [Leaflet Documentation](https://leafletjs.com)
- [Geohash Algorithm](https://en.wikipedia.org/wiki/Geohash)

## Documentos del Proyecto

- `FASE_1_COMPLETADA.md` - Detalle de Fase 1
- `FASE_2_COMPLETADA.md` - Detalle de Fase 2
- `FASE_3_COMPLETADA.md` - Detalle de Fase 3 (UI y Mapa)
- `plan_mejoras_geolocalizacion_mapa.md` - Plan original

## Contacto y Soporte

- **Mantenedor:** [Tu nombre]
- **Issues:** [GitHub Issues URL]
- **Discussions:** [GitHub Discussions URL]

---

# CONCLUSIÓN

ZonaViva es una plataforma compleja pero bien estructurada que combina:

1. **Geolocalización precisa** usando geohashes
2. **Arquitectura descentralizada** P2P
3. **Privacidad by design** sin compartir coordenadas exactas
4. **Offline-first** con sincronización automática
5. **Type-safety** completo con TypeScript

El código está organizado de manera modular, con separación clara de responsabilidades:

- **geoCore.ts**: Matemática pura
- **zoneCatalog.ts**: Datos
- **accessPolicy.ts**: Lógica de negocio
- **locationService.ts**: API externa
- **geoStore.ts**: Estado
- **Componentes**: UI

Cada capa es independiente, testeable y documentada.

**Para continuar desarrollando:**

1. Lee `FASE_1_COMPLETADA.md` para entender la base
2. Lee `FASE_2_COMPLETADA.md` para entender servicios
3. Navega el código siguiendo la guía de componentes (sección 8)
4. Usa los patrones de código como referencia
5. Sigue el workflow de desarrollo (sección 10)

¡Bienvenido a ZonaViva! 🌍📍
