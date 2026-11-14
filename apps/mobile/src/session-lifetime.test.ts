import { describe, expect, it, vi } from "vitest";
import { fixture } from "@mofied/fixtures";
import type { SessionPlan } from "@mofied/contracts";
import type { SessionController } from "@mofied/session";
import { watchSessions } from "./session-lifetime";

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
  const stop = watchSessions({
    appState,
    load,
    loading,
    fail,
    accept: (session) => sessions.push(session),
  });
  const resolve = async (index = 0) => {
    requests[index]!.resolve({ ...fixture(), id: `opening-${index}` });
    await Promise.resolve();
    return sessions.at(-1)!;
  };
  return { appState, requests, sessions, loading, fail, stop, resolve };
}

describe("native session lifetime", () => {
  it("keeps one session across background returns and resumes where it was", async () => {
    const s = setup();
    const session = await s.resolve();
    const id = session.getSnapshot().item!.id;
    session.mediaPlaying(id, 0);
    session.mediaProgress(id, 9000);
    for (let cycle = 0; cycle < 3; cycle++) {
      s.appState.emit("background");
      expect(session.getSnapshot()).toMatchObject({
        backgrounded: true,
        shouldPlay: false,
        wantsToPlay: true,
      });
      s.appState.emit("active");
      expect(session.getSnapshot()).toMatchObject({
        backgrounded: false,
        shouldPlay: true,
        positionMs: 9000,
      });
    }
    expect(s.requests).toHaveLength(1);
    expect(s.loading).toHaveBeenCalledTimes(1);
    expect(s.sessions).toEqual([session]);
    s.stop();
  });
  it("a manual pause, About and a reminder all survive leaving the app", async () => {
    const s = setup();
    const session = await s.resolve();
    session.togglePlayback();
    s.appState.emit("background");
    s.appState.emit("active");
    expect(session.getSnapshot()).toMatchObject({
      wantsToPlay: false,
      shouldPlay: false,
    });
    session.togglePlayback();
    session.next();
    expect(session.getSnapshot().item?.kind).toBe("reminder");
    session.openAbout();
    s.appState.emit("background");
    s.appState.emit("active");
    expect(session.getSnapshot()).toMatchObject({
      item: { kind: "reminder" },
      aboutOpen: true,
      shouldPlay: false,
    });
    session.closeAbout();
    expect(session.getSnapshot().shouldPlay).toBe(true);
    expect(s.requests).toHaveLength(1);
    s.stop();
  });
  it("inactive alone, as with Control Center, changes nothing", async () => {
    const s = setup();
    const session = await s.resolve();
    s.appState.emit("inactive");
    expect(session.getSnapshot()).toMatchObject({
      backgrounded: false,
      shouldPlay: true,
    });
    s.appState.emit("active");
    expect(s.requests).toHaveLength(1);
    s.stop();
  });
  it("a plan that arrives while the app is away waits, paused, for its return", async () => {
    const s = setup();
    s.appState.emit("background");
    expect(s.requests[0]!.signal.aborted).toBe(false);
    const session = await s.resolve();
    expect(session.getSnapshot()).toMatchObject({
      backgrounded: true,
      shouldPlay: false,
    });
    s.appState.emit("active");
    expect(session.getSnapshot().shouldPlay).toBe(true);
    s.stop();
  });
  it("a launch in the background loads once and starts paused", async () => {
    const s = setup("background");
    expect(s.requests).toHaveLength(1);
    const session = await s.resolve();
    expect(session.getSnapshot().backgrounded).toBe(true);
    s.appState.emit("inactive");
    expect(session.getSnapshot().backgrounded).toBe(true);
    s.appState.emit("active");
    expect(session.getSnapshot().backgrounded).toBe(false);
    s.stop();
  });
  it("an unknown initial AppState loads exactly once", async () => {
    const s = setup(null);
    s.appState.emit("active");
    expect(s.requests).toHaveLength(1);
    await s.resolve();
    s.stop();
  });
  it("a failed load is reported, never replaced by a fixture", async () => {
    const s = setup();
    const error = new Error("offline");
    s.requests[0]!.reject(error);
    await Promise.resolve();
    expect(s.sessions).toEqual([]);
    expect(s.fail).toHaveBeenCalledExactlyOnceWith(error);
    s.appState.emit("background");
    s.appState.emit("active");
    expect(s.requests).toHaveLength(1);
    s.stop();
  });
  it("disposal aborts pending work, stops the session and detaches AppState", async () => {
    const s = setup();
    const session = await s.resolve();
    s.stop();
    expect(session.getSnapshot().shouldPlay).toBe(false);
    expect(s.requests[0]!.signal.aborted).toBe(true);
    expect(s.appState.listeners.size).toBe(0);
    const pending = setup();
    pending.stop();
    await pending.resolve();
    expect(pending.sessions).toEqual([]);
    pending.requests[0]!.reject(new Error("late"));
    await Promise.resolve();
    expect(pending.fail).not.toHaveBeenCalled();
  });
});
