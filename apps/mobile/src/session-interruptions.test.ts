import { describe, expect, it } from "vitest";
import { SessionController } from "@mofied/session";
import { fixture } from "@mofied/fixtures";
import {
  watchSessionInterruptions,
  type AudioInterruption,
  type InterruptionSource,
} from "./session-interruptions";

class NativeModuleSource implements InterruptionSource {
  state: AudioInterruption = { interrupted: false, mayResume: true };
  listeners = new Set<(event: AudioInterruption) => void>();
  getAudioInterruption = () => this.state;
  addListener(
    _name: "audioInterruption",
    listener: (event: AudioInterruption) => void,
  ) {
    this.listeners.add(listener);
    return {
      remove: () => {
        this.listeners.delete(listener);
      },
    };
  }
  emit(interrupted: boolean, mayResume = true) {
    this.state = { interrupted, mayResume };
    for (const listener of this.listeners) listener(this.state);
  }
}

describe("session interruption lifetime", () => {
  it.each(["next", "ended"])(
    "receives interruption end on a reminder after media %s and player disposal",
    (transition) => {
      let now = 0;
      const session = new SessionController(fixture(), () => now);
      const source = new NativeModuleSource();
      const stop = watchSessionInterruptions(source, session);
      const media = session.getSnapshot().item!;
      source.emit(true);
      if (transition === "next") session.next();
      else session.mediaEnded(media.id, media.durationMs);
      // No player exists on this screen. The native module still owns the event.
      expect(source.listeners.size).toBe(1);
      now += 30_000;
      session.tick();
      expect(session.getSnapshot()).toMatchObject({
        status: "paused",
        interrupted: true,
        reminderRemainingMs: 20_000,
        activeMs: 0,
      });
      source.emit(false);
      now += 1000;
      session.tick();
      expect(session.getSnapshot()).toMatchObject({
        status: "reminder",
        interrupted: false,
        reminderRemainingMs: 19_000,
        activeMs: 1000,
      });
      stop();
      expect(source.listeners.size).toBe(0);
    },
  );

  it.each(["denied", "manual", "About", "background"])(
    "preserves %s pause intent when an interruption ends on a reminder",
    (reason) => {
      const session = new SessionController(fixture());
      const source = new NativeModuleSource();
      watchSessionInterruptions(source, session);
      source.emit(true);
      session.next();
      if (reason === "manual") session.togglePlayback();
      if (reason === "About") session.openAbout();
      if (reason === "background") session.setBackgrounded(true);
      source.emit(false, reason !== "denied");
      expect(session.getSnapshot()).toMatchObject({
        interrupted: false,
        shouldPlay: false,
      });
      if (reason === "About") session.closeAbout();
      else if (reason === "background") session.setBackgrounded(false);
      else session.togglePlayback();
      expect(session.getSnapshot().shouldPlay).toBe(true);
    },
  );

  it("reconciles a pre-existing interruption and ignores queued callbacks after disposal", () => {
    const source = new NativeModuleSource();
    source.emit(true);
    const session = new SessionController(fixture());
    const stop = watchSessionInterruptions(source, session);
    expect(session.getSnapshot().interrupted).toBe(true);
    const queued = [...source.listeners][0]!;
    stop();
    queued({ interrupted: false, mayResume: true });
    expect(session.getSnapshot().interrupted).toBe(true);
  });
});

class IOSResumeSource extends NativeModuleSource {
  requests = 0;
  resumeAudioSession = async () => {
    this.requests++;
    // Only a successful native activation may emit permission to resume.
  };
}

describe("iOS interruption recovery without an end notification", () => {
  it("reactivates on foreground return, but not when an interruption begins in the foreground", () => {
    const session = new SessionController(fixture());
    const source = new IOSResumeSource();
    watchSessionInterruptions(source, session);
    source.emit(true);
    session.tick();
    expect(source.requests).toBe(0);
    session.setBackgrounded(true);
    session.setBackgrounded(false);
    expect(source.requests).toBe(1);
    expect(session.getSnapshot().shouldPlay).toBe(false);
    source.emit(false);
    expect(session.getSnapshot().shouldPlay).toBe(true);
  });

  it.each(["manual", "About", "retry"])(
    "defers reactivation until %s allows intended activity",
    (reason) => {
      const plan = fixture();
      plan.items = [plan.items[0]!];
      plan.replacements = [];
      const session = new SessionController(plan);
      const source = new IOSResumeSource();
      watchSessionInterruptions(source, session);
      session.setBackgrounded(true);
      source.emit(true);
      if (reason === "manual") session.togglePlayback();
      if (reason === "About") session.openAbout();
      if (reason === "retry") session.mediaFailed(plan.items[0]!.id);
      session.setBackgrounded(false);
      expect(source.requests).toBe(0);
      expect(session.getSnapshot().shouldPlay).toBe(false);
      if (reason === "manual") session.togglePlayback();
      if (reason === "About") session.closeAbout();
      if (reason === "retry") session.retry();
      expect(source.requests).toBe(1);
      expect(session.getSnapshot().shouldPlay).toBe(false);
      source.emit(false);
      expect(session.getSnapshot().shouldPlay).toBe(true);
    },
  );

  it("keeps a manually paused reminder paused until explicit resume and waits through denied activation", async () => {
    let now = 0;
    const session = new SessionController(fixture(), () => now);
    session.next();
    session.togglePlayback();
    const source = new IOSResumeSource();
    source.emit(true);
    source.resumeAudioSession = async () => {
      source.requests++;
      throw new Error("Audio session activation denied");
    };
    const stop = watchSessionInterruptions(source, session);
    expect(source.requests).toBe(0);
    session.togglePlayback();
    await Promise.resolve();
    expect(source.requests).toBe(1);
    now += 25_000;
    session.tick();
    expect(source.requests).toBe(1);
    expect(session.getSnapshot()).toMatchObject({
      interrupted: true,
      activeMs: 0,
      reminderRemainingMs: 20_000,
    });
    // A later grant still cannot override a pause made while waiting.
    session.togglePlayback();
    source.emit(false);
    expect(session.getSnapshot().shouldPlay).toBe(false);
    stop();
    session.togglePlayback();
    expect(source.requests).toBe(1);
  });
});

class AndroidFocusSource extends NativeModuleSource {
  requests: { active: boolean; generation: number }[] = [];
  setAudioSessionActive = async (active: boolean, generation: number) => {
    this.requests.push({ active, generation });
  };
  focus(
    interrupted: boolean,
    mayResume = true,
    generation = this.requests.at(-1)!.generation,
  ) {
    this.state = { interrupted, mayResume, focusGeneration: generation };
    for (const listener of this.listeners) listener(this.state);
  }
}

describe("foreground Android focus ownership", () => {
  it.each(["foreground", "background", "About"])(
    "does not reacquire while waiting for Retry after a media failure in %s",
    (when) => {
      const plan = fixture();
      plan.items = [plan.items[0]!];
      plan.replacements = [];
      const session = new SessionController(plan);
      const source = new AndroidFocusSource();
      watchSessionInterruptions(source, session);
      source.focus(false);
      if (when === "background") session.setBackgrounded(true);
      if (when === "About") session.openAbout();
      session.mediaFailed(plan.items[0]!.id);
      session.setBackgrounded(true);
      session.setBackgrounded(false);
      session.closeAbout();
      session.tick();
      expect(source.requests.map((r) => r.active)).toEqual([true, false]);
      expect(session.getSnapshot()).toMatchObject({
        status: "error",
        wantsToPlay: true,
        shouldPlay: false,
      });
      session.retry();
      expect(source.requests.map((r) => r.active)).toEqual([true, false, true]);
      expect(session.getSnapshot().shouldPlay).toBe(false);
      source.focus(false);
      expect(session.getSnapshot().shouldPlay).toBe(true);
    },
  );

  it("does not acquire when attached to a session already waiting for Retry", () => {
    const plan = fixture();
    plan.items = [plan.items[0]!];
    plan.replacements = [];
    const session = new SessionController(plan);
    session.mediaFailed(plan.items[0]!.id);
    const source = new AndroidFocusSource();
    watchSessionInterruptions(source, session);
    expect(source.requests.map((r) => r.active)).toEqual([false]);
    session.retry();
    expect(source.requests.map((r) => r.active)).toEqual([false, true]);
    expect(session.getSnapshot().shouldPlay).toBe(false);
    source.focus(false);
    expect(session.getSnapshot().shouldPlay).toBe(true);
  });

  it("keeps Retry available after an interrupted failure releases its focus owner", () => {
    const plan = fixture();
    plan.items = [plan.items[0]!];
    plan.replacements = [];
    const session = new SessionController(plan);
    const source = new AndroidFocusSource();
    watchSessionInterruptions(source, session);
    source.focus(false);
    source.focus(true);
    session.mediaFailed(plan.items[0]!.id);
    session.setBackgrounded(true);
    session.setBackgrounded(false);
    expect(source.requests.map((r) => r.active)).toEqual([true, false]);
    expect(session.getSnapshot()).toMatchObject({
      status: "paused",
      interrupted: true,
      retryRequired: true,
      shouldPlay: false,
    });
    session.retry();
    expect(source.requests.map((r) => r.active)).toEqual([true, false, true]);
    expect(session.getSnapshot().retryRequired).toBe(false);
    expect(session.getSnapshot().shouldPlay).toBe(false);
    source.focus(false);
    expect(session.getSnapshot().shouldPlay).toBe(true);
  });

  it("does not acquire on a paused session until the user resumes", () => {
    const session = new SessionController(fixture());
    session.togglePlayback();
    const source = new AndroidFocusSource();
    watchSessionInterruptions(source, session);
    session.tick();
    expect(source.requests.map((r) => r.active)).toEqual([false]);
    expect(session.getSnapshot().wantsToPlay).toBe(false);
    session.togglePlayback();
    expect(source.requests.map((r) => r.active)).toEqual([false, true]);
    expect(session.getSnapshot().shouldPlay).toBe(false);
    source.focus(false);
    expect(session.getSnapshot().shouldPlay).toBe(true);
  });

  it("defers acquisition behind startup About until closing makes the session eligible", () => {
    const session = new SessionController(fixture());
    session.openAbout();
    const source = new AndroidFocusSource();
    watchSessionInterruptions(source, session);
    expect(source.requests.map((r) => r.active)).toEqual([false]);
    session.closeAbout();
    expect(source.requests.map((r) => r.active)).toEqual([false, true]);
    expect(session.getSnapshot().shouldPlay).toBe(false);
    source.focus(false);
    expect(session.getSnapshot().shouldPlay).toBe(true);
  });

  it("retains acquired focus while paused, but does not reacquire on a paused foreground return", () => {
    const session = new SessionController(fixture());
    const source = new AndroidFocusSource();
    watchSessionInterruptions(source, session);
    source.focus(false);
    session.togglePlayback();
    session.openAbout();
    session.closeAbout();
    expect(source.requests.map((r) => r.active)).toEqual([true]);
    session.setBackgrounded(true);
    session.setBackgrounded(false);
    expect(source.requests.map((r) => r.active)).toEqual([true, false]);
    expect(session.getSnapshot().shouldPlay).toBe(false);
    session.togglePlayback();
    expect(source.requests.map((r) => r.active)).toEqual([true, false, true]);
    expect(session.getSnapshot().shouldPlay).toBe(false);
    source.focus(false);
    expect(session.getSnapshot().shouldPlay).toBe(true);
  });

  it("does not acquire when resume intent changes behind About", () => {
    const session = new SessionController(fixture());
    session.togglePlayback();
    session.openAbout();
    const source = new AndroidFocusSource();
    watchSessionInterruptions(source, session);
    session.togglePlayback();
    expect(source.requests.map((r) => r.active)).toEqual([false]);
    session.closeAbout();
    expect(source.requests.map((r) => r.active)).toEqual([false, true]);
    expect(session.getSnapshot().shouldPlay).toBe(false);
    source.focus(false);
    expect(session.getSnapshot().shouldPlay).toBe(true);
  });

  it("gates a plan starting with a reminder until focus is granted, and owns focus across items", () => {
    let now = 0;
    const plan = fixture();
    plan.items.shift();
    const session = new SessionController(plan, () => now);
    const source = new AndroidFocusSource();
    const stop = watchSessionInterruptions(source, session);
    expect(source.requests.map((r) => r.active)).toEqual([true]);
    now += 5000;
    session.tick();
    expect(session.getSnapshot()).toMatchObject({
      interrupted: true,
      activeMs: 0,
      reminderRemainingMs: 20_000,
    });
    source.focus(false);
    now += 1000;
    session.tick();
    expect(session.getSnapshot().reminderRemainingMs).toBe(19_000);
    source.focus(true); // A NEW interruption starts with no player mounted.
    now += 5000;
    session.tick();
    expect(session.getSnapshot().reminderRemainingMs).toBe(19_000);
    source.focus(false);
    now += 19_000;
    session.tick();
    expect(session.getSnapshot().item?.kind).toBe("media");
    expect(source.requests).toHaveLength(1);
    stop();
    expect(source.requests.map((r) => r.active)).toEqual([true, false]);
  });

  it("releases on background/end and ignores callbacks from prior ownership", () => {
    const session = new SessionController(fixture());
    const source = new AndroidFocusSource();
    watchSessionInterruptions(source, session);
    const initial = source.requests[0]!.generation;
    source.focus(false);
    session.setBackgrounded(true);
    expect(source.requests.at(-1)?.active).toBe(false);
    session.setBackgrounded(false);
    expect(session.getSnapshot().shouldPlay).toBe(false);
    source.focus(false, true, initial);
    expect(session.getSnapshot().shouldPlay).toBe(false);
    source.focus(false);
    expect(session.getSnapshot().shouldPlay).toBe(true);
    session.next();
    expect(source.requests).toHaveLength(3);
    // A separate one-item session reaches the ending and releases immediately.
    const plan = fixture();
    plan.items = [plan.items[0]!];
    const ending = new SessionController(plan);
    const endSource = new AndroidFocusSource();
    watchSessionInterruptions(endSource, ending);
    endSource.focus(false);
    ending.next();
    expect(endSource.requests.map((r) => r.active)).toEqual([true, false]);
  });

  it("denied initial focus stays paused until an explicit retry receives a grant", () => {
    const session = new SessionController(fixture());
    const source = new AndroidFocusSource();
    watchSessionInterruptions(source, session);
    source.focus(false, false);
    expect(session.getSnapshot()).toMatchObject({
      wantsToPlay: false,
      shouldPlay: false,
    });
    session.tick();
    expect(source.requests).toHaveLength(1);
    session.togglePlayback();
    expect(source.requests).toHaveLength(2);
    expect(session.getSnapshot().shouldPlay).toBe(false);
    source.focus(false);
    expect(session.getSnapshot().shouldPlay).toBe(true);
  });

  it.each(["manual", "About"])(
    "delayed focus gain preserves %s pause intent",
    (reason) => {
      const session = new SessionController(fixture());
      const source = new AndroidFocusSource();
      watchSessionInterruptions(source, session);
      source.focus(true);
      if (reason === "manual") session.togglePlayback();
      else session.openAbout();
      source.focus(false);
      expect(session.getSnapshot().shouldPlay).toBe(false);
      expect(source.requests).toHaveLength(1);
      if (reason === "manual") {
        session.togglePlayback();
        expect(session.getSnapshot().shouldPlay).toBe(false);
        source.focus(false);
      } else session.closeAbout();
      expect(session.getSnapshot().shouldPlay).toBe(true);
    },
  );
});
