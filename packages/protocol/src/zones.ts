// ──────────────────────────────────────────────────────────────────────
//  Catálogo de zonas – Definido estáticamente desde zones.json
//  Identificadores (id) son ESTABLES: no cambiarán entre versiones.
//
//  NOTA: Este archivo se regenera automáticamente con el script syncZones.ts
//        No editar manualmente - los cambios se perderán.
// ──────────────────────────────────────────────────────────────────────
import type { Zone } from "./types.js";

export const ZONES: Zone[] = [
  {
    "id": "mercado-central",
    "name": "Mercado Central",
    "description": "Mercado Central de Puno y comercios tradicionales de abastos",
    "type": "permanent",
    "color": "#f97316",
    "cells": [
      "6mnjys8",
      "6mnjysb",
      "6mnjyt0",
      "6mnjymp"
    ]
  },
  {
    "id": "mercado-union",
    "name": "Mercado Unión y Dignidad",
    "description": "Principal centro comercial y mercado mayorista de la zona sur",
    "type": "permanent",
    "color": "#ec4899",
    "cells": [
      "6mnjysj",
      "6mnjysm",
      "6mnjysq",
      "6mnjysk",
      "6mnjyst",
      "6mnjyss"
    ]
  },
  {
    "id": "mercado-bellavista",
    "name": "Mercado Bellavista",
    "description": "Mercado tradicional del barrio Bellavista en la zona norte",
    "type": "permanent",
    "color": "#eab308",
    "cells": [
      "6mnjyt6",
      "6mnjyt7",
      "6mnjytd",
      "6mnjyte",
      "6mnjyt9",
      "6mnjytf"
    ]
  },
  {
    "id": "plaza-mayor",
    "name": "Plaza Mayor de Puno",
    "description": "Plaza de Armas, Catedral y centro histórico de Puno",
    "type": "permanent",
    "color": "#8b5cf6",
    "cells": [
      "6mnjykn",
      "6mnjykp",
      "6mnjykq",
      "6mnjykr"
    ]
  },
  {
    "id": "parque-pino",
    "name": "Parque Pino",
    "description": "Parque Manuel Pino, Iglesia San Juan y peatonal Jirón Lima",
    "type": "permanent",
    "color": "#10b981",
    "cells": [
      "6mnjykx",
      "6mnjykw",
      "6mnjykz",
      "6mnjyky"
    ]
  },
  {
    "id": "unap-campus",
    "name": "Universidad Nacional del Altiplano",
    "description": "Ciudad Universitaria de la UNA Puno, facultades y áreas académicas",
    "type": "permanent",
    "color": "#0284c7",
    "cells": [
      "6mnjywx",
      "6mnjyy8",
      "6mnjywz",
      "6mnjyyb",
      "6mnjywy",
      "6mnjyyc",
      "6mnjyxp",
      "6mnjyz0",
      "6mnjyxn",
      "6mnjyz1",
      "6mnjyxj",
      "6mnjyyf",
      "6mnjyz4",
      "6mnjyxr",
      "6mnjyz2",
      "6mnjyxq",
      "6mnjyz3",
      "6mnjyxm",
      "6mnjyz6",
      "6mnjyxx",
      "6mnjyz8",
      "6mnjyxw",
      "6mnjyxt",
      "6mnjyxz",
      "6mnjyxy",
      "6mnjyxv"
    ]
  }
];

/** Mapa rápido por ID para búsquedas O(1) */
export const ZONES_BY_ID: Record<string, Zone> = Object.fromEntries(
  ZONES.map((z) => [z.id, z])
);
