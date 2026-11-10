# 🛠️ GUÍA PRÁCTICA DE DESARROLLO - ZonaViva

**Recorrido paso a paso por el código, ejercicios y casos de uso**

---

## 📍 TABLA DE CONTENIDOS

1. [Recorrido de Inicio Rápido](#recorrido-de-inicio-rápido)
2. [Ejercicios Prácticos](#ejercicios-prácticos)
3. [Casos de Uso Detallados](#casos-de-uso-detallados)
4. [Debugging y Troubleshooting](#debugging-y-troubleshooting)
5. [Checklist de Desarrollo](#checklist-de-desarrollo)

---

# 1. RECORRIDO DE INICIO RÁPIDO

## 1.1 Primer Contacto: Entiende qué es una Zona

### Paso 1: Visualiza una Zona

```bash
# Abre este archivo
packages/protocol/zones/zones.json

# Verás estructura:
{
  "zones": [
    {
      "id": "puno-centro",
      "name": "Centro de Puno",
      "cells": ["6mnjye4", "6mnjye5", "6mnjyeh", ...]
    }
  ]
}

# ¿Qué ves?
# - Una zona es un conjunto de celdas (geohashes)
# - Cada celda es ~153m × 153m
# - La zona es la UNIÓN de esos rectángulos
# - Forma irregular, como píxeles grandes
```

### Paso 2: Entiende el Índice

```bash
# Abre este archivo
packages/protocol/zones/zones.index.json

# Verás estructura:
{
  "6mnjye4": "puno-centro",
  "6mnjye5": "puno-centro",
  "6mnjyeh": "puno-centro",
  ...
}

# ¿Qué ves?
# - Índice: celda → zona
# - Búsqueda O(1): "¿Qué zona tiene esta celda?"
# - 189 celdas en total
# - SIN SOLAPAMIENTOS (cada celda ∈ 1 zona)
```

### Paso 3: Entiende el GeoJSON

```bash
# Abre este archivo
packages/protocol/zones/zones.geo.json

# Verás estructura:
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": { "zoneId": "puno-centro", "cell": "6mnjye4" },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[...], [...], [...], [...]]
      }
    }
  ]
}

# ¿Qué ves?
# - Cada celda es un Feature GeoJSON
# - Tiene geometría (Polygon con 4 vértices)
# - Se puede visualizar en Leaflet
# - Todas las celdas están georreferenciadas
```

## 1.2 Segundo Contacto: Explora geoCore.ts

### Paso 1: Lee las funciones

```bash
# Abre
apps/web/src/geo/geoCore.ts

# Busca estas funciones y entiende qué hacen:

1. coordinatesToGeohash(lat, lng, precision)
   - INPUT: (-15.8402, -70.0219, 7)
   - OUTPUT: "6mnjye4"
   - ¿Qué pasó? Codificó coordenadas en geohash

2. cellsTouchingCircle(lat, lng, radius, precision)
   - INPUT: (-15.8402, -70.0219, 100, 7)
   - OUTPUT: ["6mnjye4", "6mnjye5", "6mnjyeh", ...]
   - ¿Qué pasó? Encontró todas las celdas que toca el círculo
   - Este es el CORE del sistema
```

### Paso 2: Ejecuta los tests

```bash
cd apps/web

# Ver todos los tests de geoCore
pnpm test geoCore --reporter=verbose

# Resultado esperado:
# ✓ coordinatesToGeohash and decodeGeohash (4)
# ✓ distanceMeters (3)
# ✓ calculateEffectiveRadius (3)
# ✓ cellsTouchingCircle (5)
# ✓ getNeighborGeohashes (3)
# ✓ isValidGeohash (4)
# ✓ geohashCellArea and formatArea (3)
# Total: 27 tests passing
```

### Paso 3: Prueba una función en la consola

```typescript
// En Chrome DevTools (F12), en la consola:

// Paso 1: Importar desde web
import { coordinatesToGeohash } from '/src/geo/geoCore.ts'

// Paso 2: Llamar la función
const hash = coordinatesToGeohash(-15.8402, -70.0219, 7)
console.log(hash)
// Output: "6mnjye4"

// Paso 3: Verificar que está en una zona
import { getZoneIdByCell } from '/src/geo/zoneCatalog.ts'
const zoneId = getZoneIdByCell(hash)
console.log(zoneId)
// Output: "puno-centro"
```

## 1.3 Tercer Contacto: Entiende el Store

### Paso 1: Lee geoStore.ts

```bash
# Abre
apps/web/src/stores/geoStore.ts

# Identifica:
1. Interface GeoState (qué datos se guardan)
2. startWatching() (cómo inicia GPS)
3. effectiveZone() (cómo calcula zona activa)
```

### Paso 2: Visualiza el estado en DevTools

```bash
# En el navegador, con la app corriendo:

# 1. Abre DevTools (F12)
# 2. En la consola:

import { useGeoStore } from '/src/stores/geoStore.ts'

// Obtener estado completo
const state = useGeoStore.getState()
console.log(state)

// Ver solo la posición
console.log(state.userPosition)

// Ver zonas detectadas
console.log(state.detectedZones)

// Ver la zona efectiva
console.log(state.effectiveZone())
```

### Paso 3: Suscribirse a cambios

```typescript
// En la consola:

import { useGeoStore } from '/src/stores/geoStore.ts'

// Suscribirse a cambios de posición
const unsubscribe = useGeoStore.subscribe(
  (state) => state.userPosition,
  (position) => {
    console.log("Posición actualizada:", position)
  }
)

// Ahora, cada que cambie la posición, verás logs
// Para dejar de escuchar:
unsubscribe()
```

---

# 2. EJERCICIOS PRÁCTICOS

## 2.1 Ejercicio 1: Calcula la distancia a una zona

### Objetivo

Dado un usuario en una posición, calcular la distancia mínima a cada zona.

### Pasos

```typescript
// 1. Crea función en geo/geoCore.ts

export function distanceToZone(
  userLat: number,
  userLng: number,
  zone: Zone,
  precision: number
): number {
  // Calcula distancia mínima del usuario a cualquier celda de la zona
  
  // Pista: 
  // - Obtén el geohash de cada celda
  // - Decodifica para obtener el bbox
  // - Calcula distancia del usuario al bbox
  // - Retorna el mínimo
  
  let minDistance = Infinity;
  
  for (const cellHash of zone.cells) {
    const cellBbox = decodeGeohash(cellHash).bbox;
    const dist = distanceToRect(userLat, userLng, cellBbox);
    minDistance = Math.min(minDistance, dist);
  }
  
  return minDistance;
}

// 2. Escribe un test

it("calculates distance to zone correctly", () => {
  const position = { lat: -15.8402, lng: -70.0219 };
  const zone = ZONES[0]; // puno-centro
  
  const distance = distanceToZone(
    position.lat,
    position.lng,
    zone,
    7
  );
  
  // El usuario está EN la zona, distancia debe ser 0
  expect(distance).toBe(0);
});

// 3. Verifica
pnpm test distanceToZone --run
```

### Solución Completa

```typescript
// geo/geoCore.ts
export function distanceToZone(
  userLat: number,
  userLng: number,
  zone: Zone,
  precision: number = GRID_PRECISION
): number {
  let minDistance = Infinity;
  
  for (const cellHash of zone.cells) {
    const decoded = decodeGeohash(cellHash);
    const [minLat, minLng, maxLat, maxLng] = decoded.bbox;
    
    // Crear bbox object para distanceToRect
    const cellBbox = [minLat, minLng, maxLat, maxLng];
    const dist = distanceToRect(userLat, userLng, cellBbox);
    
    minDistance = Math.min(minDistance, dist);
  }
  
  return minDistance;
}
```

## 2.2 Ejercicio 2: Agregar nueva zona

### Objetivo

Agregar una nueva zona "puno-hospital" con 10 celdas.

### Pasos

```bash
# 1. Calcula 10 geohashes que formen un área rectangular
# Usa una herramienta online o manualmente:
# - Elige un área central
# - Codifica varias coordenadas para obtener geohashes
# - Verifica que NO solapen con zonas existentes

CELDAS_NUEVAS=[
  "6mnjye8",
  "6mnjye9",
  "6mnjyed",
  "6mnjyee",
  "6mnjyes",
  "6mnjykn",
  "6mnjykp",
  "6mnjykq",
  "6mnjykr",
  "6mnjykw"
]

# 2. Abre zones/zones.json y agrega:

{
  "id": "puno-hospital",
  "name": "Hospital Regional",
  "description": "Hospital Regional Manuel Núñez Butrón",
  "type": "permanent",
  "cells": ["6mnjye8", "6mnjye9", ...]
}

# 3. Valida
cd packages/protocol
pnpm zones:validate

# Esperado:
# ✓ Versión del catálogo: 1
# ✓ Zonas definidas: 5
# ✓ Total de celdas: 199
# ✅ Validación EXITOSA

# 4. Sincroniza
pnpm zones:sync
pnpm build

# 5. Verifica que aparece en código
cat src/zones.ts | grep "puno-hospital"

# 6. Test
cd ../../apps/web
pnpm test --run
```

### Verificación

```typescript
// En la consola:
import { getAllZones } from '/src/geo/zoneCatalog.ts'

const zones = getAllZones()
console.log(zones.length)  // Debe ser 5
console.log(zones.find(z => z.id === "puno-hospital"))
// Output: {id: "puno-hospital", name: "Hospital Regional", ...}
```

## 2.3 Ejercicio 3: Detecta si usuario puede publicar

### Objetivo

Verificar si un usuario en posición X puede publicar en zona Y.

### Pasos

```typescript
// 1. Importa las funciones
import { canPublishInZoneForum } from '/src/geo/accessPolicy.ts'
import type { UserPosition } from '/src/geo/accessPolicy.ts'

// 2. Crea una posición simulada
const userPosition: UserPosition = {
  latitude: -15.8402,
  longitude: -70.0219,
  accuracy: 50,  // Buena precisión
  timestamp: Date.now()
}

// 3. Verifica acceso
const check = canPublishInZoneForum(userPosition, "puno-centro")

console.log(check)
// Output:
// {
//   canPublish: true,
//   detectedZones: [{id: "puno-centro", ...}],
//   touchedCells: ["6mnjye4", "6mnjye5", ...]
// }

// 4. Testa casos fallidos
const badAccuracy: UserPosition = {
  ...userPosition,
  accuracy: 500  // Mala precisión
}
const check2 = canPublishInZoneForum(badAccuracy, "puno-centro")
console.log(check2.canPublish)  // false
console.log(check2.reason)  // "Precisión insuficiente (500m)"
```

---

# 3. CASOS DE USO DETALLADOS

## 3.1 Caso: Usuario Abre la App

```
Timeline:
──────────────────────────────────────────

T=0s: Usuario abre https://localhost:5173

T=0.1s: main.tsx renderiza App.tsx
        → Zustand stores se inicializan vacíos

T=0.2s: App.tsx useEffect → geoStore.startWatching()
        → Llama locationService.startWatchingPosition()

T=0.3s: Navegador pide permiso GPS
        → Ventana modal: "¿Permitir ubicación?"

T=1s: Usuario acepta permiso

T=1.5s: Navegador obtiene primera posición
        → Position { latitude: -15.8402, longitude: -70.0219, accuracy: 87 }

T=1.6s: locationService llama onUpdate callback

T=1.65s: geoStore.setState({
          userPosition: position,
          userCells: getUserCells(position),  // ["6mnjye4", "6mnjye5", ...]
          detectedZones: getAccessibleZones(position)  // [{id: "puno-centro", ...}]
        })

T=1.7s: Zustand notifica suscriptores

T=1.8s: Componentes se re-renderizan
        → InicioPage muestra "Centro de Puno"
        → StatusDot verde (✓ GPS activo)
        → ZoneMap actualiza

T=2s: Usuario ve:
      - Zona detectada: "Centro de Puno"
      - Ubicación precisa: "✓ Ubicación activa (±87m)"
      - Botón "Ver foros de esta zona"
```

### Código Relevante

```typescript
// InicioPage.tsx
function InicioPage() {
  const { status, effectiveZone: getEffectiveZone } = useGeoStore();
  
  const zone = getEffectiveZone();
  
  return (
    <>
      <StatusDot status={status} />
      {zone && <h1>{zone.name}</h1>}
      <button onClick={/* navegar a foros de la zona */}>
        Ver foros ({zone?.cells.length} celdas)
      </button>
    </>
  );
}
```

## 3.2 Caso: Usuario Cambia de Ubicación

```
Timeline:
──────────────────────────────────────────

T=10s: Usuario camina 30 metros
       GPS detecta: lat=-15.8405, lng=-70.0225

T=10.1s: locationService calcula distancia
         distancia = distanceMeters(
           -15.8402, -70.0219,   // posición anterior
           -15.8405, -70.0225    // posición nueva
         )
         = ~30 metros

T=10.15s: ¿ >= MIN_MOVEMENT_THRESHOLD (25m)?
          SÍ → Emitir onUpdate

T=10.2s: geoStore calcula nuevas celdas
         newCells = getUserCells(newPosition)
         // Probablemente: ["6mnjye4", "6mnjye5", "6mnjyeh", ...]
         // Algunas celdas igual, algunas nuevas

T=10.25s: Calcula nuevas zonas accesibles
          newZones = getAccessibleZones(newPosition)
          // Sigue siendo "puno-centro"

T=10.3s: ¿Cambió zona?
         oldZones = ["puno-centro"]
         newZones = ["puno-centro"]
         NO → No hacer nada especial

T=10.5s: Si el usuario hubiera caminado 500m:
         newZones = ["puno-puerto"]
         ¿Cambió? SÍ → Mostrar notificación
         "Ahora en: Puerto y Lago Titicaca"

T=11s: UI actualizada con nueva zona
```

### Código Relevante

```typescript
// locationService.ts - Filtrado
if (hasMovedSignificantly(state.lastPosition, position)) {
  state.lastPosition = newPosition;
  state.onUpdate?.(newPosition);  // ← Emite
}

// accessPolicy.ts - Cálculo
export function getAccessibleZones(position: UserPosition): Zone[] {
  const cells = getUserCells(position);
  return getZonesByCells(cells);
}

// geoStore.ts - Integración
startWatchingPosition(
  (position) => {
    const cells = getUserCells(position);
    const zones = getAccessibleZones(position);
    
    set({
      userPosition: position,
      userCells: cells,
      detectedZones: zones
    });
  },
  ...
)
```

## 3.3 Caso: Usuario Intenta Publicar

```
Timeline:
──────────────────────────────────────────

T=0s: Usuario en Chat de "puno-centro"
      Escribe: "Hola, ¿alguien aquí?"
      Toca botón "Enviar"

T=0.1s: ChatPage.tsx llama:
        publishMessage(
          content: "Hola, ¿alguien aquí?",
          session: userSession,
          zone: ZONES[0]  // puno-centro
        )

T=0.2s: forumStore.publishMessage() hace:
        
        // 1. Valida acceso
        const check = canPublishInZoneForum(
          geoStore.userPosition,
          "puno-centro"
        )
        
        if (!check.canPublish) {
          showError(check.reason)
          return
        }

        // 2. Crea mensaje
        const message = {
          id: generateULID(),
          forumId: "zone:puno-centro",
          content: "Hola, ¿alguien aquí?",
          alias: session.alias,
          authorKey: session.publicKey,
          clientTs: Date.now(),
          sig: HMAC(content, session.privateKey)
        }

T=0.3s: // 3. Envía al relay
        socket.emit('message', message)

T=0.4s: Relay recibe y valida:
        - ¿Firma válida? 
          verify(message.sig, message.content, message.authorKey)
        - ¿Mensaje duplicado?
          if (messageId in seenMessages) reject
        - ¿Mensaje dentro del plazo?
          if (Date.now() - clientTs > 24h) reject

T=0.5s: Relay acepta y firma:
        message.sig_relay = HMAC(content, relay.privateKey)
        message.relayTs = Date.now()

T=0.6s: Relay distribuye a otros usuarios en sala:
        socket.broadcast.to('zone:puno-centro').emit('message', message)

T=0.7s: Usuario A (también en la zona) recibe:
        forumStore.addMessage(message)

T=0.8s: // Valida firma
        verify(message.sig, message.content, message.authorKey) ✓

T=0.9s: // Guarda en IndexedDB
        db.messages.add(message)

T=1.0s: ChatPage.tsx re-renderiza:
        Muestra mensaje en la lista:
        [Alias] Hola, ¿alguien aquí?

T=1s-end: Usuario B ve el mensaje en tiempo real
```

### Código Relevante

```typescript
// forumStore.ts
export const useForumStore = create((set, get) => ({
  publishMessage: async (content, session, zone) => {
    // 1. Validar acceso
    const { userPosition } = useGeoStore.getState();
    const check = canPublishInZoneForum(userPosition, zone.id);
    
    if (!check.canPublish) {
      throw new Error(check.reason);
    }
    
    // 2. Crear mensaje
    const message: Message = {
      id: generateULID(),
      forumId: `zone:${zone.id}`,
      content,
      alias: session.alias,
      authorKey: session.publicKey,
      clientTs: Date.now(),
      sig: signMessage(content, session.privateKey)
    };
    
    // 3. Enviar
    socket.emit('message', message);
    
    // 4. Guardar localmente
    set(state => ({
      messages: {
        ...state.messages,
        [zone.id]: [...(state.messages[zone.id] || []), message]
      }
    }));
  }
}));
```

---

# 4. DEBUGGING Y TROUBLESHOOTING

## 4.1 Debugging de Geolocalización

### Problema: "Ubicación no disponible"

```typescript
// Diagnóstico paso a paso

// 1. Verifica si API está disponible
import { isGeolocationAvailable } from '/src/geo/locationService.ts'
console.log(isGeolocationAvailable())
// Si false → GPS no soportado en este navegador

// 2. Verifica estado del servicio
import { useGeoStore } from '/src/stores/geoStore.ts'
const state = useGeoStore.getState()
console.log(state.status)
// Valores esperados: 'active', 'requesting', 'inactive'

// 3. Verifica posición
console.log(state.userPosition)
// Si null → Aún no hay posición

// 4. Verifica error
console.log(state.error)
// Si hay error, aquí está el mensaje

// 5. Inicia watch manualmente
state.startWatching()

// 6. Espera 2 segundos y verifica de nuevo
setTimeout(() => {
  const state2 = useGeoStore.getState()
  console.log(state2)
}, 2000)
```

### Problema: Usuario no puede ver sus zonas

```typescript
// Diagnóstico

// 1. Verifica posición
const { userPosition, detectedZones } = useGeoStore.getState()
console.log("Position:", userPosition)
console.log("Detected zones:", detectedZones)

// 2. Verifica si posición es fresca
import { isPositionFresh } from '/src/geo/accessPolicy.ts'
console.log("Fresh?", isPositionFresh(userPosition))
// Si false → Espera y verifica de nuevo

// 3. Verifica si posición es precisa
import { isPositionAccurate } from '/src/geo/accessPolicy.ts'
console.log("Accurate?", isPositionAccurate(userPosition))
// Si false → Mejora ubicación del dispositivo

// 4. Calcula celdas
import { getUserCells } from '/src/geo/accessPolicy.ts'
const cells = getUserCells(userPosition)
console.log("Touched cells:", cells)

// 5. Verifica cada celda
import { getZoneIdByCell } from '/src/geo/zoneCatalog.ts'
cells.forEach(cell => {
  console.log(`${cell} → ${getZoneIdByCell(cell) || 'no zone'}`)
})
```

## 4.2 Debugging de Zonas

### Problema: Nueva zona no aparece

```bash
# Paso 1: Verifica zones.json
cat packages/protocol/zones/zones.json | grep "puno-nueva"
# Si no está → Agrega la zona al JSON

# Paso 2: Valida
cd packages/protocol
pnpm zones:validate
# Si falla → Verifica solapamientos

# Paso 3: Sincroniza a TypeScript
pnpm zones:sync
pnpm build

# Paso 4: En la consola del navegador
import { getAllZones } from '/src/geo/zoneCatalog.ts'
console.log(getAllZones().find(z => z.id === "puno-nueva"))
# Si aparece → Funciona correctamente
```

### Problema: Zona tiene solapamientos

```bash
# Paso 1: Valida
cd packages/protocol
pnpm zones:validate

# Si falla con: "Celda duplicada: 6mnjye4"
# → La celda está en 2+ zonas

# Paso 2: Encuentra el duplicado
grep "6mnjye4" zones/zones.json
# Output:
# "zones": [{"cells": ["6mnjye4", ...]}, {"cells": ["6mnjye4", ...]}]

# Paso 3: Elimina el duplicado de una zona
nano zones/zones.json
# Busca "6mnjye4" y elimina de una de las zonas

# Paso 4: Revalida
pnpm zones:validate
# Debe pasar sin errores
```

## 4.3 Debugging de Tests

### Test falla: "expected X to be Y"

```typescript
// Ejemplo de test que falla
it("calculates distance correctly", () => {
  const distance = distanceMeters(-15.8402, -70.0219, -15.8405, -70.0225)
  expect(distance).toBe(30)  // ← Falla, obtiene 29.8
})

// Solución: Usa toBeCloseTo
expect(distance).toBeCloseTo(30, 1)
// El 1 significa: tolera diferencias de ±10^-1 = ±0.1

// O especifica decimales
expect(distance).toBeCloseTo(30, 0)  // ±1
expect(distance).toBeCloseTo(30, 1)  // ±0.1
expect(distance).toBeCloseTo(30, 2)  // ±0.01
```

---

# 5. CHECKLIST DE DESARROLLO

## 5.1 Pre-Commit Checklist

- [ ] TypeScript compila sin errores: `pnpm build`
- [ ] Tests pasan: `pnpm test --run`
- [ ] No hay console.logs de debug
- [ ] No hay `any` tipos
- [ ] Funciones tienen JSDoc
- [ ] Cambios de zonas validados: `pnpm zones:validate`

## 5.2 Pre-Deploy Checklist

- [ ] Fase completada en documentación
- [ ] README actualizado
- [ ] CHANGELOG actualizado
- [ ] Build de producción: `pnpm build`
- [ ] Tests pasan en CI
- [ ] No hay warnings de TypeScript
- [ ] Performance acceptable (<3s load time)

## 5.3 Código Review Checklist

- [ ] ¿La función es pura? (sin side effects)
- [ ] ¿Hay tests? (cobertura > 80%)
- [ ] ¿Los tipos son específicos? (no `any`)
- [ ] ¿Está documentada? (JSDoc)
- [ ] ¿Es performante? (O(1) o O(n) aceptable)
- [ ] ¿Maneja errores?
- [ ] ¿Es accesible? (WCAG basics)

---

# CONCLUSIÓN

Esta guía práctica te proporciona:

1. **Recorrido estructurado**: Comienza desde conceptos simples (zonas) hasta complejos (publicación)
2. **Ejercicios progresivos**: Construye habilidades gradualmente
3. **Casos reales**: Entiende cómo funciona todo junto
4. **Herramientas de debug**: Resuelve problemas cuando ocurran
5. **Checklists**: Mantén calidad constante

**Próximo paso:** Elige un ejercicio y complétalo, luego continúa con Fase 3 (UI).

¡Feliz desarrollo! 🚀
