/// <reference types="vitest/config" />
import { defineConfig, type ProxyOptions } from 'vite';
import react from '@vitejs/plugin-react';

const apiTarget = process.env.API_PROXY_TARGET ?? 'http://localhost:8080';

// When the API isn't running, Vite's proxy answers a bare 500. Answer 502 with a
// message instead; the app shows `message` in its error state.
const explainUnreachableApi: ProxyOptions['configure'] = (proxy) => {
  proxy.on('error', (err, _req, res) => {
    if (!('writeHead' in res) || res.headersSent) return; // WebSocket upgrade, or already answered
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        error: 'api_unreachable',
        message: `Can't reach the API at ${apiTarget} (${(err as NodeJS.ErrnoException).code ?? err.message}). Is it running? Try: docker compose up -d`,
      }),
    );
  });
};

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Mirrors the production CloudFront routing, so the app always talks to its own origin.
    proxy: {
      '/api': { target: apiTarget, configure: explainUnreachableApi },
      '/ws': { target: apiTarget.replace(/^http/, 'ws'), ws: true },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/test/setup.ts'],
  },
});
