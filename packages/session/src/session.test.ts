import { describe, expect, it } from "vitest";
import type { SessionPlan } from "@mofied/contracts";
import { SessionController } from "./index";

const media = (id: string) => ({
  kind: "media" as const,
  id,
  mediaId: id,
  title: id,
  pageUrl: "https://faqieh.com/ar/media/1",
  posterUrl: null,
  durationMs: 60_000,
  playback: {
    url: "https://media.example.test/video.mp4",
    mimeType: "video/mp4" as const,
  },
  speaker: {
    id: "speaker",
    name: "Speaker",
    pageUrl: "https://faqieh.com/ar/speakers/1",
    imageUrl: null,
  },
});
function setup(overrides: Partial<SessionPlan> = {}) {
  let now = 0;
  const plan: SessionPlan = {
    schemaVersion: 1,
    id: "test",
    locale: "ar",
    expiresAt: null,
    policy: {
      maxActiveMs: 60_000,
      limitBehavior: "finish-current-item",
      maxConsecutiveFailures: 3,
    },
    items: [
      media("a"),
      {
        kind: "reminder",
        id: "reminder",
        durationMs: 5000,
        content: { kind: "text", body: "Read", citation: "", source: "" },
      },
      media("b"),
    ],
    replacements: [],
    ending: { title: "End", body: "Reflect" },
    ...overrides,
  };
  const session = new SessionController(plan, () => now);
  return {
    session,
    plan,
    step: (ms: number) => {
      now += ms;
    },
    clock: () => now,
  };
}

describe("session execution", () => {
  it("reconciles sampling jitter over continuous playback without losing elapsed time", () => {
    const { session, step } = setup();
    session.mediaPlaying("a", 0);
    let position = 0;
    for (let sample = 0; sample < 240; sample++) {
      step(250);
      position += sample % 2 === 0 ? 230 : 270;
      session.mediaProgress("a", position);
    }
    expect(session.getSnapshot().activeMs).toBe(60_000);
  });

  it("counts progressing playback, excluding buffering, pauses, seeks and stale player events", () => {
    const { session: s, step } = setup();
    s.mediaPlaying("a", 0);
    step(1000);
    s.mediaProgress("a", 1000);
    expect(s.getSnapshot().activeMs).toBe(1000);
    s.mediaBuffering("a");
    step(5000);
    s.mediaProgress("a", 1000);
    expect(s.getSnapshot().activeMs).toBe(1000);
    s.mediaPlaying("a", 1000);
    step(100);
    s.mediaProgress("a", 20_000);
    expect(s.getSnapshot().activeMs).toBe(1000);
    step(1000);
    s.mediaProgress("a", 21_000);
    expect(s.getSnapshot().activeMs).toBe(2000);
    s.togglePlayback();
    step(3000);
    s.mediaProgress("a", 21_000);
    s.mediaEnded("stale", 99_000);
    expect(s.getSnapshot().activeMs).toBe(2000);
    expect(s.getSnapshot().item?.id).toBe("a");
  });
  it("accounts hidden-tab media progress even when callbacks are delayed", () => {
    const { session: s, step } = setup();
    s.mediaPlaying("a", 0);
    step(30_000);
    s.mediaProgress("a", 30_000);
    expect(s.getSnapshot().activeMs).toBe(30_000);
  });
  it("honors server reminder order and never charges callback overshoot to the following media", () => {
    const { session: s, step } = setup();
    s.next();
    expect(s.getSnapshot().item?.kind).toBe("reminder");
    s.next();
    s.previous();
    expect(s.getSnapshot().item?.id).toBe("reminder");
    step(30_000);
    s.tick();
    expect(s.getSnapshot().activeMs).toBe(5000);
    expect(s.getSnapshot().item?.id).toBe("b");
    expect(s.getSnapshot().positionMs).toBe(0);
  });
  it("pauses the reminder countdown while reading, without counting the pause", () => {
    const { session: s, step } = setup();
    s.next();
    step(1000);
    s.tick();
    s.togglePlayback();
    step(50_000);
    s.tick();
    expect(s.getSnapshot().reminderRemainingMs).toBe(4000);
    s.togglePlayback();
    step(1000);
    s.tick();
    expect(s.getSnapshot().reminderRemainingMs).toBe(3000);
    expect(s.getSnapshot().activeMs).toBe(2000);
  });
  it("does not replay a consumed reminder when navigating backward then forward", () => {
    const { session: s, step } = setup();
    s.next();
    step(5000);
    s.tick();
    s.previous();
    expect(s.getSnapshot().item?.id).toBe("a");
    s.next();
    expect(s.getSnapshot().item?.id).toBe("b");
  });
  it("preserves pause intent through About and native backgrounding", () => {
    const { session: s, step } = setup();
    s.next();
    step(1000);
    s.tick();
    s.openAbout();
    step(5000);
    s.tick();
    s.closeAbout();
    expect(s.getSnapshot().reminderRemainingMs).toBe(4000);
    s.setBackgrounded(true);
    step(50_000);
    s.setBackgrounded(false);
    expect(s.getSnapshot().reminderRemainingMs).toBe(4000);
    expect(s.getSnapshot().shouldPlay).toBe(true);
    s.togglePlayback();
    s.openAbout();
    s.closeAbout();
    s.setBackgrounded(true);
    s.setBackgrounded(false);
    expect(s.getSnapshot().shouldPlay).toBe(false);
  });
  it("resumes permitted interruptions only when the user has not paused", () => {
    const { session: s } = setup();
    s.setInterrupted(true);
    expect(s.getSnapshot().shouldPlay).toBe(false);
    s.setInterrupted(false);
    expect(s.getSnapshot().shouldPlay).toBe(true);
    s.setInterrupted(true);
    s.togglePlayback();
    s.setInterrupted(false);
    expect(s.getSnapshot().shouldPlay).toBe(false);
    s.togglePlayback();
    s.setInterrupted(true);
    s.setInterrupted(false, false);
    expect(s.getSnapshot().shouldPlay).toBe(false);
  });
  it("finishes the current media at the budget, then ends without starting the next item", () => {
    const { session: s, step } = setup({
      policy: {
        maxActiveMs: 1000,
        limitBehavior: "finish-current-item",
        maxConsecutiveFailures: 3,
      },
    });
    s.mediaPlaying("a", 0);
    step(2000);
    s.mediaProgress("a", 2000);
    expect(s.getSnapshot().status).toBe("playing");
    expect(s.getSnapshot().remainingMs).toBe(0);
    s.mediaEnded("a", 2000);
    expect(s.getSnapshot().status).toBe("ended");
    s.previous();
    s.next();
    s.togglePlayback();
    expect(s.getSnapshot().status).toBe("ended");
  });
  it("finishes a running reminder at the budget boundary", () => {
    const { session: s, step } = setup({
      policy: {
        maxActiveMs: 1000,
        limitBehavior: "finish-current-item",
        maxConsecutiveFailures: 3,
      },
    });
    s.next();
    step(2000);
    s.tick();
    expect(s.getSnapshot().item?.kind).toBe("reminder");
    step(3000);
    s.tick();
    expect(s.getSnapshot().status).toBe("ended");
  });
  it("does not start previous or replacement media after the session budget is consumed", () => {
    for (const action of ["previous", "failure"] as const) {
      const { session: s, step } = setup({
        items: [media("a"), media("b")],
        replacements: [media("spare")],
        policy: {
          maxActiveMs: 1000,
          limitBehavior: "finish-current-item",
          maxConsecutiveFailures: 3,
        },
      });
      s.next();
      s.mediaPlaying("b", 0);
      step(1500);
      s.mediaProgress("b", 1500);
      if (action === "previous") s.previous();
      else s.mediaFailed("b");
      expect(s.getSnapshot().status).toBe("ended");
    }
  });
  it("consumes server replacements once and keeps the reminder slot in place", () => {
    const { session: s, step } = setup({ replacements: [media("spare")] });
    s.mediaFailed("a");
    expect(s.getSnapshot().item?.id).toBe("spare");
    s.mediaEnded("a", 60_000);
    expect(s.getSnapshot().item?.id).toBe("spare");
    s.mediaFailed("spare");
    expect(s.getSnapshot().item?.id).toBe("reminder");
    step(5000);
    s.tick();
    s.mediaFailed("b");
    expect(s.getSnapshot().status).toBe("error");
    s.retry();
    expect(s.getSnapshot().status).toBe("loading");
  });
  it("has a finite natural end and does not persist an ended session", () => {
    const { session: s, step } = setup();
    s.next();
    step(5000);
    s.tick();
    s.next();
    expect(s.getSnapshot().status).toBe("ended");
    expect(s.serialize()).toBeNull();
    s.openAbout();
    expect(s.getSnapshot().aboutOpen).toBe(true);
    s.closeAbout();
    expect(s.getSnapshot().status).toBe("ended");
  });
  it("restores valid progress paused, including used replacement state and reminders", () => {
    const {
      session: s,
      clock,
      step,
    } = setup({ replacements: [media("spare")] });
    s.mediaFailed("a");
    s.mediaPlaying("spare", 0);
    step(1000);
    s.mediaProgress("spare", 1000);
    const restored = SessionController.restore(s.serialize()!, clock)!;
    expect(restored.getSnapshot().item?.id).toBe("spare");
    expect(restored.getSnapshot().positionMs).toBe(1000);
    expect(restored.getSnapshot().activeMs).toBe(1000);
    expect(restored.getSnapshot().shouldPlay).toBe(false);
    expect(SessionController.restore("not json")).toBeNull();
    expect(
      SessionController.restore(JSON.stringify({ version: 1, index: 99 })),
    ).toBeNull();
  });
});
