import { useEffect, useRef } from "react";
import { websocketUrl } from "../lib/api";
import type { ISODate } from "../lib/dates";

export const LIVE_UPDATES_ENABLED = import.meta.env.VITE_LIVE_UPDATES !== "false";

/**
 * Subscribes to the API's WebSocket and calls `onNewsUpdated` whenever the
 * pipeline publishes stories for a date. Reconnects with capped exponential
 * backoff; live updates are a nicety, so failures are silent.
 */
export function useLiveUpdates(onNewsUpdated: (date: ISODate) => void): void {
  const handler = useRef(onNewsUpdated);
  handler.current = onNewsUpdated;

  useEffect(() => {
    // Off for the GCP deployment: Firebase Hosting doesn't proxy WebSockets, and an
    // open socket per tab would keep a Cloud Run instance (and its bill) running.
    if (!LIVE_UPDATES_ENABLED) return;

    let socket: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let delay = 1_000;
    let closed = false;

    const connect = () => {
      if (closed) return;
      socket = new WebSocket(websocketUrl());
      socket.onopen = () => {
        delay = 1_000;
      };
      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(String(event.data)) as { type?: string; date?: string };
          if (msg.type === "news_updated" && msg.date) handler.current(msg.date);
        } catch {
          // ignore malformed frames
        }
      };
      socket.onclose = () => {
        if (closed) return;
        retryTimer = setTimeout(connect, delay);
        delay = Math.min(delay * 2, 60_000);
      };
    };

    connect();
    return () => {
      closed = true;
      clearTimeout(retryTimer);
      socket?.close();
    };
  }, []);
}
