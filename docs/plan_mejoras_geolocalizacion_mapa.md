# Plan de Mejoras: Geolocalización y Visualización en Mapa

**Versión:** 1.0  
**Fecha:** 29 de octubre de 2026  
**Iteraciones afectadas:** Iteración 1 y 2 (mejoras retroactivas)  
**Duración estimada:** 1.5 - 2 semanas

---

## 1. Contexto y motivación

### 1.1 Estado actual

El proyecto actualmente implementa:
- ✅ Detección básica de zona con GPS
- ✅ Catálogo de zonas predefinidas (`zones.json`)
- ✅ Comprobación punto-en-polígono
- ✅ Mapa con Leaflet mostrando zonas

### 1.2 Limitaciones identificadas

- ❌ No se muestra la posición del usuario en el mapa
- ❌ No hay visualización del círculo de precisión GPS
- ❌ No existe sistema de celdas geohash de precisión 7
- ❌ No hay actualización en tiempo real con `watchPosition`
- ❌ Falta el botón "Centrar en mí"
- ❌ No se indica visualmente la precisión GPS (buena/débil)
- ❌ No hay cálculo de celdas tocadas por el círculo de precisión
- ❌ Estructura modular no implementada según especificación

### 1.3 Objetivo de las mejoras

Implementar un sistema completo de geolocalización con:
- Visualización precisa y en tiempo real de la ubicación del usuario
- Sistema de celdas geohash para control de acceso granular
- Módulos puros y testeables
- Cumplimiento estricto de privacidad (ninguna coordenada sale del dispositivo)

---

## 2. Arquitectura del módulo de geolocalización

### 2.1 Concepto fundamental: Zonas como conjuntos de celdas

**Principios clave:**
- La ciudad se considera dividida por una **cuadrícula geohash de precisión 7** (~153m × 153m)
- Esta cuadrícula existe matemáticamente en todo el mapa (cualquier coordenada cae en una celda)
- **Las zonas NO son círculos**: son conjuntos de celdas rectangulares elegidas manualmente
- Cada zona tiene la forma que formen sus celdas (bordes escalonados, como píxeles grandes)
- **Una celda pertenece a UNA sola zona** (sin solapamientos)
- Las celdas no asignadas no pertenecen a ninguna zona

**Lo que SÍ es circular:**
- El **círculo de precisión del usuario** (50-150m según accuracy del GPS)
- Este círculo se usa para comprobar si el usuario toca alguna celda de una zona
- Si el círculo toca celdas de dos zonas vecinas, el usuario puede publicar en ambas

**Formas de las zonas:**
- Mercado (pocas celdas): bloque pequeño, forma de L o rectángulo
- Universidad (muchas celdas): sigue su contorno aproximado, bordes dentados
- Pueden ser de cualquier forma, incluso con partes separadas

### 2.2 Estructura de archivos

```
apps/web/src/
├─ geo/
│  ├─ locationService.ts      # Único acceso a Geolocation API
│  ├─ geoCore.ts              # Funciones puras: geohash, círculos, distancias
│  ├─ zoneCatalog.ts          # Carga catálogo, construye índice celda→zona
│  ├─ accessPolicy.ts         # Reglas de acceso (leer, publicar)
│  └─ map/
│     ├─ MapView.tsx          # Componente principal del mapa
│     ├─ ZonesLayer.tsx       # Capa de polígonos de zonas
│     ├─ UserPositionLayer.tsx # Marcador y círculo de precisión
│     └─ GridPreviewLayer.tsx  # Vista previa de celdas (Iter 5)
│
├─ stores/
│  └─ geoStore.ts             # Store Zustand (actualizar)
│
└─ components/
   ├─ ZoneMap.tsx             # Integración del mapa (actualizar)
   └─ GeoStatusBadge.tsx      # Indicador de precisión GPS (nuevo)

packages/protocol/
├─ zones/
│  ├─ zones.json              # Catálogo de zonas (actualizar)
│  ├─ zones.index.json        # Índice celda→zoneId (generar)
│  └─ zones.geo.json          # GeoJSON de polígonos (generar)
│
└─ src/
   └─ constants.ts            # Agregar constantes de geo

apps/zone-editor/             # Herramienta interna (nuevo workspace)
└─ (app independiente para editar zonas)
```

### 2.3 Flujo de datos del módulo

```
Navegador (Geolocation API)
    ↓
locationService.ts (watchPosition)
    ↓
geoStore (actualiza estado)
    ↓
┌─────────────────┬────────────────────┐
│                 │                    │
geoCore          accessPolicy      MapView
(celdas)         (reglas)          (visualización)
    ↓                 ↓                ↓
zoneCatalog      UI controls      Leaflet layers
(índice)         (botones)        (marcadores)
```

---

## 3. Tareas por módulo

### 3.1 Constantes de configuración (`packages/protocol/src/constants.ts`)

**Nuevas constantes:**

```typescript
// ── Geolocalización y celdas ──────────────────────────────────────────
/** Precisión de geohash para el catálogo de zonas (≈153m × 153m) */
export const GRID_PRECISION = 7;

/** Radio mínimo del círculo de precisión del usuario (metros) */
export const USER_CIRCLE_MIN_RADIUS = 50;

/** Radio máximo del círculo de precisión del usuario (metros) */
export const USER_CIRCLE_MAX_RADIUS = 150;

/** Precisión GPS máxima aceptable (metros) */
export const MAX_ACCEPTABLE_ACCURACY = 300;

/** Distancia mínima de movimiento para actualizar posición (metros) */
export const MIN_MOVEMENT_THRESHOLD = 25;

/** Edad máxima de la posición antes de pedir actualización (ms) */
export const MAX_POSITION_AGE = 60_000; // 60 segundos

/** Precisión geohash para foros de usuario - barrio (Iteración 5) */
export const GEOHASH_PRECISION_BARRIO = 6;

/** Precisión geohash para foros de usuario - sector (Iteración 5) */
export const GEOHASH_PRECISION_SECTOR = 5;

// ── Mapa y tiles ──────────────────────────────────────────────────────
/** URL del proveedor de tiles del mapa */
export const MAP_TILES_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

/** Atribución requerida por OSM */
export const MAP_TILES_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>';

/** Nivel de zoom por defecto */
export const MAP_DEFAULT_ZOOM = 15;

/** Nivel de zoom mínimo permitido */
export const MAP_MIN_ZOOM = 12;

/** Nivel de zoom máximo permitido */
export const MAP_MAX_ZOOM = 18;
```

**Criterios de aceptación:**
- [ ] Todas las constantes están definidas y documentadas
- [ ] Los valores son configurables desde un solo lugar
- [ ] Se exportan correctamente desde `@zonaviva/protocol`

---

### 3.2 Núcleo de geolocalización (`apps/web/src/geo/geoCore.ts`)

**Funciones puras a implementar:**

```typescript
/**
 * Convierte coordenadas a geohash de precisión específica
 */
export function coordinatesToGeohash(
  lat: number, 
  lng: number, 
  precision: number
): string;

/**
 * Decodifica un geohash a coordenadas centrales y bbox
 */
export function decodeGeohash(geohash: string): {
  latitude: number;
  longitude: number;
  bbox: [number, number, number, number]; // [minLat, minLng, maxLat, maxLng]
};

/**
 * Calcula la distancia entre dos puntos (Haversine)
 */
export function distanceMeters(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number;

/**
 * Calcula distancia de un punto a un rectángulo (aproximación plana)
 */
export function distanceToRect(
  pointLat: number, pointLng: number,
  rectBbox: [number, number, number, number]
): number;

/**
 * Obtiene todas las celdas geohash que toca un círculo
 * Núcleo del sistema de acceso
 */
export function cellsTouchingCircle(
  centerLat: number,
  centerLng: number,
  radiusMeters: number,
  precision: number
): string[];

/**
 * Calcula el radio efectivo basado en la precisión GPS
 * Clamp entre USER_CIRCLE_MIN_RADIUS y USER_CIRCLE_MAX_RADIUS
 */
export function calculateEffectiveRadius(accuracy: number): number;

/**
 * Obtiene las 8 celdas vecinas de un geohash (para Iteración 5)
 */
export function getNeighborGeohashes(geohash: string): string[];
```

**Dependencias externas:**
- `ngeohash` (ya instalado)

**Criterios de aceptación:**
- [ ] Todas las funciones son puras (sin efectos secundarios)
- [ ] Pruebas unitarias con Vitest cubren:
  - Conversión geohash ida y vuelta
  - Celdas tocadas por círculo de diferentes tamaños
  - Casos borde: círculo en frontera de celdas
  - Precisión de cálculos de distancia
- [ ] Ninguna función accede a APIs del navegador
- [ ] Documentación JSDoc completa

---

### 3.3 Catálogo de zonas (`apps/web/src/geo/zoneCatalog.ts`)

**Responsabilidades:**
1. Cargar `zones.json`, `zones.index.json` y `zones.geo.json`
2. Construir índice rápido `celda → zoneId`
3. Validar integridad del catálogo

**Interfaz:**

```typescript
export interface ZoneCatalogEntry {
  id: string;
  name: string;
  description: string;
  cells: string[]; // geohashes de precisión 7
  type: "permanent"; // "user" en Iteración 5
}

export interface ZoneCatalog {
  version: number;
  gridPrecision: number;
  pilotBounds: [[number, number], [number, number]]; // [[minLat, minLng], [maxLat, maxLng]]
  zones: ZoneCatalogEntry[];
}

export interface ZoneCatalogIndex {
  [cellGeohash: string]: string; // cellGeohash → zoneId
}

export interface ZoneGeoJSON {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    properties: { id: string; name: string };
    geometry: { type: "Polygon"; coordinates: number[][][] };
  }>;
}

/**
 * Carga el catálogo completo y construye índices
 */
export async function loadZoneCatalog(): Promise<{
  catalog: ZoneCatalog;
  index: ZoneCatalogIndex;
  geoJson: ZoneGeoJSON;
}>;

/**
 * Obtiene las zonas que toca un conjunto de celdas
 */
export function getZonesFromCells(
  cells: string[],
  index: ZoneCatalogIndex
): Set<string>;
```

**Criterios de aceptación:**
- [ ] Carga correcta de los 3 archivos JSON
- [ ] Índice celda→zona construido correctamente
- [ ] Manejo de errores si falta un archivo
- [ ] Validación: no hay celdas duplicadas
- [ ] Pruebas unitarias

---

### 3.4 Política de acceso (`apps/web/src/geo/accessPolicy.ts`)

**Funciones puras de autorización:**

```typescript
export interface UserPosition {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

export interface AccessCheckResult {
  status: "granted" | "denied" | "low_accuracy" | "stale_position";
  reason?: string;
  touchedZones?: Set<string>;
  cells?: string[];
}

/**
 * Determina si el usuario puede leer un foro (siempre true para permanentes)
 */
export function canReadForum(forumId: string): boolean;

/**
 * Determina si el usuario puede publicar en un foro permanente
 * Regla: el círculo de precisión debe tocar al menos una celda de esa zona
 */
export function canPublishInZoneForum(
  position: UserPosition,
  zoneId: string,
  catalog: ZoneCatalog,
  index: ZoneCatalogIndex
): AccessCheckResult;

/**
 * Obtiene todas las zonas a las que el usuario tiene acceso
 */
export function getAccessibleZones(
  position: UserPosition,
  index: ZoneCatalogIndex
): AccessCheckResult;

/**
 * Valida que la posición sea fresca (no más de MAX_POSITION_AGE)
 */
export function isPositionFresh(position: UserPosition): boolean;
```

**Reglas implementadas:**

| Acción | Regla |
|--------|-------|
| Leer foro permanente | Siempre permitido |
| Publicar en foro permanente | Círculo de precisión toca ≥1 celda de la zona |
| Entrar como nodo | Permitido (incluso fuera de zona) |
| Chat aleatorio | Círculo toca zona (Iteración 4) |
| Crear/usar foro de usuario | Geohash propio (Iteración 5) |

**Criterios de aceptación:**
- [ ] Usuario dentro de zona puede publicar
- [ ] Usuario a >150m de zona no puede publicar
- [ ] Usuario en borde entre 2 zonas puede publicar en ambas
- [ ] Precisión >300m devuelve "low_accuracy"
- [ ] Posición >60s devuelve "stale_position"
- [ ] Pruebas cubren todos los casos

---

### 3.5 Servicio de ubicación (`apps/web/src/geo/locationService.ts`)

**Único módulo que accede a la API del navegador:**

```typescript
export type LocationPermission = "prompt" | "granted" | "denied" | "unavailable";

export interface LocationUpdate {
  position: UserPosition;
  cells: string[];
  zones: Set<string>;
  accuracy: "good" | "acceptable" | "poor";
}

export type LocationCallback = (update: LocationUpdate) => void;
export type ErrorCallback = (error: GeolocationPositionError) => void;

/**
 * Solicita permiso de geolocalización
 */
export async function requestLocationPermission(): Promise<LocationPermission>;

/**
 * Verifica el estado del permiso sin solicitarlo
 */
export async function checkLocationPermission(): Promise<LocationPermission>;

/**
 * Inicia watchPosition con actualización continua
 * Solo emite si el movimiento es >MIN_MOVEMENT_THRESHOLD
 */
export function startWatchingPosition(
  onUpdate: LocationCallback,
  onError: ErrorCallback,
  catalog: ZoneCatalog,
  index: ZoneCatalogIndex
): number; // watchId

/**
 * Detiene watchPosition
 */
export function stopWatchingPosition(watchId: number): void;

/**
 * Obtiene posición una sola vez (para publicar/emparejarse)
 */
export async function getCurrentPosition(): Promise<LocationUpdate>;
```

**Configuración de `watchPosition`:**
```typescript
const options: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 5000, // Usar caché de hasta 5s
  timeout: 10000
};
```

**Criterios de aceptación:**
- [ ] watchPosition se inicia correctamente
- [ ] Solo emite actualizaciones si movimiento >25m
- [ ] Maneja errores (timeout, denied, unavailable)
- [ ] Calcula celdas y zonas en cada actualización
- [ ] Detiene correctamente al desmontar
- [ ] No hay memory leaks

---

### 3.6 Store de geolocalización (`apps/web/src/stores/geoStore.ts`)

**Actualizar el store existente:**

```typescript
interface GeoState {
  // ── Estado de permiso ────────────────────────────────────────────────
  permission: LocationPermission;
  
  // ── Posición actual del usuario (privada, nunca sale del dispositivo) ─
  userPosition: UserPosition | null;
  userCells: string[]; // Celdas que toca el círculo de precisión
  accuracy: "good" | "acceptable" | "poor" | null;
  
  // ── Zonas detectadas automáticamente ──────────────────────────────────
  detectedZones: Set<string>; // IDs de zonas tocadas
  currentZone: Zone | null; // Primera zona detectada
  
  // ── Modo manual (exploración) ─────────────────────────────────────────
  manualZone: Zone | null;
  simulatedZone: Zone | null; // Para pruebas
  
  // ── Control del mapa ──────────────────────────────────────────────────
  followUserPosition: boolean; // "Centrar en mí" activo
  mapCenter: [number, number] | null;
  mapZoom: number;
  
  // ── Catálogo cargado ──────────────────────────────────────────────────
  catalog: ZoneCatalog | null;
  catalogIndex: ZoneCatalogIndex | null;
  geoJson: ZoneGeoJSON | null;
  
  // ── Estado de observación ─────────────────────────────────────────────
  watchId: number | null;
  isWatching: boolean;
  lastError: GeolocationPositionError | null;
  
  // ── Acciones ──────────────────────────────────────────────────────────
  initGeo: () => Promise<void>;
  requestPermission: () => Promise<void>;
  startWatching: () => void;
  stopWatching: () => void;
  setManualZone: (zone: Zone | null) => void;
  setSimulatedZone: (zone: Zone | null) => void;
  toggleFollowUser: () => void;
  setMapView: (center: [number, number], zoom: number) => void;
  centerOnUser: () => void;
  
  // ── Consultas de acceso ───────────────────────────────────────────────
  canPublishIn: (zoneId: string) => boolean;
  getActiveZone: () => Zone | null; // simulatedZone ?? manualZone ?? currentZone
}
```

**Criterios de aceptación:**
- [ ] Integración completa con locationService
- [ ] Estado reactivo actualiza UI automáticamente
- [ ] followUserPosition centra mapa al activarse
- [ ] canPublishIn refleja reglas de accessPolicy
- [ ] Limpieza correcta al desmontar
- [ ] No hay coordenadas en eventos de red

---

### 3.7 Componentes del mapa

#### 3.7.1 MapView.tsx (componente principal)

```typescript
interface MapViewProps {
  center?: [number, number];
  zoom?: number;
  showUserPosition?: boolean;
  showZones?: boolean;
  interactive?: boolean;
  className?: string;
}

export function MapView({
  center,
  zoom = MAP_DEFAULT_ZOOM,
  showUserPosition = true,
  showZones = true,
  interactive = true,
  className
}: MapViewProps): JSX.Element;
```

**Responsabilidades:**
- Inicializar Leaflet con configuración correcta
- Limitar bounds al área del piloto
- Integrar capas (ZonesLayer, UserPositionLayer)
- Manejar eventos de interacción

**Criterios de aceptación:**
- [ ] Renderiza correctamente en móvil y desktop
- [ ] maxBounds limita el área visible
- [ ] Atribución de OSM siempre visible
- [ ] Responsive (ajusta altura según dispositivo)

---

#### 3.7.2 ZonesLayer.tsx

```typescript
interface ZonesLayerProps {
  geoJson: ZoneGeoJSON;
  activeZones?: Set<string>; // Zonas con acceso, resaltadas
  onZoneClick?: (zoneId: string) => void;
}
```

**Responsabilidades:**
- Renderizar polígonos desde zones.geo.json
- Resaltar zonas activas (el usuario puede publicar)
- Mostrar tooltip con nombre de zona al hover

**Estilos:**
- Zona normal: stroke azul claro, fill transparente
- Zona activa: stroke verde, fill verde semitransparente
- Zona manual: stroke morado

**Criterios de aceptación:**
- [ ] Todos los polígonos se dibujan correctamente
- [ ] Zonas activas se resaltan visualmente
- [ ] Tooltips funcionan en móvil (tap)
- [ ] Performance aceptable con 5-10 zonas

---

#### 3.7.3 UserPositionLayer.tsx

```typescript
interface UserPositionLayerProps {
  position: UserPosition;
  accuracy: "good" | "acceptable" | "poor";
  effectiveRadius: number;
  visible: boolean;
}
```

**Responsabilidades:**
- Dibujar marcador central (L.circleMarker)
- Dibujar círculo de precisión (L.circle)
- Actualizar en tiempo real sin flicker
- Indicar calidad de señal con colores

**Estilos por precisión:**
- `good` (<100m): verde brillante, opacidad alta
- `acceptable` (100-300m): amarillo/naranja, opacidad media
- `poor` (>300m): rojo, opacidad baja, parpadeante

**Criterios de aceptación:**
- [ ] Marcador se mueve fluidamente
- [ ] Círculo refleja precisión GPS real
- [ ] Colores indican claramente la calidad
- [ ] No se dibuja si permission === "denied"
- [ ] **Privacidad:** solo visible en el dispositivo local

---

#### 3.7.4 GeoStatusBadge.tsx (nuevo componente)

```typescript
interface GeoStatusBadgeProps {
  accuracy: "good" | "acceptable" | "poor" | null;
  permission: LocationPermission;
  zonesCount: number;
  compact?: boolean;
}
```

**Ubicación:** header o esquina del mapa

**Estados:**
- Permission denied: ícono rojo, "GPS desactivado"
- Permission prompt: ícono gris, "Activar GPS"
- Low accuracy: ícono amarillo, "Señal débil"
- Good accuracy + zones: ícono verde, "2 zonas detectadas"
- Good accuracy + no zones: ícono azul, "Fuera de zonas"

**Criterios de aceptación:**
- [ ] Muestra estado correcto en tiempo real
- [ ] Click abre explicación o ajustes
- [ ] Versión compacta para móvil
- [ ] Accesible (ARIA labels)

---

### 3.8 Actualizar componentes existentes

#### 3.8.1 ZoneMap.tsx

**Cambios:**
- Reemplazar implementación actual con `MapView`
- Agregar botón "Centrar en mí"
- Mostrar `GeoStatusBadge`
- Integrar `UserPositionLayer`

```typescript
export function ZoneMap() {
  const {
    userPosition,
    detectedZones,
    accuracy,
    followUserPosition,
    toggleFollowUser,
    centerOnUser,
    geoJson,
    permission
  } = useGeoStore();

  return (
    <div className="relative">
      <MapView
        showUserPosition={permission === "granted"}
        showZones={true}
      />
      
      <GeoStatusBadge
        accuracy={accuracy}
        permission={permission}
        zonesCount={detectedZones.size}
        className="absolute top-4 right-4"
      />
      
      {permission === "granted" && userPosition && (
        <button
          onClick={centerOnUser}
          className={cn(
            "absolute bottom-20 right-4 w-12 h-12 rounded-full",
            "bg-white shadow-lg",
            followUserPosition && "bg-brand-500 text-white"
          )}
          title="Centrar en mi ubicación"
        >
          <LocateIcon />
        </button>
      )}
    </div>
  );
}
```

**Criterios de aceptación:**
- [ ] Botón "Centrar en mí" funciona correctamente
- [ ] Estado activo visual cuando followUserPosition = true
- [ ] GeoStatusBadge siempre visible
- [ ] Transiciones suaves al centrar

---

#### 3.8.2 InicioPage.tsx (Vista V2)

**Mejoras:**
- Mostrar mapa con posición del usuario
- Panel inferior con zona actual y acciones
- Mensaje claro si estás fuera de zonas
- Accesos rápidos contextuales

**Criterios de aceptación:**
- [ ] Mapa ocupa la mayor parte de la pantalla
- [ ] Panel inferior no obstruye el mapa
- [ ] Información de zona clara y actualizada
- [ ] Acciones contextuales según zona

---

### 3.9 Generación de archivos del catálogo

**Script:** `packages/protocol/scripts/generateZoneFiles.ts`

**Responsabilidades:**
1. Leer `zones/zones.json`
2. Validar integridad (sin duplicados, IDs únicos)
3. Generar `zones.index.json` (mapa celda → zoneId)
4. Generar `zones.geo.json` (polígonos para Leaflet)

**Algoritmo para generar polígonos:**
```
Para cada zona:
  1. Decodificar cada celda geohash a su bbox
  2. Crear polígono para cada celda
  3. Unir polígonos contiguos (opcional, simplifica visualización)
  4. Exportar como Feature en GeoJSON
```

**Comandos npm:**
```json
{
  "scripts": {
    "zones:validate": "tsx scripts/validateZones.ts",
    "zones:build": "tsx scripts/generateZoneFiles.ts",
    "zones:watch": "tsx scripts/generateZoneFiles.ts --watch"
  }
}
```

**CI Integration:**
```yaml
- name: Validate zones catalog
  run: pnpm zones:validate
```

**Criterios de aceptación:**
- [ ] Script valida correctamente el catálogo
- [ ] Genera zones.index.json con todas las celdas
- [ ] Genera zones.geo.json válido para Leaflet
- [ ] Falla si hay celdas duplicadas
- [ ] Falla si hay IDs duplicados
- [ ] Se ejecuta en CI en cada PR

---

### 3.10 Herramienta de edición de zonas (apps/zone-editor)

**Aplicación independiente (no se despliega):**

**Funcionalidades mínimas (v1):**
- Mapa Leaflet con cuadrícula de celdas geohash visible
- Selector de zona activa
- Click en celda para asignar/desasignar
- Cada zona con color único
- Importar/exportar zones.json
- Validación en tiempo real

**Funcionalidades futuras (v2):**
- Dibujar polígonos a mano, convertir a celdas
- Comparar versiones del catálogo
- Estadísticas (área, número de celdas)

**Stack:**
- React + Vite (igual que web)
- Leaflet con extensión de grillas
- Zustand para estado local

**Criterios de aceptación (v1):**
- [ ] Muestra cuadrícula de precisión 7
- [ ] Click asigna/desasigna celdas
- [ ] Resalta celdas duplicadas en rojo
- [ ] Exporta zones.json válido
- [ ] README con instrucciones de uso

---

## 4. Actualización del catálogo de zonas

### 4.1 Principios del catálogo

**Reglas fundamentales:**
1. **Una celda, una zona**: Cada celda geohash pertenece a máximo una zona
2. **Sin solapamientos**: El script `zones:validate` rechaza celdas duplicadas
3. **Zonas como conjuntos**: Las zonas son conjuntos de celdas elegidas manualmente
4. **Cuadrícula implícita**: La cuadrícula existe matemáticamente, no hay que crearla
5. **Celdas no asignadas**: Las áreas sin zona pueden leer pero no publicar

**Nota importante sobre solapamientos:**
- El **círculo del usuario** SÍ puede tocar dos zonas vecinas simultáneamente
- En ese caso, el usuario puede publicar en ambas zonas
- Pero las **zonas en sí** no se solapan (ninguna celda pertenece a dos zonas)

### 4.2 Formato actualizado de zones.json

```json
{
  "version": 1,
  "gridPrecision": 7,
  "pilotBounds": [
    [-15.8500, -70.0500],
    [-15.8200, -70.0100]
  ],
  "zones": [
    {
      "id": "puno-laureles",
      "name": "Los Laureles",
      "description": "Zona residencial y de pruebas",
      "type": "permanent",
      "cells": [
        "6mhx2k1",
        "6mhx2k3",
        "6mhx2k4",
        "6mhx2k6"
      ]
    },
    {
      "id": "mercado-central",
      "name": "Mercado Central de Puno",
      "description": "Zona comercial del centro histórico",
      "type": "permanent",
      "cells": [
        "6mhx2n5",
        "6mhx2n7",
        "6mhx2nh"
      ]
    }
  ]
}
```

### 4.3 Tareas

1. **Definir área del piloto:** coordenadas exactas de pilotBounds
2. **Mapear zonas existentes a celdas:**
   - Los Laureles
   - Plaza de Armas (si aplica)
   - Mercado Central (si aplica)
3. **Validar con la herramienta:** sin solapes, IDs estables
4. **Generar archivos derivados:** index y geoJSON

**Criterios de aceptación:**
- [ ] pilotBounds definido correctamente
- [ ] Al menos 2 zonas mapeadas a celdas
- [ ] Validación pasa sin errores
- [ ] Archivos index y geoJSON generados

---

## 5. Garantía de privacidad

### 5.1 Reglas estrictas

| Dato | Dónde vive | ¿Sale del dispositivo? |
|------|-----------|----------------------|
| Latitud/longitud exacta | Solo cliente, en memoria | **NUNCA** |
| Precisión GPS (accuracy) | Solo cliente | **NUNCA** |
| Celdas de precisión 7 | Solo cliente | **NUNCA** |
| ID de zona (ej: `mercado-central`) | Cliente y relay | **SÍ** (al unirse a foro) |
| Geohash precisión 5-6 | Cliente y relay | **SÍ** (Iteración 5, foros de usuario) |
| Área visible del mapa | Proveedor de tiles | **SÍ** (OSM ve tiles pedidos) |

### 5.2 Test de auditoría

**Archivo:** `apps/web/src/geo/__tests__/privacy.test.ts`

```typescript
test("ningún evento de red contiene coordenadas exactas", async () => {
  const capturedEvents: any[] = [];
  
  // Interceptar todos los mensajes del WebSocket
  mockSocket.emit = vi.fn((event, data) => {
    capturedEvents.push({ event, data });
  });
  
  // Simular acciones del usuario
  await publishMessage("Hola");
  await joinForum("zone:mercado-central");
  
  // Verificar que ningún evento tiene lat/lng/accuracy
  for (const evt of capturedEvents) {
    expect(evt.data).not.toHaveProperty("latitude");
    expect(evt.data).not.toHaveProperty("longitude");
    expect(evt.data).not.toHaveProperty("coords");
    expect(evt.data).not.toHaveProperty("accuracy");
    
    // Permitido: zoneId, geohash 5-6 (no en esta iteración)
    if (evt.data.forumId?.startsWith("zone:")) {
      expect(evt.data.forumId).toMatch(/^zone:[a-z0-9-]+$/);
    }
  }
});
```

**Criterios de aceptación:**
- [ ] Test pasa en CI
- [ ] Falla si se envían coordenadas por error
- [ ] Cubre todos los eventos: msg, join_forum, etc.

---

## 6. Documentación de privacidad para usuarios

### 6.1 Actualizar AjustesPage (Sección "Qué datos se comparten")

```tsx
<PrivacyRow
  icon="✅"
  text="Tu ubicación exacta (GPS) nunca sale de este dispositivo. Se usa solo para calcular tu zona."
  ok
/>
<PrivacyRow
  icon="✅"
  text="El servidor solo conoce el nombre de la zona (ej: 'Mercado Central'), nunca tus coordenadas."
  ok
/>
<PrivacyRow
  icon="⚠️"
  text="El proveedor del mapa (OpenStreetMap) ve qué área estás mirando, pero no tu posición exacta."
/>
<PrivacyRow
  icon="⚠️"
  text="Tu precisión GPS se muestra en el mapa solo para ti, nadie más la ve."
/>
```

**Criterios de aceptación:**
- [ ] Explicación clara y honesta
- [ ] Menciona al proveedor de tiles
- [ ] Distingue entre "zona" y "coordenadas"

---

## 7. Política de tiles y contingencia

### 7.1 Cumplimiento de la política de OSM

**Requisitos:**
1. ✅ Atribución visible y correcta
2. ✅ User-Agent identificable en las peticiones
3. ✅ No pre-cachear tiles masivamente
4. ✅ No usar en apps de mucho tráfico sin permiso

**Configuración del User-Agent:**
```typescript
// En la inicialización de Leaflet
L.tileLayer(MAP_TILES_URL, {
  attribution: MAP_TILES_ATTRIBUTION,
  // Identificarse correctamente
  // (Leaflet lo hace por defecto, verificar en Network tab)
});
```

### 7.2 Plan B: Proveedores alternativos

Si el tráfico crece o hay problemas con OSM:

**Opciones gratuitas:**
- [Stadia Maps](https://stadiamaps.com/) - 10K tiles/día gratis
- [MapTiler](https://www.maptiler.com/) - 100K tiles/mes gratis
- [Thunderforest](https://www.thunderforest.com/) - API key gratuita limitada

**Cambio de proveedor:**
```typescript
// Solo cambiar esta línea en constants.ts
export const MAP_TILES_URL = "https://tiles.stadiamaps.com/...";
```

**Criterios de aceptación:**
- [ ] Atribución visible en el mapa
- [ ] User-Agent se envía correctamente
- [ ] Documentado el proceso de cambio de proveedor
- [ ] Constante única facilita el cambio

---

## 8. Pruebas

### 8.1 Pruebas unitarias (Vitest)

**Archivos:**
- `geo/geoCore.test.ts`
- `geo/zoneCatalog.test.ts`
- `geo/accessPolicy.test.ts`

**Casos de prueba:**

```typescript
describe("geoCore", () => {
  test("conversión geohash ida y vuelta", () => {
    const lat = -15.8369, lng = -70.0211;
    const hash = coordinatesToGeohash(lat, lng, 7);
    const decoded = decodeGeohash(hash);
    expect(decoded.latitude).toBeCloseTo(lat, 4);
    expect(decoded.longitude).toBeCloseTo(lng, 4);
  });

  test("cellsTouchingCircle con círculo pequeño", () => {
    const cells = cellsTouchingCircle(-15.8369, -70.0211, 50, 7);
    expect(cells.length).toBeGreaterThan(0);
    expect(cells.length).toBeLessThan(10); // Círculo pequeño toca pocas celdas
  });

  test("círculo en frontera de celdas", () => {
    // Posición justo en el borde entre 2 celdas
    const cells = cellsTouchingCircle(-15.8350, -70.0200, 100, 7);
    expect(cells.length).toBeGreaterThanOrEqual(2);
  });
});

describe("accessPolicy", () => {
  test("usuario dentro de zona puede publicar", () => {
    const position = { lat: -15.8369, lng: -70.0211, accuracy: 80, timestamp: Date.now() };
    const result = canPublishInZoneForum(position, "puno-laureles", catalog, index);
    expect(result.status).toBe("granted");
  });

  test("usuario a >150m de zona no puede publicar", () => {
    const position = { lat: -15.8500, lng: -70.0400, accuracy: 50, timestamp: Date.now() };
    const result = canPublishInZoneForum(position, "puno-laureles", catalog, index);
    expect(result.status).toBe("denied");
  });

  test("precisión >300m devuelve low_accuracy", () => {
    const position = { lat: -15.8369, lng: -70.0211, accuracy: 350, timestamp: Date.now() };
    const result = canPublishInZoneForum(position, "puno-laureles", catalog, index);
    expect(result.status).toBe("low_accuracy");
  });
});
```

**Criterios de aceptación:**
- [ ] >90% cobertura de geoCore
- [ ] >90% cobertura de accessPolicy
- [ ] Todos los casos borde cubiertos
- [ ] Pruebas rápidas (<100ms cada una)

---

### 8.2 Pruebas E2E (Playwright)

**Archivo:** `e2e/geolocation.spec.ts`

```typescript
test("usuario dentro de zona puede publicar", async ({ context }) => {
  // Simular GPS dentro de Los Laureles
  await context.setGeolocation({ latitude: -15.8369, longitude: -70.0211 });
  await context.grantPermissions(["geolocation"]);

  const page = await context.newPage();
  await page.goto("/");

  // Verificar que se detecta la zona
  await expect(page.locator('[data-testid="current-zone"]')).toContainText("Los Laureles");

  // Ir al foro
  await page.click('text="Los Laureles"');

  // El campo de texto debe estar habilitado
  await expect(page.locator('[data-testid="message-input"]')).toBeEnabled();
});

test("usuario fuera de zona solo lee", async ({ context }) => {
  // Simular GPS lejos de todas las zonas
  await context.setGeolocation({ latitude: -15.9000, longitude: -70.1000 });
  await context.grantPermissions(["geolocation"]);

  const page = await context.newPage();
  await page.goto("/");

  await page.click('text="Los Laureles"');

  // El campo debe estar deshabilitado
  await expect(page.locator('[data-testid="message-input"]')).toBeDisabled();
  await expect(page.locator('text="Solo lectura"')).toBeVisible();
});

test("mapa muestra posición del usuario", async ({ context, page }) => {
  await context.setGeolocation({ latitude: -15.8369, longitude: -70.0211 });
  await context.grantPermissions(["geolocation"]);

  await page.goto("/");

  // Esperar a que el mapa cargue
  await page.waitForSelector('.leaflet-container');

  // Verificar que hay un marcador (círculo) de posición
  await expect(page.locator('.leaflet-marker-icon')).toBeVisible();
});
```

**Criterios de aceptación:**
- [ ] Pruebas de posición dentro/fuera de zona
- [ ] Pruebas de permiso denegado
- [ ] Pruebas de visualización en el mapa
- [ ] Simulación de movimiento

---

### 8.3 Pruebas de privacidad

**Integración en CI:**
```yaml
- name: Privacy audit
  run: pnpm test:privacy
```

**Criterios de aceptación:**
- [ ] Test de coordenadas en eventos pasa
- [ ] Se ejecuta en cada PR
- [ ] Falla si alguien añade coordenadas por error

---

## 9. Criterios de aceptación globales

### 9.1 Funcionalidad

- [ ] Usuario ve su posición en el mapa en tiempo real
- [ ] Círculo de precisión refleja la calidad del GPS
- [ ] Botón "Centrar en mí" funciona correctamente
- [ ] Indicador de precisión (buena/aceptable/débil) es claro
- [ ] Sin permiso GPS, el mapa funciona en modo exploración
- [ ] Usuario dentro de zona puede publicar
- [ ] Usuario fuera de zona solo puede leer
- [ ] Usuario en borde de 2 zonas puede publicar en ambas
- [ ] watchPosition actualiza solo con movimiento >25m
- [ ] Posición vieja (>60s) se actualiza antes de publicar

### 9.2 Privacidad

- [ ] NINGUNA coordenada exacta sale del dispositivo
- [ ] Test de privacidad pasa en CI
- [ ] Solo se envían IDs de zona al relay
- [ ] Vista de privacidad explica correctamente qué se comparte
- [ ] Proveedor de tiles mencionado en la documentación

### 9.3 Performance

- [ ] Mapa carga en <2s en conexión 3G
- [ ] watchPosition no consume excesiva batería
- [ ] Cálculo de celdas <50ms (funciones puras)
- [ ] Renderizado de 5-10 zonas sin lag

### 9.4 Calidad de código

- [ ] Arquitectura modular implementada
- [ ] Funciones puras separadas de efectos
- [ ] Cobertura de tests >85%
- [ ] Documentación JSDoc completa
- [ ] Sin console.log ni TODOs en producción

### 9.5 Herramientas

- [ ] Script de validación de zonas funciona
- [ ] Script de generación de archivos funciona
- [ ] Zone-editor permite editar el catálogo
- [ ] CI valida el catálogo en cada PR

---

## 10. Orden de implementación recomendado

### Fase 1: Fundamentos (días 1-3)
1. Constantes de configuración
2. geoCore.ts (funciones puras)
3. Pruebas unitarias de geoCore
4. Script de generación de archivos del catálogo
5. Actualizar zones.json con celdas

### Fase 2: Servicios (días 4-5)
6. zoneCatalog.ts
7. accessPolicy.ts
8. Pruebas unitarias de accessPolicy
9. locationService.ts
10. Actualizar geoStore

### Fase 3: UI (días 6-8)
11. Componentes del mapa:
    - MapView
    - ZonesLayer
    - UserPositionLayer
    - GeoStatusBadge
12. Actualizar ZoneMap.tsx
13. Actualizar InicioPage.tsx

### Fase 4: Herramientas y docs (días 9-10)
14. Zone-editor (v1 mínima)
15. Actualizar documentación de privacidad
16. Pruebas E2E
17. Test de privacidad en CI

---

## 11. Decisiones pendientes

1. **Área exacta del piloto:** coordenadas de pilotBounds
2. **Zonas iniciales:** ¿cuántas zonas mapear en el MVP?
3. **Valores de radio:** validar 50-150m en campo
4. **Proveedor de tiles:** ¿OSM directo o alternativa desde día 1?
5. **Zone-editor:** ¿desarrollar en Iteración 1 o después?

---

## 12. Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| Política de OSM impide uso | Media | Alto | Plan B con proveedor alternativo ya definido |
| GPS impreciso en ciudad | Alta | Medio | Radio de 150m tolera imprecisión; aviso claro al usuario |
| Batería consumida por watchPosition | Media | Medio | Solo actualizar con movimiento >25m; maximumAge = 5s |
| Celdas geohash no alinean con fronteras naturales | Alta | Bajo | Aceptado; validar en campo y ajustar catálogo |
| Performance en móviles viejos | Media | Medio | Funciones puras optimizadas; lazy loading de capas |

---

## 13. Documentación a actualizar

1. **README principal:** añadir sección de geolocalización
2. **Docs de arquitectura:** explicar el módulo geo/
3. **Guía de contribución:** cómo editar el catálogo de zonas
4. **Vista de privacidad:** actualizar con info del mapa
5. **FAQ:** explicar por qué el GPS es falsificable

---

## Fin del plan

**Próximos pasos:**
1. Revisar y aprobar este plan
2. Decidir valores pendientes (sección 11)
3. Crear issues en GitHub por módulo
4. Comenzar implementación en orden recomendado

**Preguntas o ajustes:** abrir un issue o comentar en la PR de este documento.
