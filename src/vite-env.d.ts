/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the news API. Leave unset when the API is served from the same origin (production, and dev via the Vite proxy). */
  readonly VITE_API_URL?: string;
  /** "false" disables the /ws live-updates connection (GCP build). */
  readonly VITE_LIVE_UPDATES?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
