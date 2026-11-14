import { SessionController } from "@mofied/session";
import type { SessionPlan } from "@mofied/contracts";

type AppStateSource = {
  currentState: string | null | undefined;
  addEventListener(
    event: "change",
    listener: (state: string) => void,
  ): { remove(): void };
};

/**
 * One session per app launch. Going to the background pauses it and coming
 * back resumes it, however long the app was away. Inactive/blur alone
 * (Control Center, notification drawer) changes nothing.
 */
export function watchSessions({
  appState,
  load,
  loading,
  accept,
  fail,
}: {
  appState?: AppStateSource;
  load: (signal: AbortSignal) => Promise<SessionPlan>;
  loading: () => void;
  accept: (session: SessionController) => void;
  fail: (error: unknown) => void;
}) {
  let disposed = false;
  let backgrounded = appState?.currentState === "background";
  const request = new AbortController();
  let session: SessionController | undefined;
  loading();
  void load(request.signal).then(
    (plan) => {
      if (disposed) return;
      session = new SessionController(plan);
      // A plan that arrives while the app is away waits, paused, for its return.
      if (backgrounded) session.setBackgrounded(true);
      accept(session);
    },
    (error: unknown) => {
      if (!disposed) fail(error);
    },
  );
  const subscription = appState?.addEventListener("change", (state) => {
    if (disposed) return;
    if (state === "background" && !backgrounded) {
      backgrounded = true;
      session?.setBackgrounded(true);
    } else if (state === "active" && backgrounded) {
      backgrounded = false;
      session?.setBackgrounded(false);
    }
  });
  return () => {
    disposed = true;
    subscription?.remove();
    request.abort();
    // Stop accounting and release focus immediately, before React unmounts media.
    session?.setBackgrounded(true);
  };
}
