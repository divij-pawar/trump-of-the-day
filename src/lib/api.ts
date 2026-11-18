import type { ISODate } from "./dates";

export interface NewsItem {
  id: number;
  date: ISODate;
  title: string;
  description: string | null;
  link: string;
  news_source: string | null;
  image_url: string | null;
  relevance_score: number | null;
}

/** One sentence of the brief and the ids of the stories it cites. */
export interface DigestSentence {
  text: string;
  story_ids: number[];
}

export interface Digest {
  date: ISODate;
  summary: string;
  /** The summary sentence by sentence with citations, one array per paragraph; null for briefs written without them. */
  paragraphs: DigestSentence[][] | null;
  top_story_ids: number[];
  model: string;
}

export interface NewsResponse {
  date: ISODate;
  digest: Digest | null;
  items: NewsItem[];
}

export interface SimilarItem extends NewsItem {
  distance: number;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Empty in production: CloudFront serves the SPA and routes /api and /ws to the ALB on the same origin. */
const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

async function getJson<T>(path: string, signal?: AbortSignal, cache: RequestCache = "default"): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { signal, cache, headers: { Accept: "application/json" } });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      // non-JSON error body
    }
    throw new ApiError(res.status, message);
  }
  return (await res.json()) as T;
}

export const api = {
  // `fresh` skips the browser's HTTP cache (the API sends max-age of up to
  // 5 minutes). Used when we know the day changed, e.g. after a live update.
  news: (date: ISODate, signal?: AbortSignal, fresh = false) =>
    getJson<NewsResponse>(`/api/news?date=${encodeURIComponent(date)}`, signal, fresh ? "no-cache" : "default"),
  latestDate: (signal?: AbortSignal) => getJson<{ date: ISODate | null }>("/api/dates/latest", signal),
  similar: (id: number, signal?: AbortSignal) =>
    getJson<{ id: number; items: SimilarItem[] }>(`/api/news/${id}/similar`, signal),
  search: (q: string, signal?: AbortSignal) =>
    getJson<{ q: string; items: SimilarItem[] }>(`/api/search?q=${encodeURIComponent(q)}`, signal),
};

export function websocketUrl(): string {
  if (API_BASE) return `${API_BASE.replace(/^http/, "ws")}/ws`;
  const { protocol, host } = window.location;
  return `${protocol === "https:" ? "wss" : "ws"}://${host}/ws`;
}

export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}
