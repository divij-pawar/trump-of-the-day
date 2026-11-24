import { useEffect, useRef } from "react";
import { websocketUrl } from "../lib/api";
import type { ISODate } from "../lib/dates";

export const LIVE_UPDATES_ENABLED = import.meta.env.VITE_LIVE_UPDATES !== "false";

/** How long a hidden tab keeps its socket before closing it. */
export const HIDDEN_GRACE_MS = 60_000;
/** Close code the API uses when a connection reaches its maximum lifetime (api/src/hub.ts). */
const MAX_LIFETIME_CLOSE_CODE = 4000;

/**
 * Subscribes to the API's WebSocket and calls `onNewsUpdated` whenever the
 * pipeline publishes stories for a date.
 *
 * Connected only while the tab is visible: an open socket is a billed request on
 * Cloud Run, and a background tab doesn't need updates. A hidden tab closes its
 * socket after HIDDEN_GRACE_MS and reconnects when shown again. The server also
 * closes each connection after a maximum lifetime; a visible tab reconnects right
 * away. Other drops reconnect with capped exponential backoff. Live updates are a
 * nicety, so failures are silent.
 */
export function useLiveUpdates(onNewsUpdated: (date: ISODate) => void): void {
  const handler = useRef(onNewsUpdated);
  handler.current = onNewsUpdated;

  useEffect(() => {
    if (!LIVE_UPDATES_ENABLED) return;

    let socket: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let hiddenTimer: ReturnType<typeof setTimeout> | undefined;
    let delay = 1_000;
    let disposed = false;

    const visible = () => document.visibilityState !== "hidden";

    const connect = () => {
      clearTimeout(retryTimer);
      if (disposed || socket || !visible()) return;
      const ws = new WebSocket(websocketUrl());
      socket = ws;
      ws.onopen = () => {
        delay = 1_000;
      };
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(String(event.data)) as { type?: string; date?: string };
          if (msg.type === "news_updated" && msg.date) handler.current(msg.date);
        } catch {
          // ignore malformed frames
        }
      };
      ws.onclose = (event) => {
        if (socket === ws) socket = null;
        if (disposed || !visible()) return;
        if (event.code === MAX_LIFETIME_CLOSE_CODE) {
          connect();
          return;
        }
        retryTimer = setTimeout(connect, delay);
        delay = Math.min(delay * 2, 60_000);
      };
    };

    const disconnect = () => {
      clearTimeout(retryTimer);
      const ws = socket;
      socket = null;
      ws?.close(1000, "tab hidden");
    };

    const onVisibilityChange = () => {
      clearTimeout(hiddenTimer);
      if (visible()) connect();
      else hiddenTimer = setTimeout(disconnect, HIDDEN_GRACE_MS);
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    connect();
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      clearTimeout(hiddenTimer);
      disconnect();
    };
  }, []);
}
