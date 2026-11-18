import { useCallback, useEffect, useRef, useState } from "react";
import { api, isAbortError, type Digest, type NewsItem } from "../lib/api";
import type { ISODate } from "../lib/dates";

export type NewsState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "empty" }
  | { status: "ready"; items: NewsItem[]; digest: Digest | null };

/**
 * Loads one day's stories. Each date change aborts the previous request, so
 * clicking quickly through the calendar can't leave an older response on screen.
 */
export function useNews(date: ISODate | null): { state: NewsState; reload: () => void } {
  const [state, setState] = useState<NewsState>({ status: "loading" });
  const [nonce, setNonce] = useState(0);
  // Set by reload(), consumed by the next fetch: a reload means the data is known
  // (live update) or suspected (retry) to be stale, so the browser cache is skipped.
  const bypassCache = useRef(false);

  useEffect(() => {
    if (!date) return;
    const controller = new AbortController();
    const fresh = bypassCache.current;
    bypassCache.current = false;
    setState({ status: "loading" });

    api
      .news(date, controller.signal, fresh)
      .then(({ items, digest }) => {
        setState(items.length > 0 ? { status: "ready", items, digest } : { status: "empty" });
      })
      .catch((err: unknown) => {
        if (isAbortError(err)) return;
        setState({
          status: "error",
          message: err instanceof Error ? err.message : "Something went wrong",
        });
      });

    return () => controller.abort();
  }, [date, nonce]);

  const reload = useCallback(() => {
    bypassCache.current = true;
    setNonce((n) => n + 1);
  }, []);
  return { state, reload };
}
