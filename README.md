# ZonaViva

> Red social geográfica descentralizada basada en foros — MVP

## Descripción

ZonaViva es una red social web centrada en la **ubicación geográfica**. Las personas conversan con otros usuarios cercanos y participan en foros asociados a lugares físicos sin necesidad de registrarse con nombre real.

**Zona piloto:** Puno, Perú (3 zonas: Centro, Puerto/Lago Titicaca, Mercado Central)

## Estructura del repositorio

```
/
├─ apps/
│  ├─ web/         # PWA React + Vite + TypeScript + Tailwind
│  ├─ relay/       # Servidor Node.js + Socket.IO (solo memoria)
│  └─ archivist/   # (Iteración 3) cliente Node que conserva copias
├─ packages/
│  └─ protocol/    # Tipos, esquemas Zod, zones.json, constantes
└─ docs/           # Plan de desarrollo y ADRs
```

## Requisitos

- Node.js ≥ 20
- pnpm ≥ 9

## Instalación

```bash
pnpm install
```

## Desarrollo

```bash
# Web (PWA)
pnpm dev:web

# Relay
pnpm dev:relay
```

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18 + Vite + TypeScript |
| Estilos | Tailwind CSS |
| Estado | Zustand |
| Rutas | React Router v6 |
| PWA | vite-plugin-pwa |
| Mapa | Leaflet + OpenStreetMap |
| Cripto | WebCrypto nativo |
| Tiempo real | Socket.IO |
| Validación | Zod |
| Monorepo | pnpm workspaces |

## Iteraciones

| # | Funcionalidad | Estado |
|---|--------------|--------|
| 0 | Cimientos y prueba técnica | ⏳ Pendiente |
| **1** | **Zonas, geolocalización y esqueleto** | **🔨 En desarrollo** |
| 2 | Foros permanentes en vivo | ⏳ Pendiente |
| 3 | Persistencia y sincronización | ⏳ Pendiente |
| 4 | Chat aleatorio cifrado | ⏳ Pendiente |
| 5 | Foros creados por usuarios | ⏳ Pendiente |
| 6 | Endurecimiento y piloto | ⏳ Pendiente |

## Privacidad por diseño

- Las coordenadas exactas **nunca** salen del dispositivo.
- El relay **no almacena** mensajes ni IPs en logs.
- Sin registro con nombre real, correo ni teléfono.
- Alias temporal renovable desde Ajustes.
