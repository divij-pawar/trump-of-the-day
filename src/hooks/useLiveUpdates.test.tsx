import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { HIDDEN_GRACE_MS, useLiveUpdates } from "./useLiveUpdates";

class FakeSocket {
  static instances: FakeSocket[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: ((e: { code: number }) => void) | null = null;
  closed = false;
  constructor(public url: string) {
    FakeSocket.instances.push(this);
  }
  close() {
    this.closed = true;
  }
  /** Simulate the server closing the connection. */
  serverClose(code: number) {
    this.closed = true;
    this.onclose?.({ code });
  }
}

let visibility: DocumentVisibilityState = "visible";
const setVisibility = (state: DocumentVisibilityState) => {
  visibility = state;
  document.dispatchEvent(new Event("visibilitychange"));
};

beforeEach(() => {
  FakeSocket.instances = [];
  visibility = "visible";
  vi.useFakeTimers();
  vi.stubGlobal("WebSocket", FakeSocket);
  vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useLiveUpdates", () => {
  it("delivers news_updated messages", () => {
    const onUpdate = vi.fn();
    renderHook(() => useLiveUpdates(onUpdate));
    FakeSocket.instances[0]!.onmessage?.({ data: JSON.stringify({ type: "news_updated", date: "2026-11-18" }) });
    expect(onUpdate).toHaveBeenCalledWith("2026-11-18");
  });

  it("closes a hidden tab's socket after the grace period and reconnects when shown", () => {
    renderHook(() => useLiveUpdates(vi.fn()));
    const first = FakeSocket.instances[0]!;

    setVisibility("hidden");
    vi.advanceTimersByTime(HIDDEN_GRACE_MS - 1);
    expect(first.closed).toBe(false);
    vi.advanceTimersByTime(1);
    expect(first.closed).toBe(true);
    first.onclose?.({ code: 1000 });
    vi.advanceTimersByTime(120_000);
    expect(FakeSocket.instances).toHaveLength(1); // no reconnects while hidden

    setVisibility("visible");
    expect(FakeSocket.instances).toHaveLength(2);
  });

  it("reconnects immediately when the server ends a connection at its maximum lifetime", () => {
    renderHook(() => useLiveUpdates(vi.fn()));
    FakeSocket.instances[0]!.serverClose(4000);
    expect(FakeSocket.instances).toHaveLength(2);
  });

  it("backs off after other drops", () => {
    renderHook(() => useLiveUpdates(vi.fn()));
    FakeSocket.instances[0]!.serverClose(1006);
    expect(FakeSocket.instances).toHaveLength(1);
    vi.advanceTimersByTime(1_000);
    expect(FakeSocket.instances).toHaveLength(2);
  });
});
