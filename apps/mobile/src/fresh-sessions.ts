import { SessionController } from "@mofied/session";
import type { SessionPlan } from "@mofied/contracts";

type AppStateSource = {
  currentState: string | null | undefined;
  addEventListener(
    event: "change",
    listener: (state: string) => void,
  ): { remove(): void };
};

/** One request per app opening. Inactive/blur alone is not an opening. */
export function watchFreshSessions({
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
  let request: AbortController | undefined;
  let session: SessionController | undefined;
  const discard = () => {
    request?.abort();
    // Stop accounting and release focus immediately, before React unmounts media.
    session?.setBackgrounded(true);
    session = undefined;
  };
  const open = () => {
    discard();
    const current = (request = new AbortController());
    loading();
    void load(current.signal).then(
      (plan) => {
        if (disposed || current.signal.aborted) return;
        session = new SessionController(plan);
        accept(session);
      },
      (error: unknown) => {
        if (!disposed && !current.signal.aborted) fail(error);
      },
    );
  };
  const subscription = appState?.addEventListener("change", (state) => {
    if (disposed) return;
    if (state === "background" && !backgrounded) {
      backgrounded = true;
      discard();
      loading();
    } else if (state === "active" && backgrounded) {
      backgrounded = false;
      open();
    }
  });
  if (!backgrounded) open();
  else loading();
  return () => {
    disposed = true;
    subscription?.remove();
    discard();
  };
}
