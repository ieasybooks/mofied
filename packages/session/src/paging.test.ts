import { describe, expect, it } from "vitest";
import { fixture } from "@mofied/fixtures";
import { SessionController, SessionPager, commitsPage } from "./index";

function setup() {
  let now = 0;
  const session = new SessionController(fixture(), () => now);
  const pager = new SessionPager(session);
  const stop = pager.connect();
  return {
    session,
    pager,
    stop,
    advance: (ms: number) => {
      now += ms;
      session.tick();
    },
    finish: () => pager.finish(pager.getSnapshot().revision),
  };
}
describe("page settlement and session ownership", () => {
  it("previews without navigating, counting or consuming a reminder", () => {
    const { session, pager, advance, finish } = setup();
    const first = session.getSnapshot().item!;
    session.mediaPlaying(first.id, 0);
    pager.begin();
    pager.preview(1);
    expect(pager.getSnapshot().neighbor?.item?.kind).toBe("reminder");
    advance(5000);
    session.mediaProgress(first.id, 5000);
    expect(session.getSnapshot()).toMatchObject({
      item: first,
      activeMs: 0,
      wantsToPlay: true,
      shouldPlay: false,
    });
    pager.release(true);
    expect(session.getSnapshot().item).toBe(first);
    finish();
    expect(session.getSnapshot()).toMatchObject({
      index: 1,
      shouldPlay: true,
      reminderRemainingMs: 20_000,
    });
    expect(pager.begin()).toBe(false);
  });
  it("cancels to the same player position and preserves manual pause", () => {
    const { session, pager, finish } = setup();
    session.togglePlayback();
    session.mediaProgress(session.getSnapshot().item!.id, 2500);
    pager.begin();
    pager.preview(1);
    pager.release(false);
    finish();
    expect(session.getSnapshot()).toMatchObject({
      index: 0,
      positionMs: 2500,
      wantsToPlay: false,
      shouldPlay: false,
      navigating: false,
    });
  });
  it("resists the first-page boundary and does not navigate twice during a snap", () => {
    const { session, pager, finish } = setup();
    pager.begin();
    expect(pager.preview(-1)).toBe(false);
    pager.release(true);
    finish();
    expect(session.getSnapshot().index).toBe(0);
    pager.navigate(1);
    pager.navigate(1);
    finish();
    expect(session.getSnapshot().index).toBe(1);
  });
  it.each(["about", "background", "interruption"])(
    "cancels a pending swipe when %s takes over",
    (reason) => {
      const { session, pager, finish } = setup();
      pager.navigate(1);
      if (reason === "about") session.openAbout();
      if (reason === "background") session.setBackgrounded(true);
      if (reason === "interruption") session.setInterrupted(true);
      finish();
      expect(session.getSnapshot()).toMatchObject({
        index: 0,
        navigating: false,
        shouldPlay: false,
      });
      expect(pager.getSnapshot().phase).toBe("idle");
    },
  );
  it("holds a naturally entered reminder until the incoming page settles", () => {
    const { session, pager, advance, finish } = setup();
    session.mediaEnded(session.getSnapshot().item!.id, 1000);
    expect(pager.getSnapshot()).toMatchObject({
      phase: "settling",
      automatic: true,
    });
    advance(5000);
    expect(session.getSnapshot().reminderRemainingMs).toBe(20_000);
    finish();
    advance(1000);
    expect(session.getSnapshot().reminderRemainingMs).toBe(19_000);
  });
  it("skips consumed reminders in previews as well as committed history", () => {
    const { session, pager, advance, finish } = setup();
    pager.navigate(1);
    finish();
    advance(20_000);
    finish();
    pager.navigate(-1);
    finish();
    pager.begin();
    pager.preview(1);
    expect(pager.getSnapshot().neighbor?.index).toBe(2);
    pager.release(true);
    finish();
    expect(session.getSnapshot().index).toBe(2);
  });
  it("previews the ending after the final item and removes saved state on settlement", () => {
    const { session, pager, advance, finish } = setup();
    pager.navigate(1);
    finish();
    advance(20_000);
    finish();
    pager.begin();
    pager.preview(1);
    expect(pager.getSnapshot().neighbor?.item).toBeNull();
    expect(session.serialize()).not.toBeNull();
    pager.release(true);
    finish();
    expect(session.serialize()).toBeNull();
  });
  it("previews actual replacement content and ignores stale animation completions", () => {
    const { session, pager, finish } = setup();
    session.mediaFailed(session.getSnapshot().item!.id);
    finish();
    const replacement = session.getSnapshot().item;
    pager.navigate(1);
    const revision = pager.getSnapshot().revision;
    pager.cancel();
    pager.navigate(1);
    pager.finish(revision);
    expect(session.getSnapshot().item).toBe(replacement);
    finish();
    expect(session.getSnapshot().index).toBe(1);
  });
  it("previews the ending in either direction once the active budget is spent", () => {
    let now = 0;
    const plan = fixture();
    plan.policy.maxActiveMs = 1000;
    const session = new SessionController(plan, () => now);
    const pager = new SessionPager(session);
    pager.connect();
    const id = session.getSnapshot().item!.id;
    session.mediaPlaying(id, 0);
    now = 1000;
    session.mediaProgress(id, 1000);
    expect(session.getSnapshot().remainingMs).toBe(0);
    pager.begin();
    pager.preview(1);
    expect(pager.getSnapshot().neighbor?.item).toBeNull();
    pager.preview(-1);
    expect(pager.getSnapshot().neighbor?.item).toBeNull();
    pager.release(true);
    pager.finish(pager.getSnapshot().revision);
    expect(session.getSnapshot().status).toBe("ended");
  });
  it("interrupting an automatic transition preserves the already entered reminder", () => {
    const { session, pager, advance, finish } = setup();
    session.mediaEnded(session.getSnapshot().item!.id, 1000);
    const stale = pager.getSnapshot().revision;
    session.openAbout();
    pager.finish(stale);
    expect(pager.getSnapshot()).toMatchObject({
      phase: "idle",
      neighbor: null,
    });
    expect(session.getSnapshot()).toMatchObject({
      index: 1,
      navigating: false,
      shouldPlay: false,
    });
    advance(5000);
    expect(session.getSnapshot().reminderRemainingMs).toBe(20_000);
    session.closeAbout();
    advance(1000);
    expect(session.getSnapshot().reminderRemainingMs).toBe(19_000);
    finish();
    expect(session.getSnapshot().index).toBe(1);
  });
  it("cleanup never persists a transition pause or leaves permission blocked", () => {
    const { session, pager, stop } = setup();
    pager.navigate(1);
    stop();
    expect(session.getSnapshot()).toMatchObject({
      index: 0,
      navigating: false,
      shouldPlay: true,
    });
    expect(
      SessionController.restore(session.serialize()!)?.getSnapshot(),
    ).toMatchObject({ navigating: false, wantsToPlay: false });
  });
  it("uses distance or a deliberate flick, with no tiny/horizontal drift commitment", () => {
    expect(commitsPage(160, 0, 900)).toBe(true);
    expect(commitsPage(-40, -0.7, 900)).toBe(true);
    expect(commitsPage(-40, 0.7, 900)).toBe(false);
    expect(commitsPage(12, 2, 900)).toBe(false);
    expect(commitsPage(60, 0, 900)).toBe(false);
  });
});
