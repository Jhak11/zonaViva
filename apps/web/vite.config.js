/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";
// https://vitejs.dev/config/
// NOTA: basicSsl() fue removido — el relay corre en HTTP puro (sin TLS).
// Usar HTTPS en Vite con un relay HTTP causa Mixed Content y ECONNREFUSED en el proxy WS.
// Para acceder desde móvil en LAN, usa la IP local directamente por HTTP.
export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            registerType: "autoUpdate",
            includeAssets: ["favicon.svg", "apple-touch-icon.png", "icons/*.png"],
            manifest: {
                name: "ZonaViva",
                short_name: "ZonaViva",
                description: "Red social geográfica basada en foros. Habla con quienes están cerca.",
                theme_color: "#0ea5e9",
                background_color: "#0f172a",
                display: "standalone",
                orientation: "portrait",
                start_url: "/",
                icons: [
                    {
                        src: "/icons/icon-192.png",
                        sizes: "192x192",
                        type: "image/png",
                    },
                    {
                        src: "/icons/icon-512.png",
                        sizes: "512x512",
                        type: "image/png",
                    },
                    {
                        src: "/icons/icon-512.png",
                        sizes: "512x512",
                        type: "image/png",
                        purpose: "any maskable",
                    },
                ],
            },
            workbox: {
                globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
                runtimeCaching: [
                    {
                        // Tiles de OpenStreetMap
                        urlPattern: /^https:\/\/[abc]\.tile\.openstreetmap\.org\/.*/,
                        handler: "CacheFirst",
                        options: {
                            cacheName: "osm-tiles",
                            expiration: {
                                maxEntries: 500,
                                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 días
                            },
                        },
                    },
                ],
            },
        }),
    ],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    server: {
        host: true,
        port: 5173,
        allowedHosts: true,
        proxy: {
            "/socket.io": {
                target: "http://127.0.0.1:3001",
                ws: true,
                changeOrigin: true,
            },
            "/key": {
                target: "http://127.0.0.1:3001",
                changeOrigin: true,
            },
        },
    },
    preview: {
        allowedHosts: true,
    },
    test: {
        testTimeout: 15000,
    },
});
