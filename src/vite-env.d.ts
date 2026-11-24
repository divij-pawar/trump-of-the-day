/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the news API. Leave unset when the API is served from the same origin (production, and dev via the Vite proxy). */
  readonly VITE_API_URL?: string;
  /** "false" disables the /ws live-updates connection. */
  readonly VITE_LIVE_UPDATES?: string;
  /** Full WebSocket URL for live updates (e.g. wss://api-xyz.run.app/ws) when the site's host can't proxy WebSockets (Netlify). */
  readonly VITE_WS_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
