import { describe, expect, it, vi } from "vitest";
import { fixture } from "@mofied/fixtures";
import type { SessionPlan } from "@mofied/contracts";
import type { SessionController } from "@mofied/session";
import { watchFreshSessions } from "./fresh-sessions";

class AppState {
  currentState: string | null = "active";
  listeners = new Set<(state: string) => void>();
  addEventListener(_event: "change", listener: (state: string) => void) {
    this.listeners.add(listener);
    return { remove: () => this.listeners.delete(listener) };
  }
  emit(state: string) {
    this.currentState = state;
    for (const listener of this.listeners) listener(state);
  }
}
function setup(initial: string | null = "active") {
  const appState = new AppState();
  appState.currentState = initial;
  const requests: {
    signal: AbortSignal;
    resolve: (plan: SessionPlan) => void;
    reject: (error: unknown) => void;
  }[] = [];
  const load = vi.fn(
    (signal: AbortSignal) =>
      new Promise<SessionPlan>((resolve, reject) => {
        requests.push({ signal, resolve, reject });
      }),
  );
  const sessions: SessionController[] = [];
  const loading = vi.fn();
  const fail = vi.fn();
  const stop = watchFreshSessions({
    appState,
    load,
    loading,
    fail,
    accept: (session) => sessions.push(session),
  });
  const resolve = async (index: number) => {
    requests[index]!.resolve({ ...fixture(), id: `opening-${index}` });
    await Promise.resolve();
    return sessions.at(-1)!;
  };
  return { appState, requests, sessions, loading, fail, stop, resolve };
}

describe("fresh native sessions", () => {
  it("fetches on cold launch and every real background return, including manual pause", async () => {
    const s = setup();
    expect(s.requests).toHaveLength(1);
    const first = await s.resolve(0);
    first.mediaProgress(first.getSnapshot().item!.id, 9000);
    first.togglePlayback();
    s.appState.emit("background");
    expect(first.getSnapshot().backgrounded).toBe(true);
    expect(s.loading).toHaveBeenCalledTimes(2);
    s.appState.emit("active");
    s.appState.emit("active");
    expect(s.requests).toHaveLength(2);
    const second = await s.resolve(1);
    expect(second.getSnapshot()).toMatchObject({
      sessionId: "opening-1",
      positionMs: 0,
      activeMs: 0,
      wantsToPlay: true,
    });
    expect(second).not.toBe(first);
    expect(first.getSnapshot().shouldPlay).toBe(false);
    s.stop();
  });
  it("keeps the session through inactive/active, About and manual pause", async () => {
    const s = setup();
    const session = await s.resolve(0);
    session.openAbout();
    s.appState.emit("inactive");
    s.appState.emit("active");
    session.closeAbout();
    session.togglePlayback();
    s.appState.emit("inactive");
    s.appState.emit("active");
    expect(s.requests).toHaveLength(1);
    expect(session.getSnapshot().wantsToPlay).toBe(false);
    s.stop();
  });
  it("waits for foreground when created in the background", async () => {
    const s = setup("background");
    expect(s.requests).toHaveLength(0);
    s.appState.emit("inactive");
    expect(s.requests).toHaveLength(0);
    s.appState.emit("active");
    expect(s.requests).toHaveLength(1);
    expect((await s.resolve(0)).getSnapshot().positionMs).toBe(0);
    s.stop();
  });
  it("does not duplicate startup when the initial AppState is unknown", async () => {
    const s = setup(null);
    s.appState.emit("active");
    expect(s.requests).toHaveLength(1);
    await s.resolve(0);
    s.stop();
  });
  it("aborts loading on background and ignores a stale response after reopening", async () => {
    const s = setup();
    s.appState.emit("background");
    expect(s.requests[0]!.signal.aborted).toBe(true);
    s.appState.emit("active");
    await s.resolve(1);
    await s.resolve(0);
    expect(s.sessions.map((s) => s.plan.id)).toEqual(["opening-1"]);
    s.stop();
  });
  it("ignores stale errors during rapid reopenings and surfaces only the current failure", async () => {
    const s = setup();
    s.appState.emit("background");
    s.appState.emit("active");
    s.appState.emit("background");
    s.appState.emit("active");
    s.requests[0]!.reject(new Error("old failure"));
    await s.resolve(1);
    const error = new Error("offline");
    s.requests[2]!.reject(error);
    await Promise.resolve();
    expect(s.sessions).toEqual([]);
    expect(s.fail).toHaveBeenCalledExactlyOnceWith(error);
    s.stop();
  });
  it("never falls back to the old session after a reopen request fails", async () => {
    const s = setup();
    const old = await s.resolve(0);
    s.appState.emit("background");
    s.appState.emit("active");
    s.requests[1]!.reject(new Error("503"));
    await Promise.resolve();
    expect(old.getSnapshot().shouldPlay).toBe(false);
    expect(s.fail).toHaveBeenCalledTimes(1);
    s.appState.emit("background");
    s.appState.emit("active");
    await s.resolve(2);
    expect(s.sessions.map((s) => s.plan.id)).toEqual([
      "opening-0",
      "opening-2",
    ]);
    s.stop();
  });
  it("starts fresh when returning from a reminder", async () => {
    const s = setup();
    const first = await s.resolve(0);
    first.next();
    expect(first.getSnapshot().item?.kind).toBe("reminder");
    s.appState.emit("background");
    s.appState.emit("active");
    const second = await s.resolve(1);
    expect(second.getSnapshot().item?.kind).toBe("media");
    s.stop();
  });
  it("disposal aborts pending work, stops the old session and detaches AppState", async () => {
    const s = setup();
    const session = await s.resolve(0);
    s.stop();
    expect(session.getSnapshot().shouldPlay).toBe(false);
    expect(s.requests[0]!.signal.aborted).toBe(true);
    expect(s.appState.listeners.size).toBe(0);
    const pending = setup();
    pending.stop();
    await pending.resolve(0);
    expect(pending.sessions).toEqual([]);
    expect(pending.fail).not.toHaveBeenCalled();
  });
});
