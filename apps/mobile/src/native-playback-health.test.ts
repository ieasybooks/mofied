import { afterEach, describe, expect, it, vi } from "vitest";
import type { VideoPlayerEvents, VideoPlayerStatus } from "expo-video";
import { SessionController } from "@mofied/session";
import { fixture } from "@mofied/fixtures";
import {
  watchNativePlaybackHealth,
  type NativePlaybackPlayer,
} from "./native-playback-health";

class NativePlayer implements NativePlaybackPlayer {
  currentTime = 34.802;
  duration = 166;
  status: VideoPlayerStatus = "readyToPlay";
  playing = true;
  // Commands and native acknowledgements are asynchronous, so play/pause do
  // not change properties automatically in this fake.
  play = vi.fn();
  pause = vi.fn();
  listeners = new Map<string, Set<(...args: any[]) => void>>();
  addListener<E extends keyof VideoPlayerEvents>(
    name: E,
    listener: VideoPlayerEvents[E],
  ) {
    const listeners = this.listeners.get(name) ?? new Set();
    listeners.add(listener);
    this.listeners.set(name, listeners);
    return { remove: () => listeners.delete(listener) };
  }
  emit<E extends keyof VideoPlayerEvents>(
    name: E,
    ...args: Parameters<VideoPlayerEvents[E]>
  ) {
    for (const listener of this.listeners.get(name) ?? []) listener(...args);
  }
}

function setup() {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  let now = 0;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  const plan = fixture();
  const session = new SessionController(plan, () => now);
  const player = new NativePlayer();
  const stop = watchNativePlaybackHealth(player, session, plan.items[0]!.id);
  player.emit("playingChange", { isPlaying: true });
  return {
    player,
    session,
    plan,
    stop,
    step(ms: number, position = player.currentTime, callbacks = ms) {
      now += ms;
      player.currentTime = position;
      vi.advanceTimersByTime(callbacks);
    },
    play(ms: number) {
      for (let elapsed = 0; elapsed < ms; elapsed += 250) {
        now += 250;
        player.currentTime += 0.25;
        vi.advanceTimersByTime(250);
        player.emit("timeUpdate", {
          currentTime: player.currentTime,
          currentLiveTimestamp: null,
          currentOffsetFromLive: null,
          bufferedPosition: player.currentTime + 10,
        });
      }
    },
  };
}

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("native playback health", () => {
  it("caps consecutive ready-but-stalled players before any healthy playback", () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    let now = 0;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    const plan = fixture();
    const original = plan.items.find((item) => item.kind === "media")!;
    plan.items = Array.from({ length: 6 }, (_, index) => ({
      ...original,
      id: `stalled-${index}`,
    }));
    plan.replacements = [];
    plan.policy.maxConsecutiveFailures = 3;
    const session = new SessionController(plan, () => now);
    const attempted: string[] = [];
    while (session.getSnapshot().status !== "error" && attempted.length < 6) {
      const id = session.getSnapshot().item!.id;
      attempted.push(id);
      const player = new NativePlayer();
      player.currentTime = 0;
      const stop = watchNativePlaybackHealth(player, session, id);
      player.emit("playingChange", { isPlaying: true });
      for (let second = 0; second < 20; second++) {
        now += 1000;
        player.emit("statusChange", { status: "readyToPlay" });
        vi.advanceTimersByTime(1000);
      }
      stop();
    }
    expect(attempted).toEqual(["stalled-0", "stalled-1", "stalled-2"]);
    expect(session.getSnapshot()).toMatchObject({
      status: "error",
      activeMs: 0,
    });
  });

  it("pauses actual muted playback when an interruption blocks accounting", () => {
    const { player, session, step } = setup();
    session.setInterrupted(true);
    player.emit("playingChange", { isPlaying: true });
    expect(player.pause).toHaveBeenCalled();
    player.playing = false;
    step(10_000);
    expect(session.getSnapshot()).toMatchObject({
      status: "paused",
      activeMs: 0,
    });
  });

  it("recovers on advancing time without another playing callback", () => {
    const { player, session, plan, play, step } = setup();
    play(1000);
    player.status = "loading";
    player.playing = false;
    player.emit("statusChange", { status: "loading" });
    player.emit("playingChange", { isPlaying: false });
    step(5000);
    expect(session.getSnapshot()).toMatchObject({
      status: "buffering",
      shouldPlay: true,
      activeMs: 1000,
    });
    player.status = "readyToPlay";
    player.emit("statusChange", { status: "readyToPlay" });
    expect(player.play).toHaveBeenCalledTimes(1);
    player.playing = true;
    play(25_000);
    expect(session.getSnapshot()).toMatchObject({
      status: "playing",
      item: { id: plan.items[0]!.id },
      activeMs: 25_750,
    });
  });

  it("bounds a ready player's resume attempt and fails only after 20s without progress", () => {
    const { player, session, plan, step } = setup();
    player.playing = false;
    player.emit("playingChange", { isPlaying: false });
    step(2000);
    expect(player.play).toHaveBeenCalledTimes(1);
    // Repeated misleading callbacks cannot reset the no-progress deadline.
    for (let second = 2; second < 19; second++) {
      player.emit("statusChange", { status: "readyToPlay" });
      player.emit("playingChange", { isPlaying: true });
      step(1000);
    }
    expect(session.getSnapshot()).toMatchObject({
      status: "buffering",
      shouldPlay: true,
      item: { id: plan.items[0]!.id },
    });
    expect(player.play).toHaveBeenCalledTimes(1);
    step(1000);
    expect(session.getSnapshot().item?.id).toBe(plan.replacements[0]!.id);
    expect(session.getSnapshot().activeMs).toBe(0);
  });

  it("times out a stream that never becomes ready", () => {
    const { player, session, plan, step } = setup();
    session.retry();
    player.status = "loading";
    player.playing = false;
    player.emit("statusChange", { status: "loading" });
    step(20_000);
    expect(player.play).not.toHaveBeenCalled();
    expect(session.getSnapshot().item?.id).toBe(plan.replacements[0]!.id);
  });

  it("samples live progress before a delayed watchdog or stale timeUpdate payload", () => {
    const { player, session, plan, step } = setup();
    step(30_000, player.currentTime + 30, 1000);
    player.emit("timeUpdate", {
      currentTime: 34.802,
      currentLiveTimestamp: null,
      currentOffsetFromLive: null,
      bufferedPosition: 40,
    });
    expect(session.getSnapshot()).toMatchObject({
      status: "playing",
      item: { id: plan.items[0]!.id },
    });
    expect(session.getSnapshot().activeMs).toBeCloseTo(30_000);
    expect(session.getSnapshot().positionMs).toBeCloseTo(64_802);
  });

  it.each(["manual", "About", "background", "interruption"] as const)(
    "does not resume or time out during %s pauses, then gives recovery a fresh window",
    (reason) => {
      const { player, session, plan, step, play } = setup();
      play(1000);
      const pause = () => {
        if (reason === "manual") session.togglePlayback();
        else if (reason === "About") session.openAbout();
        else if (reason === "background") session.setBackgrounded(true);
        else session.setInterrupted(true);
      };
      const resume = () => {
        if (reason === "manual") session.togglePlayback();
        else if (reason === "About") session.closeAbout();
        else if (reason === "background") session.setBackgrounded(false);
        else session.setInterrupted(false, true);
      };
      pause();
      // Late callbacks must not override intent, even for muted interruptions.
      player.emit("playingChange", { isPlaying: true });
      expect(player.pause).toHaveBeenCalledTimes(1);
      player.playing = false;
      player.emit("playingChange", { isPlaying: false });
      player.emit("statusChange", { status: "readyToPlay" });
      step(60_000);
      expect(player.play).not.toHaveBeenCalled();
      expect(session.getSnapshot()).toMatchObject({
        status: "paused",
        activeMs: 1000,
        item: { id: plan.items[0]!.id },
      });
      resume();
      step(19_000);
      expect(session.getSnapshot().item?.id).toBe(plan.items[0]!.id);
      player.playing = true;
      play(1000);
      expect(session.getSnapshot().status).toBe("playing");
      expect(session.getSnapshot().activeMs).toBeLessThanOrEqual(2000);
      expect(session.getSnapshot().activeMs).toBeGreaterThan(1000);
    },
  );

  it("respects a denied interruption resumption even when late callbacks say ready/playing", () => {
    const { player, session, plan, step } = setup();
    session.setInterrupted(true);
    player.playing = false;
    session.setInterrupted(false, false);
    player.emit("statusChange", { status: "readyToPlay" });
    player.emit("playingChange", { isPlaying: true });
    step(60_000);
    expect(player.play).not.toHaveBeenCalled();
    expect(session.getSnapshot()).toMatchObject({
      status: "paused",
      wantsToPlay: false,
      item: { id: plan.items[0]!.id },
    });
  });

  it("ignores events from a media item after navigation or replacement", () => {
    const { player, session, plan, step } = setup();
    session.next();
    player.playing = false;
    player.emit("statusChange", { status: "readyToPlay" });
    player.emit("statusChange", { status: "error" });
    step(60_000);
    expect(player.play).not.toHaveBeenCalled();
    expect(session.getSnapshot().item?.id).toBe(plan.items[1]!.id);
  });

  it("removes listeners/watchdog and ignores callbacks already queued at disposal", () => {
    const { player, session, stop, step } = setup();
    const queued = [...player.listeners.get("statusChange")!][0]!;
    const before = session.getSnapshot();
    stop();
    player.playing = false;
    queued({ status: "readyToPlay" });
    queued({ status: "error" });
    step(60_000);
    expect(player.play).not.toHaveBeenCalled();
    expect(session.getSnapshot()).toBe(before);
    expect(vi.getTimerCount()).toBe(0);
    expect(
      [...player.listeners.values()].every((listeners) => listeners.size === 0),
    ).toBe(true);
  });

  it.each([true, false])(
    "preserves intent across the reported Android event race (muted=%s)",
    (muted) => {
      const { player, session, plan, step, play } = setup();
      if (!muted) session.toggleMuted();
      player.status = "loading";
      player.emit("statusChange", { status: "loading" });
      step(89);
      player.status = "readyToPlay";
      // The queued 'false' payload is older than the current playing property.
      player.emit("playingChange", { isPlaying: false });
      expect(session.getSnapshot().shouldPlay).toBe(true);
      expect(session.getSnapshot().status).not.toBe("autoplay-blocked");
      step(60);
      player.emit("statusChange", { status: "readyToPlay" });
      step(46);
      player.playing = false;
      player.emit("playingChange", { isPlaying: true });
      step(80);
      player.emit("playingChange", { isPlaying: false });
      expect(session.getSnapshot().shouldPlay).toBe(true);
      expect(player.pause).not.toHaveBeenCalled();
      player.playing = true;
      play(25_000);
      expect(session.getSnapshot()).toMatchObject({
        item: { id: plan.items[0]!.id },
        status: "playing",
        shouldPlay: true,
        muted,
      });
      expect(session.getSnapshot().activeMs).toBeGreaterThan(24_000);
      expect(session.getSnapshot().item?.id).toBe(plan.items[0]!.id);
    },
  );
});

describe("native player remount position", () => {
  function remount() {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    const session = new SessionController(fixture());
    const id = session.getSnapshot().item!.id;
    session.mediaProgress(id, 9551);
    session.togglePlayback();
    const player = new NativePlayer();
    player.status = "loading";
    player.playing = false;
    let actual = 0;
    const seek = vi.fn();
    Object.defineProperty(player, "currentTime", {
      get: () => actual,
      set: seek,
    });
    const ready = vi.fn();
    const stop = watchNativePlaybackHealth(player, session, id, {
      initialPositionMs: session.getSnapshot().positionMs,
      onPositionReady: ready,
    });
    const update = (value: number) => {
      actual = value;
      player.emit("timeUpdate", {
        currentTime: 0, // A queued payload may predate the completed native seek.
        currentLiveTimestamp: null,
        currentOffsetFromLive: null,
        bufferedPosition: 0,
      });
    };
    return { session, player, ready, seek, stop, update };
  }
  it("preserves in-memory progress through slow loading and asynchronous seek completion", () => {
    const { session, player, ready, seek, update } = remount();
    vi.advanceTimersByTime(6000);
    expect(session.getSnapshot().positionMs).toBe(9551);
    expect(seek).not.toHaveBeenCalled();
    player.status = "readyToPlay";
    player.emit("statusChange", { status: "readyToPlay" });
    expect(seek).toHaveBeenCalledExactlyOnceWith(9.551);
    vi.advanceTimersByTime(3000);
    expect(session.getSnapshot().positionMs).toBe(9551);
    expect(ready).not.toHaveBeenCalled();
    update(9.551);
    expect(ready).toHaveBeenCalledTimes(1);
    expect(player.play).not.toHaveBeenCalled();
    expect(session.getSnapshot()).toMatchObject({
      positionMs: 9551,
      activeMs: 0,
      wantsToPlay: false,
    });
  });
  it("defers resume until the initial seek is confirmed without counting the seek as playback", () => {
    const { session, player, ready, update } = remount();
    session.togglePlayback();
    player.status = "readyToPlay";
    player.emit("statusChange", { status: "readyToPlay" });
    player.playing = true; // Late native acknowledgement before our pause applies.
    player.emit("playingChange", { isPlaying: true });
    vi.advanceTimersByTime(2000);
    expect(player.pause).toHaveBeenCalled();
    expect(player.play).not.toHaveBeenCalled();
    expect(session.getSnapshot()).toMatchObject({
      positionMs: 9551,
      activeMs: 0,
    });
    player.playing = false;
    update(9.551);
    player.emit("statusChange", { status: "readyToPlay" });
    expect(ready).toHaveBeenCalledTimes(1);
    expect(player.play).toHaveBeenCalledTimes(1);
    expect(session.getSnapshot().activeMs).toBe(0);
  });
  it("does not deliver a late seek acknowledgement after disposal", () => {
    const { player, ready, stop, update } = remount();
    const queued = [...player.listeners.get("timeUpdate")!][0]!;
    stop();
    update(9.551);
    queued({ currentTime: 9.551 });
    expect(ready).not.toHaveBeenCalled();
  });
});
