import {
  forwardRef,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
  type ReactNode,
  type WheelEvent,
} from "react";
import type { SessionSnapshot } from "@mofied/session";
import {
  commitsPage,
  PAGE_SETTLE_MS,
  type SessionPager,
} from "@mofied/session";

export type PagerHandle = { wheel: (event: WheelEvent) => void };
export const PagedSession = forwardRef<
  PagerHandle,
  {
    pager: SessionPager;
    renderPage: (state: SessionSnapshot, preview: boolean) => ReactNode;
  }
>(function PagedSession({ pager, renderPage }, ref) {
  const state = useSyncExternalStore(pager.subscribe, pager.getSnapshot);
  const viewport = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const offset = useRef(0);
  const pointer = useRef<{
    id: number;
    x: number;
    y: number;
    lastY: number;
    at: number;
    velocity: number;
    dragging: boolean;
    rejected: boolean;
  } | null>(null);
  const wheelState = useRef({ total: 0, locked: false, timer: 0 });
  useLayoutEffect(pager.connect, [pager]);
  const height = () => viewport.current?.clientHeight || innerHeight;
  const move = (dy: number) => {
    const direction = dy < 0 ? 1 : -1;
    const available = pager.preview(direction);
    offset.current = available
      ? Math.max(-height(), Math.min(height(), dy))
      : Math.max(-70, Math.min(70, dy * 0.18));
    if (track.current)
      track.current.style.transform = `translate3d(0, ${offset.current}px, 0)`;
  };
  useImperativeHandle(ref, () => ({
    wheel(event) {
      if (
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.shiftKey ||
        Math.abs(event.deltaX) > Math.abs(event.deltaY) ||
        pager.session.getSnapshot().item?.kind !== "media" ||
        pager.session.getSnapshot().aboutOpen
      )
        return;
      const w = wheelState.current;
      clearTimeout(w.timer);
      w.timer = window.setTimeout(() => {
        if (pager.getSnapshot().phase === "dragging" && !pointer.current)
          pager.release(Math.abs(w.total) >= 60);
        w.locked = false;
        w.total = 0;
      }, 160);
      if (
        w.locked ||
        pointer.current ||
        pager.getSnapshot().phase === "settling"
      )
        return;
      if (pager.getSnapshot().phase === "idle" && !pager.begin()) return;
      w.total +=
        event.deltaY *
        (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? height() : 1);
      move(-w.total);
      if (Math.abs(w.total) >= 110) {
        w.locked = true;
        pager.release(true);
      }
    },
  }));
  useLayoutEffect(() => {
    const node = track.current!;
    if (state.phase === "idle") {
      node.style.transition = "none";
      node.style.transform = "translate3d(0, 0, 0)";
      offset.current = 0;
      pointer.current = null;
      return;
    }
    if (state.phase !== "settling") return;
    if (
      document.hidden ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      pager.finish(state.revision);
      return;
    }
    // Flush the starting drag/automatic position before starting the snap.
    node.getBoundingClientRect();
    node.style.transition = `transform ${PAGE_SETTLE_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`;
    node.style.transform = `translate3d(0, ${state.commit ? -state.direction * height() : 0}px, 0)`;
    const done = () => pager.finish(state.revision);
    const timer = window.setTimeout(done, PAGE_SETTLE_MS + 40);
    const hidden = () => {
      if (document.hidden) done();
    };
    document.addEventListener("visibilitychange", hidden);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [pager, state.phase, state.revision]);
  useLayoutEffect(() => {
    const resize = () => pager.cancel();
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      clearTimeout(wheelState.current.timer);
    };
  }, [pager]);
  return (
    <div
      className="session-pages"
      ref={viewport}
      data-phase={state.phase}
      onPointerDown={(event) => {
        if (
          !(event.target instanceof Element) ||
          !event.target.closest(".media-tap") ||
          state.phase !== "idle"
        )
          return;
        if (pointer.current || !event.isPrimary || event.button !== 0) {
          pager.cancel();
          pointer.current = null;
          return;
        }
        pointer.current = {
          id: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          lastY: event.clientY,
          at: event.timeStamp,
          velocity: 0,
          dragging: false,
          rejected: false,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        const p = pointer.current;
        if (!p || p.id !== event.pointerId || p.rejected) return;
        const dy = event.clientY - p.y,
          dx = event.clientX - p.x;
        if (!p.dragging && Math.max(Math.abs(dx), Math.abs(dy)) > 8) {
          if (Math.abs(dy) <= Math.abs(dx) * 1.2) {
            p.rejected = true;
            return;
          }
          p.dragging = pager.begin();
        }
        const elapsed = event.timeStamp - p.at;
        if (elapsed > 0) p.velocity = (event.clientY - p.lastY) / elapsed;
        p.at = event.timeStamp;
        p.lastY = event.clientY;
        if (p.dragging) move(dy);
      }}
      onPointerUp={(event) => {
        const p = pointer.current;
        pointer.current = null;
        if (!p || p.id !== event.pointerId) return;
        const dy = event.clientY - p.y,
          dx = event.clientX - p.x;
        if (p.dragging)
          pager.release(
            commitsPage(
              dy,
              event.timeStamp - p.at > 100 ? 0 : p.velocity,
              height(),
            ),
          );
        else if (!p.rejected && Math.abs(dy) < 12 && Math.abs(dx) < 12)
          pager.session.togglePlayback();
      }}
      onPointerCancel={() => {
        pointer.current = null;
        pager.release(false);
      }}
      onLostPointerCapture={() => {
        if (pointer.current?.dragging) pager.release(false);
        pointer.current = null;
      }}
    >
      <div
        className="page-track"
        ref={track}
        data-moving={state.phase !== "idle"}
      >
        <div
          className={`session-page ${state.page.item?.kind ?? "ending"}`}
          key={state.page.item?.id ?? "ending"}
          data-page="current"
        >
          {renderPage(state.page, false)}
        </div>
        {state.neighbor && (
          <div
            className={`session-page ${state.neighbor.item?.kind ?? "ending"}`}
            style={{ top: `${state.direction * 100}%` }}
            data-page="preview"
            aria-hidden
            inert
          >
            {renderPage(state.neighbor, true)}
          </div>
        )}
      </div>
    </div>
  );
});
