import {
  parseSession,
  type MediaItem,
  type SessionItem,
  type SessionPlan,
} from "@mofied/contracts";

export type Status =
  | "loading"
  | "buffering"
  | "playing"
  | "paused"
  | "reminder"
  | "autoplay-blocked"
  | "error"
  | "ended";
export type SessionSnapshot = Readonly<{
  sessionId: string;
  item: SessionItem | null;
  index: number;
  status: Status;
  wantsToPlay: boolean;
  shouldPlay: boolean;
  muted: boolean;
  aboutOpen: boolean;
  backgrounded: boolean;
  interrupted: boolean;
  positionMs: number;
  activeMs: number;
  remainingMs: number;
  reminderRemainingMs: number;
  canPrevious: boolean;
  canNext: boolean;
  ending: SessionPlan["ending"];
}>;

type SavedSession = {
  version: 1;
  plan: SessionPlan;
  index: number;
  positionMs: number;
  activeMs: number;
  reminderRemainingMs: number;
  completed: string[];
  usedReplacements: string[];
  muted: boolean;
};

/** Platform-independent executor. It never chooses content or reminder positions. */
export class SessionController {
  private items: SessionItem[];
  private index = 0;
  private ready:
    "loading" | "buffering" | "playing" | "error" | "autoplay-blocked" =
    "loading";
  private wants = true;
  private muted = true;
  private about = false;
  private background = false;
  private interrupted = false;
  private ended = false;
  private position = 0;
  private active = 0;
  private reminderRemaining = 0;
  private lastTick: number;
  private progressSample: { position: number; at: number } | null = null;
  private failures = 0;
  private completed = new Set<string>();
  private usedReplacements = new Set<string>();
  private listeners = new Set<() => void>();
  private snapshot: SessionSnapshot;

  constructor(
    readonly plan: SessionPlan,
    private clock: () => number = () => performance.now(),
  ) {
    this.items = [...plan.items];
    this.lastTick = clock();
    this.reminderRemaining =
      this.item?.kind === "reminder" ? this.item.durationMs : 0;
    this.snapshot = this.makeSnapshot();
  }

  private get item() {
    return this.ended ? null : (this.items[this.index] ?? null);
  }
  private get permitted() {
    return (
      this.wants &&
      !this.about &&
      !this.background &&
      !this.interrupted &&
      !this.ended
    );
  }
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private makeSnapshot(): SessionSnapshot {
    const item = this.item;
    const status: Status = !item
      ? "ended"
      : !this.permitted
        ? "paused"
        : item.kind === "reminder"
          ? "reminder"
          : this.ready;
    return {
      sessionId: this.plan.id,
      item,
      index: this.index,
      status,
      wantsToPlay: this.wants,
      shouldPlay:
        this.permitted &&
        this.ready !== "error" &&
        this.ready !== "autoplay-blocked",
      muted: this.muted,
      aboutOpen: this.about,
      backgrounded: this.background,
      interrupted: this.interrupted,
      positionMs: this.position,
      activeMs: this.active,
      remainingMs: Math.max(0, this.plan.policy.maxActiveMs - this.active),
      reminderRemainingMs: this.reminderRemaining,
      canPrevious: item?.kind === "media" && this.previousIndex() >= 0,
      canNext: item?.kind === "media",
      ending: this.plan.ending,
    };
  }
  private publish() {
    this.snapshot = this.makeSnapshot();
    for (const listener of this.listeners) listener();
  }
  private isCurrent(id: string) {
    return this.item?.kind === "media" && this.item.id === id;
  }

  /** Reminder time is elapsed clock time, not the number of JS timer callbacks. */
  tick = () => {
    const now = this.clock();
    const elapsed = Math.max(0, now - this.lastTick);
    this.lastTick = now;
    if (this.item?.kind !== "reminder" || !this.permitted) return;
    const consumed = Math.min(this.reminderRemaining, elapsed);
    this.reminderRemaining -= consumed;
    this.active += consumed;
    if (this.reminderRemaining === 0) {
      this.completed.add(this.item.id);
      this.advance();
    } else this.publish();
  };

  /** Account only advancing media playback, excluding stalls, pauses and seeks. */
  mediaProgress(id: string, positionMs: number) {
    if (!this.isCurrent(id) || !Number.isFinite(positionMs)) return;
    const now = this.clock();
    const position = Math.max(0, positionMs);
    if (this.progressSample && this.permitted && this.ready === "playing") {
      const delta = position - this.progressSample.position;
      const wall = Math.max(0, now - this.progressSample.at);
      // A jump larger than elapsed playback is a seek, not consumed session time.
      if (delta > 0 && delta <= wall + 750)
        this.active += Math.min(delta, wall);
    }
    this.position = position;
    this.progressSample = { position, at: now };
    this.publish();
  }
  mediaPlaying(id: string, positionMs: number) {
    if (!this.isCurrent(id)) return;
    this.ready = "playing";
    this.position = Math.max(0, positionMs);
    this.progressSample = { position: this.position, at: this.clock() };
    this.failures = 0;
    this.publish();
  }
  mediaBuffering(id: string) {
    if (!this.isCurrent(id)) return;
    this.ready = "buffering";
    this.progressSample = null;
    this.publish();
  }
  autoplayBlocked(id: string) {
    if (!this.isCurrent(id)) return;
    this.ready = "autoplay-blocked";
    this.progressSample = null;
    this.publish();
  }
  mediaEnded(id: string, positionMs: number) {
    if (!this.isCurrent(id)) return;
    this.mediaProgress(id, positionMs);
    this.advance();
  }
  mediaFailed(id: string) {
    if (!this.isCurrent(id)) return;
    if (this.active >= this.plan.policy.maxActiveMs) return this.finish();
    this.progressSample = null;
    this.failures += 1;
    const replacement = this.plan.replacements.find(
      (item) => !this.usedReplacements.has(item.id),
    );
    if (
      replacement &&
      this.failures < this.plan.policy.maxConsecutiveFailures
    ) {
      this.usedReplacements.add(replacement.id);
      this.items[this.index] = replacement;
      this.enter(this.index);
    } else if (
      this.index < this.items.length - 1 &&
      this.failures < this.plan.policy.maxConsecutiveFailures
    ) {
      this.advance();
    } else {
      this.ready = "error";
      this.publish();
    }
  }
  retry = () => {
    if (this.item?.kind !== "media") return;
    this.failures = 0;
    this.ready = "loading";
    this.wants = true;
    this.publish();
  };
  togglePlayback = () => {
    this.tick();
    if (!this.item) return;
    if (this.ready === "autoplay-blocked") {
      this.ready = "loading";
      this.wants = true;
    } else this.wants = !this.wants;
    this.progressSample = null;
    this.lastTick = this.clock();
    this.publish();
  };
  toggleMuted = () => {
    this.muted = !this.muted;
    this.publish();
  };
  openAbout = () => {
    this.tick();
    this.about = true;
    this.progressSample = null;
    this.publish();
  };
  closeAbout = () => {
    this.about = false;
    this.lastTick = this.clock();
    this.progressSample = null;
    this.publish();
  };
  setBackgrounded = (value: boolean) => {
    this.tick();
    this.background = value;
    this.lastTick = this.clock();
    this.progressSample = null;
    this.publish();
  };
  setInterrupted = (value: boolean, mayResume = true) => {
    this.tick();
    this.interrupted = value;
    if (!value && !mayResume) this.wants = false;
    this.lastTick = this.clock();
    this.progressSample = null;
    this.publish();
  };

  next = () => {
    if (this.item?.kind === "media" && !this.about) this.advance();
  };
  previous = () => {
    if (this.item?.kind !== "media" || this.about) return;
    if (this.active >= this.plan.policy.maxActiveMs) return this.finish();
    const target = this.previousIndex();
    if (target >= 0) this.enter(target);
  };
  private previousIndex() {
    for (let index = this.index - 1; index >= 0; index--)
      if (this.items[index]?.kind === "media") return index;
    return -1;
  }
  private advance() {
    if (this.active >= this.plan.policy.maxActiveMs) return this.finish();
    let target = this.index + 1;
    while (
      this.items[target]?.kind === "reminder" &&
      this.completed.has(this.items[target]!.id)
    )
      target++;
    if (target >= this.items.length) this.finish();
    else this.enter(target);
  }
  private enter(index: number) {
    this.index = index;
    this.position = 0;
    this.ready = "loading";
    this.progressSample = null;
    this.lastTick = this.clock();
    this.reminderRemaining =
      this.item?.kind === "reminder" ? this.item.durationMs : 0;
    this.publish();
  }
  private finish() {
    this.ended = true;
    this.progressSample = null;
    this.publish();
  }

  serialize(): string | null {
    if (this.ended) return null;
    const saved: SavedSession = {
      version: 1,
      plan: {
        ...this.plan,
        items: this.items,
        replacements: this.plan.replacements.filter(
          (item) => !this.usedReplacements.has(item.id),
        ),
      },
      index: this.index,
      positionMs: this.position,
      activeMs: this.active,
      reminderRemainingMs: this.reminderRemaining,
      completed: [...this.completed],
      usedReplacements: [...this.usedReplacements],
      muted: this.muted,
    };
    return JSON.stringify(saved);
  }

  static restore(
    value: string,
    clock?: () => number,
  ): SessionController | null {
    try {
      const saved = JSON.parse(value) as SavedSession;
      if (saved.version !== 1 || !Number.isInteger(saved.index)) return null;
      const plan = parseSession(saved.plan);
      if (saved.index < 0 || saved.index >= plan.items.length) return null;
      if (
        ![saved.positionMs, saved.activeMs, saved.reminderRemainingMs].every(
          (n) => Number.isFinite(n) && n >= 0,
        )
      )
        return null;
      if (
        !Array.isArray(saved.completed) ||
        !saved.completed.every((id) => typeof id === "string")
      )
        return null;
      if (
        !Array.isArray(saved.usedReplacements) ||
        !saved.usedReplacements.every((id) => typeof id === "string")
      )
        return null;
      const controller = new SessionController(plan, clock);
      controller.index = saved.index;
      controller.position = Math.min(
        saved.positionMs,
        plan.items[saved.index]!.durationMs,
      );
      controller.active = saved.activeMs;
      controller.reminderRemaining = Math.min(
        saved.reminderRemainingMs,
        plan.items[saved.index]!.durationMs,
      );
      controller.completed = new Set(saved.completed);
      controller.usedReplacements = new Set(saved.usedReplacements);
      controller.muted = saved.muted !== false;
      controller.wants = false; // Relaunching never starts audible playback by itself.
      controller.publish();
      return controller;
    } catch {
      return null;
    }
  }
}

export function nextMedia(
  plan: SessionPlan,
  index: number,
): MediaItem | undefined {
  return plan.items
    .slice(index + 1)
    .find((item): item is MediaItem => item.kind === "media");
}
