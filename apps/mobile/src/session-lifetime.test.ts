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
class Links {
  initial: Promise<string | null>;
  resolveInitial!: (url: string | null) => void;
  listeners = new Set<(event: { url: string }) => void>();
  constructor() {
    this.initial = new Promise((resolve) => (this.resolveInitial = resolve));
  }
  getInitialURL = () => this.initial;
  addEventListener(_event: "url", listener: (event: { url: string }) => void) {
    this.listeners.add(listener);
    return { remove: () => this.listeners.delete(listener) };
  }
  emit(url: string) {
    for (const listener of this.listeners) listener({ url });
  }
}
function setup(
  initial: string | null = "active",
  { links, now = () => 0 }: { links?: Links; now?: () => number } = {},
) {
  const appState = new AppState();
  appState.currentState = initial;
  const requests: {
    signal: AbortSignal;
    start?: string;
    resolve: (plan: SessionPlan) => void;
    reject: (error: unknown) => void;
  }[] = [];
  const load = vi.fn(
    (signal: AbortSignal, start?: string) =>
      new Promise<SessionPlan>((resolve, reject) => {
        requests.push({ signal, start, resolve, reject });
      }),
  );
  const sessions: SessionController[] = [];
  const loading = vi.fn();
  const fail = vi.fn();
  const stop = watchSessions({
    appState,
    links,
    now,
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
  it("a launch from a share link opens the session from that media", async () => {
    const links = new Links();
    const s = setup("active", { links });
    expect(s.requests).toHaveLength(0);
    links.resolveInitial("https://mofied.com/?start=4321&utm_source=x");
    await Promise.resolve();
    expect(s.requests.map((request) => request.start)).toEqual(["4321"]);
    // iOS may report the same launching link again as an event.
    links.emit("https://mofied.com/?start=4321&utm_source=x");
    expect(s.requests).toHaveLength(1);
    await s.resolve();
    s.stop();
    expect(links.listeners.size).toBe(0);
  });
  it("plain, foreign and malformed links at launch open an ordinary session", async () => {
    for (const url of [
      null,
      "https://mofied.com",
      "https://mofied.com/privacy/?start=12",
      "https://evil.test/?start=12",
      "https://mofied.com/?start=12abc",
    ]) {
      const links = new Links();
      const s = setup("active", { links });
      links.resolveInitial(url);
      await Promise.resolve();
      expect(s.requests.map((request) => request.start)).toEqual([undefined]);
      s.stop();
    }
  });
  it("a share link while running replaces the session; a plain link keeps it", async () => {
    let clock = 0;
    const links = new Links();
    const s = setup("active", { links, now: () => clock });
    links.resolveInitial(null);
    await Promise.resolve();
    const first = await s.resolve(0);
    s.appState.emit("background");
    links.emit("https://mofied.com/");
    links.emit("https://www.mofied.com/privacy/");
    expect(s.requests).toHaveLength(1);
    clock = 10_000;
    links.emit("https://www.mofied.com/?start=77");
    expect(first.getSnapshot().shouldPlay).toBe(false);
    expect(s.requests.map((request) => request.start)).toEqual([
      undefined,
      "77",
    ]);
    expect(s.loading).toHaveBeenCalledTimes(2);
    s.appState.emit("active");
    const second = await s.resolve(1);
    expect(second.getSnapshot()).toMatchObject({
      backgrounded: false,
      shouldPlay: true,
    });
    expect(first.getSnapshot().shouldPlay).toBe(false);
    // The same link tapped again later starts from that media again.
    clock = 20_000;
    links.emit("https://www.mofied.com/?start=77");
    expect(s.requests).toHaveLength(3);
    s.stop();
  });
  it("a share link that arrives before the launch link resolves wins", async () => {
    const links = new Links();
    const s = setup("active", { links });
    links.emit("mofied://?start=55");
    links.resolveInitial(null);
    await Promise.resolve();
    expect(s.requests.map((request) => request.start)).toEqual(["55"]);
    s.stop();
  });
  it("a share link supersedes a pending load and its late response", async () => {
    const links = new Links();
    const s = setup("active", { links });
    links.resolveInitial(null);
    await Promise.resolve();
    links.emit("https://mofied.com/?start=9");
    expect(s.requests[0]!.signal.aborted).toBe(true);
    await s.resolve(0);
    expect(s.sessions).toEqual([]);
    const shared = await s.resolve(1);
    expect(s.sessions).toEqual([shared]);
    s.stop();
  });
});
