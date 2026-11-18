import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useNews } from "./useNews";

const response = (date: string, n: number) =>
  new Response(
    JSON.stringify({
      date,
      digest: null,
      items: Array.from({ length: n }, (_, i) => ({ id: i + 1, date, title: `t${i}`, link: "https://x" })),
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );

afterEach(() => vi.unstubAllGlobals());

describe("useNews", () => {
  it("reports ready, empty and error states distinctly", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response("2025-03-01", 2))
      .mockResolvedValueOnce(response("2025-03-02", 0))
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: "db down" }), { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);

    const { result, rerender } = renderHook(({ date }: { date: string }) => useNews(date), {
      initialProps: { date: "2025-03-01" },
    });
    await waitFor(() => expect(result.current.state.status).toBe("ready"));

    rerender({ date: "2025-03-02" });
    await waitFor(() => expect(result.current.state.status).toBe("empty"));

    rerender({ date: "2025-03-03" });
    await waitFor(() => expect(result.current.state).toEqual({ status: "error", message: "db down" }));
  });

  it("aborts the previous request when the date changes, so stale data never wins", async () => {
    const signals: AbortSignal[] = [];
    let resolveFirst: (r: Response) => void = () => {};
    const fetchMock = vi.fn((url: string, init: RequestInit) => {
      signals.push(init.signal!);
      if (url.includes("2025-03-01")) {
        return new Promise<Response>((resolve, reject) => {
          resolveFirst = resolve;
          init.signal!.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        });
      }
      return Promise.resolve(response("2025-03-02", 3));
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result, rerender } = renderHook(({ date }: { date: string }) => useNews(date), {
      initialProps: { date: "2025-03-01" },
    });
    rerender({ date: "2025-03-02" });
    await waitFor(() => expect(result.current.state.status).toBe("ready"));

    expect(signals[0]!.aborted).toBe(true);
    act(() => resolveFirst(response("2025-03-01", 1)));
    expect(result.current.state).toMatchObject({ status: "ready", items: { length: 3 } });
  });

  it("refetches on reload, skipping the browser cache only for that request", async () => {
    const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async (url) =>
      response(url.slice(-10), 1),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { result, rerender } = renderHook(({ date }: { date: string }) => useNews(date), {
      initialProps: { date: "2025-03-01" },
    });
    await waitFor(() => expect(result.current.state.status).toBe("ready"));
    act(() => result.current.reload());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    rerender({ date: "2025-03-02" });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));

    expect(fetchMock.mock.calls.map(([, init]) => init.cache)).toEqual(["default", "no-cache", "default"]);
  });
});
