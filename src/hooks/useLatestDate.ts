import { useEffect, useState } from "react";
import { api, isAbortError } from "../lib/api";
import { todayUTC, type ISODate } from "../lib/dates";

/**
 * The most recent day that has stories, used as the initial selection so the
 * page doesn't open on an empty "today" before the daily scrape has run. Falls
 * back to today (UTC) if the API can't be reached.
 */
export function useLatestDate(): [ISODate | null, (date: ISODate) => void] {
  const [latest, setLatest] = useState<ISODate | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    api
      .latestDate(controller.signal)
      .then(({ date }) => setLatest(date ?? todayUTC()))
      .catch((err: unknown) => {
        if (!isAbortError(err)) setLatest(todayUTC());
      });
    return () => controller.abort();
  }, []);

  return [latest, setLatest];
}
