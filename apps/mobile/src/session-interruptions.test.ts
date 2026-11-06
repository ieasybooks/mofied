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
