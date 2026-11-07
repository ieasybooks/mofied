import { afterEach, describe, expect, it, vi } from "vitest";
import { SessionController } from "@mofied/session";
import { fixture } from "@mofied/fixtures";
import { watchPlaybackHealth } from "./playback-health";

class Media extends EventTarget {
  currentTime = 0;
  paused = false;
  ended = false;
  seeking = false;
  readyState = 4;
  emit(event: string) {
    this.dispatchEvent(new Event(event));
  }
}

function setup() {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  let now = 0;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  const plan = fixture();
  const session = new SessionController(plan, () => now);
  const video = new Media();
  const stop = watchPlaybackHealth(video, session, plan.items[0]!.id);
  video.emit("playing");
  return {
    video,
    session,
    plan,
    stop,
    step(ms: number, seconds = video.currentTime, callbacks = ms) {
      now += ms;
      video.currentTime = seconds;
      vi.advanceTimersByTime(callbacks);
    },
    play(ms: number) {
      for (let elapsed = 0; elapsed < ms; elapsed += 250) {
        now += 250;
        video.currentTime += 0.25;
        vi.advanceTimersByTime(250);
        video.emit("timeupdate");
      }
    },
  };
}

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("HTML media playback health", () => {
  it("preserves a saved playhead while the persistent element resets and loads metadata", () => {
    const original = new SessionController(fixture());
    original.mediaProgress(original.getSnapshot().item!.id, 9000);
    const session = SessionController.restore(original.serialize()!)!;
    const video = new Media();
    let ready = false;
    const stop = watchPlaybackHealth(
      video,
      session,
      session.getSnapshot().item!.id,
      () => ready,
    );
    video.emit("timeupdate");
    video.emit("playing");
    expect(session.getSnapshot()).toMatchObject({
      positionMs: 9000,
      activeMs: 0,
      status: "paused",
    });
    video.currentTime = 9;
    ready = true;
    video.emit("timeupdate");
    expect(session.getSnapshot().positionMs).toBe(9000);
    stop();
  });
  it("ignores buffered network stalls and counts uninterrupted playback past 20s", () => {
    const { video, session, plan, play } = setup();
    play(3500);
    video.emit("stalled");
    expect(session.getSnapshot().status).toBe("playing");
    play(25_000);
    expect(session.getSnapshot()).toMatchObject({
      status: "playing",
      item: { id: plan.items[0]!.id },
      activeMs: 28_500,
    });
  });

  it("recovers from real buffering on advancing timeupdates without another playing event", () => {
    const { video, session, play, step } = setup();
    play(1000);
    video.readyState = 2;
    video.emit("waiting");
    expect(session.getSnapshot().status).toBe("buffering");
    step(5000);
    expect(session.getSnapshot().activeMs).toBe(1000);
    video.readyState = 4;
    play(25_000);
    expect(session.getSnapshot().status).toBe("playing");
    expect(session.getSnapshot().activeMs).toBe(25_750);
  });

  it("samples actual progress before a watchdog callback delayed by a hidden tab", () => {
    const { session, plan, step } = setup();
    // 30s of real playback, but only the first delayed JS interval is delivered.
    step(30_000, 30, 1000);
    expect(session.getSnapshot()).toMatchObject({
      status: "playing",
      item: { id: plan.items[0]!.id },
      activeMs: 30_000,
    });
  });

  it("still replaces media after 20s without progress even when readyState stays high", () => {
    const { session, plan, step } = setup();
    step(2000);
    expect(session.getSnapshot().status).toBe("buffering");
    step(17_000);
    expect(session.getSnapshot().item?.id).toBe(plan.items[0]!.id);
    step(1000);
    expect(session.getSnapshot().item?.id).toBe(plan.replacements[0]!.id);
    expect(session.getSnapshot().activeMs).toBe(0);
  });

  it("times out media that never starts, including while the element is paused", () => {
    const { video, session, plan, step } = setup();
    session.retry();
    video.paused = true;
    video.readyState = 0;
    step(20_000);
    expect(session.getSnapshot().item?.id).toBe(plan.replacements[0]!.id);
  });

  it("excludes About and manual pauses from timeout and session accounting", () => {
    const { video, session, plan, play, step } = setup();
    play(1000);
    session.openAbout();
    video.paused = true;
    step(60_000);
    session.closeAbout();
    // The resume gets a fresh 20s window, even without an immediate playing event.
    step(1000);
    expect(session.getSnapshot().item?.id).toBe(plan.items[0]!.id);
    expect(session.getSnapshot().activeMs).toBe(1000);
    video.paused = false;
    play(1000);
    session.togglePlayback();
    video.paused = true;
    step(60_000);
    expect(session.getSnapshot().status).toBe("paused");
    expect(session.getSnapshot().item?.id).toBe(plan.items[0]!.id);
    expect(session.getSnapshot().activeMs).toBe(2000);
  });

  it("does not treat seek movement as resumed playback", () => {
    const { video, session, step } = setup();
    video.readyState = 2;
    video.emit("waiting");
    video.seeking = true;
    step(5000, 40);
    video.emit("timeupdate");
    expect(session.getSnapshot().status).toBe("buffering");
    expect(session.getSnapshot().activeMs).toBe(0);
  });

  it("removes watchdog and event listeners when the player is disposed", () => {
    const { video, session, plan, stop, step } = setup();
    stop();
    video.readyState = 0;
    video.emit("stalled");
    step(60_000, 30);
    video.emit("timeupdate");
    expect(session.getSnapshot()).toMatchObject({
      status: "playing",
      item: { id: plan.items[0]!.id },
      activeMs: 0,
    });
    expect(vi.getTimerCount()).toBe(0);
  });
});
