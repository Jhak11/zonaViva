/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

// Declaraciones de módulos
declare module "ngeohash" {
  export function encode(lat: number, lon: number, precision?: number): string;
  export function decode(hash: string): { latitude: number; longitude: number };
  export function neighbors(hash: string): string[];
}
