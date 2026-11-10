# 🧩 ARQUITECTURA MODULAR - ZonaViva

**Análisis de modularidad actual y propuesta de mejora**

---

## 1. ESTADO ACTUAL (Sin modularización clara)

### Estructura Actual

```
apps/web/src/
├── components/          ← Mezcla de Todo
│   ├── ZoneMap.tsx      ← UI + Lógica geo
│   ├── StatusDot.tsx    ← UI + Lógica de estado
│   └── GeoPermissionBanner.tsx
│
├── pages/              ← Componentes de página
│   ├── InicioPage.tsx  ← Lógica de negocio + UI
│   ├── ChatPage.tsx
│   ├── ForoPage.tsx
│   └── AjustesPage.tsx
│
├── stores/             ← Estado global
│   ├── geoStore.ts     ← GPS + Zonas
│   ├── forumStore.ts   ← Foros + Mensajes
│   └── identityStore.ts
│
├── geo/                ← Servicios geo (bien separado ✓)
│   ├── geoCore.ts
│   ├── zoneCatalog.ts
│   ├── accessPolicy.ts
│   └── locationService.ts
│
├── modules/            ← Módulos legacy
│   ├── geo.ts          ← Deprecated
│   ├── identity.ts
│   ├── network.ts
│   ├── e2ee.ts
│   └── relayCrypto.ts
│
└── db/                 ← Storage
    ├── index.ts
    └── storage.ts
```

### Problemas Identificados

❌ **Baja modularidad:**
- Components mezclan UI con lógica
- Pages tiene lógica de negocio
- Stores muy acoplados
- Módulos legacy sin usar correctamente

❌ **Acoplamiento:**
- Componentes dependen directamente de stores
- Difícil reutilizar lógica
- Difícil testear

❌ **Falta de límites claros:**
- No está claro qué es responsable de qué
- Cambios en UI afectan lógica

---

## 2. PROPUESTA: ARQUITECTURA MODULAR MODERNA

### 2.1 División Ideal en Módulos

```
apps/web/src/

├── @modules/
│   ├── geolocation/           ← MÓDULO GEO
│   │   ├── index.ts           ← Barril de exportación
│   │   ├── core/
│   │   │   ├── geoCore.ts     (funciones puras)
│   │   │   ├── zoneCatalog.ts (índice)
│   │   │   └── types.ts       (tipos internos)
│   │   ├── services/
│   │   │   ├── accessPolicy.ts
│   │   │   ├── locationService.ts
│   │   │   └── index.ts       (barril)
│   │   ├── hooks/
│   │   │   ├── useGeoLocation.ts
│   │   │   ├── useZoneDetection.ts
│   │   │   └── useAccessCheck.ts
│   │   ├── __tests__/
│   │   │   ├── geoCore.test.ts
│   │   │   ├── accessPolicy.test.ts
│   │   │   └── zoneCatalog.test.ts
│   │   └── README.md          (documentación)
│   │
│   ├── forums/                ← MÓDULO FOROS
│   │   ├── index.ts
│   │   ├── core/
│   │   │   ├── types.ts       (Forum, Message)
│   │   │   ├── constants.ts
│   │   │   └── validators.ts
│   │   ├── services/
│   │   │   ├── forumService.ts
│   │   │   ├── messageService.ts
│   │   │   └── syncService.ts
│   │   ├── hooks/
│   │   │   ├── useForumList.ts
│   │   │   ├── useMessages.ts
│   │   │   └── usePublishMessage.ts
│   │   ├── components/
│   │   │   ├── ForumCard.tsx
│   │   │   ├── MessageList.tsx
│   │   │   └── MessageInput.tsx
│   │   ├── __tests__/
│   │   │   ├── forumService.test.ts
│   │   │   └── messageService.test.ts
│   │   └── README.md
│   │
│   ├── identity/              ← MÓDULO IDENTIDAD
│   │   ├── index.ts
│   │   ├── core/
│   │   │   ├── types.ts       (Session, User)
│   │   │   ├── crypto.ts      (keypair generation)
│   │   │   └── validators.ts
│   │   ├── services/
│   │   │   ├── sessionService.ts
│   │   │   └── cryptoService.ts
│   │   ├── hooks/
│   │   │   ├── useSession.ts
│   │   │   ├── useIdentity.ts
│   │   │   └── useAuth.ts
│   │   ├── __tests__/
│   │   │   └── crypto.test.ts
│   │   └── README.md
│   │
│   ├── ui/                    ← MÓDULO UI (Shared Components)
│   │   ├── index.ts
│   │   ├── atoms/
│   │   │   ├── Button.tsx
│   │   │   ├── Badge.tsx
│   │   │   └── Icon.tsx
│   │   ├── molecules/
│   │   │   ├── StatusDot.tsx
│   │   │   ├── Banner.tsx
│   │   │   └── Card.tsx
│   │   ├── organisms/
│   │   │   ├── ZoneMap.tsx
│   │   │   ├── ChatBox.tsx
│   │   │   └── Navigation.tsx
│   │   ├── theme/
│   │   │   ├── colors.ts
│   │   │   ├── spacing.ts
│   │   │   └── typography.ts
│   │   └── __tests__/
│   │       └── Button.test.tsx
│   │
│   └── storage/               ← MÓDULO ALMACENAMIENTO
│       ├── index.ts
│       ├── adapters/
│       │   ├── indexedDB.ts
│       │   └── localStorage.ts
│       ├── repositories/
│       │   ├── messageRepository.ts
│       │   ├── sessionRepository.ts
│       │   └── preferenceRepository.ts
│       ├── __tests__/
│       │   └── messageRepository.test.ts
│       └── README.md
│
├── pages/                     ← SOLO Enrutamiento
│   ├── InicioPage.tsx         (orquestación)
│   ├── ForoPage.tsx
│   ├── ChatPage.tsx
│   └── AjustesPage.tsx
│
├── layouts/
│   └── AppLayout.tsx
│
├── hooks/                     ← Hooks Globales
│   ├── useOnlineStatus.ts
│   └── useResponsive.ts
│
└── app/                       ← Root
    └── App.tsx
```

### 2.2 Estructura de cada Módulo

**Template (Ejemplo: geolocation/)**

```
geolocation/
├── README.md                  ← Documentación del módulo
├── index.ts                   ← Barril de exportación
├── types.ts                   ← Tipos locales
├── core/
│   ├── index.ts              ← Barril
│   ├── geoCore.ts
│   ├── zoneCatalog.ts
│   └── __tests__/
│       └── *.test.ts
├── services/
│   ├── index.ts              ← Barril
│   ├── accessPolicy.ts
│   ├── locationService.ts
│   └── __tests__/
│       └── *.test.ts
├── hooks/
│   ├── index.ts              ← Barril
│   ├── useGeoLocation.ts
│   ├── useZoneDetection.ts
│   └── __tests__/
│       └── *.test.ts
└── __tests__/
    └── integration.test.ts
```

**index.ts (Barril de exportación)**

```typescript
// @modules/geolocation/index.ts

// Core exports
export * from './core';

// Services exports
export { useAccessPolicy, useLocationService } from './services';

// Hooks exports
export { useGeoLocation, useZoneDetection } from './hooks';

// Types exports
export type { UserPosition, Zone, AccessCheck } from './types';
```

---

## 3. RELACIONES ENTRE MÓDULOS

```
                         PROTOCOL
                    (types compartidos)
                            ↑
┌───────────────────────────┼──────────────────────┐
│                           │                      │
↓                           ↓                      ↓

GEOLOCATION              IDENTITY              STORAGE
(GPS + Zonas)        (User + Sessions)    (IndexedDB + LS)
├── core/             ├── services/        ├── adapters/
├── services/         ├── hooks/           ├── repositories/
└── hooks/            └── hooks/           └── adapters/
     ↓                     ↓                    ↑
     └─────────────────────┼────────────────────┘
                           ↓
                         FORUMS
                    (Foros + Mensajes)
                    ├── core/
                    ├── services/
                    ├── hooks/
                    └── components/
                           ↓
     ┌─────────────────────┼─────────────────────┐
     ↓                     ↓                     ↓
   Pages              UI Components          Layouts
 (Orquestación)    (Atoms + Molecules)
```

### Reglas de Dependencias

```
✅ PERMITIDO (flujo hacia arriba):
- Pages → Modules
- UI → Theme
- Hooks → Services
- Services → Core

❌ PROHIBIDO (circular o hacia abajo):
- Modules → Pages
- Core → Services
- Storage → Modules
```

---

## 4. BENEFICIOS DE MODULARIZACIÓN

| Aspecto | Antes | Después |
|---------|-------|---------|
| **Independencia** | Acoplado | Módulos independientes |
| **Testing** | Difícil | Módulo a módulo |
| **Reutilización** | Limitada | Fácil en otros proyectos |
| **Mantenimiento** | Complejo | Localizado |
| **Escalabilidad** | Media | Alta |
| **Onboarding** | Largo | Rápido (por módulo) |

---

## 5. PLAN DE MIGRACIÓN (Paso a Paso)

### Fase 1: Crear estructura
```bash
# Crear directorios
mkdir -p apps/web/src/@modules/{geolocation,forums,identity,ui,storage}

# Crear index.ts y README en cada uno
```

### Fase 2: Migrar geolocation (Low-risk)
```
Mover:
- apps/web/src/geo/ → apps/web/src/@modules/geolocation/core/
- Crear hooks wrapper
- Crear index.ts barril
- Actualizar imports en stores
```

### Fase 3: Migrar storage
```
Mover:
- apps/web/src/db/ → apps/web/src/@modules/storage/adapters/
- Crear repositories
- Crear index.ts barril
```

### Fase 4: Crear módulo forums
```
Crear desde cero:
- services/forumService.ts
- services/messageService.ts
- hooks wrapper
- components (ForumCard, MessageList)
```

### Fase 5: Migrar identity
```
Mover lógica de identityStore a:
- @modules/identity/services/
- @modules/identity/hooks/
```

### Fase 6: Crear módulo UI
```
Mover components compartidos:
- components/StatusDot → @modules/ui/organisms/
- components/ZoneMap → @modules/ui/organisms/
- Crear design system
```

### Fase 7: Refactorizar pages
```
Simplificar:
- Eliminar lógica de negocio
- Dejar solo orquestación
- Usar hooks de módulos
```

---

## 6. EJEMPLO: Antes y Después

### ❌ ANTES (Acoplado)

```typescript
// pages/ChatPage.tsx
export function ChatPage() {
  const { userPosition, detectedZones } = useGeoStore();
  const { activeForumId, messages } = useForumStore();
  
  const handlePublish = async (content: string) => {
    // Validar acceso (duplicado aquí)
    if (!userPosition) {
      setError("No location");
      return;
    }
    
    // Calcular celdas (duplicado aquí)
    const cells = cellsTouchingCircle(...);
    
    // Validar zona (duplicado aquí)
    const zone = getZoneById(...);
    
    // Publicar (cómo?)
    await socket.emit('message', { content, ... });
  };
  
  return (
    <div>
      {messages.map(msg => (
        <div key={msg.id}>
          [{msg.authorKey}] {msg.content}
        </div>
      ))}
      <input onChange={...} />
      <button onClick={() => handlePublish(...)}>Send</button>
    </div>
  );
}
```

### ✅ DESPUÉS (Modular)

```typescript
// pages/ChatPage.tsx
import { useMessages, usePublishMessage } from '@modules/forums';
import { MessageList, MessageInput } from '@modules/forums/components';

export function ChatPage() {
  const { messages, loading } = useMessages();
  const { publish, publishing } = usePublishMessage();
  
  const handlePublish = (content: string) => {
    publish(content);  // ← Todo separado en módulo
  };
  
  return (
    <div>
      <MessageList messages={messages} loading={loading} />
      <MessageInput onPublish={handlePublish} disabled={publishing} />
    </div>
  );
}
```

**Módulo forums hace todo:**

```typescript
// @modules/forums/hooks/usePublishMessage.ts
import { useGeoLocation } from '@modules/geolocation';
import { useSession } from '@modules/identity';
import { useForumService } from '../services';

export function usePublishMessage() {
  const { checkAccess } = useGeoLocation();
  const { session } = useSession();
  const { publishMessage } = useForumService();
  
  const publish = async (content: string) => {
    // Validar acceso (centralizado)
    const check = checkAccess();
    if (!check.canPublish) {
      throw new Error(check.reason);
    }
    
    // Crear mensaje (centralizado)
    const message = createMessage(content, session);
    
    // Publicar (centralizado)
    await publishMessage(message);
  };
  
  return { publish };
}
```

---

## 7. ESTADO ACTUAL vs PROPUESTA

| Aspecto | Actual | Propuesta |
|---------|--------|----------|
| **Módulos** | 3 (geo, modules, db) | 7 (@modules/\*) |
| **Límites claros** | No | Sí |
| **Reutilización** | 30% | 90% |
| **Testing** | Por archivo | Por módulo |
| **Documentación** | Global | Cada módulo |
| **Independencia** | Baja | Alta |

---

## 8. PRÓXIMOS PASOS

### Inmediato (Esta semana)
- [ ] Crear estructura de directorios
- [ ] Mover @modules/geolocation
- [ ] Crear index.ts barril
- [ ] Actualizar imports

### Corto plazo (Próximas 2 semanas)
- [ ] Migrar storage
- [ ] Crear forums module
- [ ] Crear identity module
- [ ] Refactorizar pages

### Largo plazo (Próximas 4 semanas)
- [ ] Crear UI module (design system)
- [ ] Completar documentación por módulo
- [ ] Tests de integración entre módulos
- [ ] Considerar monorepo de librerías

---

## 9. DOCUMENTACIÓN POR MÓDULO

**Cada módulo debe tener su README:**

```markdown
# @modules/geolocation

## Descripción
Gestiona geolocalización del usuario y detección de zonas.

## Responsabilidades
- Obtener posición GPS
- Calcular celdas geohash
- Detectar zonas accesibles
- Validar acceso a zonas

## Dependencias
- @zonaviva/protocol (tipos)
- ngeohash (geohashing)

## API Pública
```typescript
export { useGeoLocation, useZoneDetection }
export { accessPolicy, locationService }
```

## Uso
```typescript
import { useGeoLocation } from '@modules/geolocation';

const { position, zones } = useGeoLocation();
```

## Testing
- geoCore.test.ts (27 tests)
- accessPolicy.test.ts
- Integración con locationService
```

---

## CONCLUSIÓN

**Estado Actual:** 
- 3 "módulos" sin límites claros
- Acoplamiento alto
- Difícil mantener y escalar

**Propuesta:**
- 7 módulos bien definidos
- Límites claros de responsabilidad
- Altamente reutilizable
- Fácil de testear y mantener

**Recomendación:** Implementar gradualmente durante próximas 2-3 semanas.
