import type { SessionController, SessionSnapshot } from "./index";

export type Direction = -1 | 1;
export type PagingSnapshot = Readonly<{
  page: SessionSnapshot;
  neighbor: SessionSnapshot | null;
  direction: Direction;
  phase: "idle" | "dragging" | "settling";
  commit: boolean;
  automatic: boolean;
  revision: number;
}>;

const identity = (state: SessionSnapshot) =>
  `${state.index}:${state.item?.id ?? "ending"}`;
export const PAGE_SETTLE_MS = 280;

/** Shared distance/velocity policy; velocity is in pixels per millisecond. */
export function commitsPage(
  distance: number,
  velocity: number,
  extent: number,
) {
  return (
    Math.abs(distance) >= Math.min(140, extent * 0.22) ||
    (Math.abs(distance) >= 24 &&
      Math.abs(velocity) >= 0.5 &&
      Math.sign(distance) === Math.sign(velocity))
  );
}

/** Coordinates presentation only. The session remains the authority on order/time. */
export class SessionPager {
  private value: PagingSnapshot;
  private listeners = new Set<() => void>();
  private changing = false;
  constructor(readonly session: SessionController) {
    this.value = {
      page: session.getSnapshot(),
      neighbor: null,
      direction: 1,
      phase: "idle",
      commit: false,
      automatic: false,
      revision: 0,
    };
  }
  getSnapshot = () => this.value;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(value: Partial<PagingSnapshot>) {
    this.value = { ...this.value, ...value };
    for (const listener of this.listeners) listener();
  }
  connect = () => {
    const stop = this.session.subscribe(this.reconcile);
    this.reconcile();
    return () => {
      stop();
      this.cancel();
    };
  };
  private reconcile = () => {
    if (this.changing) return;
    const live = this.session.getSnapshot();
    if (live.aboutOpen || live.backgrounded || live.interrupted) {
      if (this.value.phase !== "idle") this.cancel();
      this.publish({ page: this.session.getSnapshot() });
      return;
    }
    if (identity(live) !== identity(this.value.page)) {
      if (
        this.value.automatic &&
        this.value.neighbor &&
        identity(live) === identity(this.value.neighbor)
      ) {
        this.publish({ neighbor: live });
        return;
      }
      this.changing = true;
      this.session.setNavigating(true);
      this.changing = false;
      this.publish({
        page: { ...this.value.page, shouldPlay: false, navigating: true },
        neighbor: this.session.getSnapshot(),
        direction: live.index < this.value.page.index ? -1 : 1,
        phase: "settling",
        commit: true,
        automatic: true,
        revision: this.value.revision + 1,
      });
    } else this.publish({ page: live });
  };
  begin = () => {
    const live = this.session.getSnapshot();
    if (
      this.value.phase !== "idle" ||
      live.item?.kind !== "media" ||
      live.aboutOpen ||
      live.backgrounded
    )
      return false;
    this.changing = true;
    this.session.setNavigating(true);
    this.changing = false;
    this.publish({
      page: this.session.getSnapshot(),
      phase: "dragging",
      automatic: false,
      commit: false,
    });
    return true;
  };
  preview = (direction: Direction) => {
    if (this.value.phase !== "dragging") return false;
    const target = this.session.navigationTarget(direction);
    const live = this.session.getSnapshot();
    const neighbor = target
      ? {
          ...live,
          ...target,
          positionMs: 0,
          shouldPlay: false,
          navigating: true,
          reminderRemainingMs:
            target.item?.kind === "reminder" ? target.item.durationMs : 0,
          status: target.item ? ("paused" as const) : ("ended" as const),
          retryRequired: false,
        }
      : null;
    if (
      direction !== this.value.direction ||
      identity(neighbor ?? live) !== identity(this.value.neighbor ?? live)
    )
      this.publish({ direction, neighbor });
    return !!neighbor;
  };
  release = (commit: boolean) => {
    if (this.value.phase !== "dragging") return;
    this.publish({
      phase: "settling",
      commit: commit && !!this.value.neighbor,
      revision: this.value.revision + 1,
    });
  };
  navigate = (direction: Direction) => {
    if (!this.begin()) return;
    this.preview(direction);
    this.release(true);
  };
  finish = (revision: number) => {
    if (revision !== this.value.revision || this.value.phase !== "settling")
      return;
    this.changing = true;
    if (this.value.commit && !this.value.automatic) {
      if (this.value.direction === 1) this.session.next();
      else this.session.previous();
    }
    this.session.setNavigating(false);
    this.changing = false;
    this.publish({
      page: this.session.getSnapshot(),
      neighbor: null,
      phase: "idle",
      commit: false,
      automatic: false,
    });
  };
  cancel = () => {
    this.changing = true;
    this.session.setNavigating(false);
    this.changing = false;
    this.publish({
      page: this.session.getSnapshot(),
      neighbor: null,
      phase: "idle",
      commit: false,
      automatic: false,
      revision: this.value.revision + 1,
    });
  };
}
