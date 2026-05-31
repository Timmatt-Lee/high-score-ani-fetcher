import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.json";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Only apply the crx plugin when we are not running Storybook.
    // Storybook sets process.env.SB_PATH or similar, or we can check a custom flag,
    // but checking for the absence of storybook-related command/env is safest.
    ...(process.env.npm_lifecycle_event?.includes("storybook")
      ? []
      : [crx({ manifest })]),
  ],
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      port: 5173,
    },
    cors: {
      origin: [
        /chrome-extension:\/\//,
        /^https?:\/\/(?:(?:[^:]+\.)?localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/,
      ],
    },
  },
});
