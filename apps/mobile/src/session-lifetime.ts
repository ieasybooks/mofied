import { SessionController } from "@mofied/session";
import { sharedStart, type SessionPlan } from "@mofied/contracts";

type AppStateSource = {
  currentState: string | null | undefined;
  addEventListener(
    event: "change",
    listener: (state: string) => void,
  ): { remove(): void };
};
/** React Native's Linking: the link that launched the app, then later ones. */
export type LinkSource = {
  getInitialURL(): Promise<string | null | undefined>;
  addEventListener(
    event: "url",
    listener: (event: { url: string }) => void,
  ): { remove(): void };
};

// iOS can report the launching link both as the initial URL and as an event.
const SAME_LINK_MS = 3000;

/**
 * One session per app launch. Going to the background pauses it and coming
 * back resumes it, however long the app was away. Inactive/blur alone
 * (Control Center, notification drawer) changes nothing. A shared media link
 * (https://mofied.com/?start=ID) opens a new session from that media, at
 * launch or while the app is running; a plain mofied.com link just brings the
 * app forward.
 */
export function watchSessions({
  appState,
  links,
  load,
  loading,
  accept,
  fail,
  now = Date.now,
}: {
  appState?: AppStateSource;
  links?: LinkSource;
  load: (signal: AbortSignal, start?: string) => Promise<SessionPlan>;
  loading: () => void;
  accept: (session: SessionController) => void;
  fail: (error: unknown) => void;
  now?: () => number;
}) {
  let disposed = false;
  let backgrounded = appState?.currentState === "background";
  let request: AbortController | undefined;
  let session: SessionController | undefined;
  let opened: { link?: string; at: number } | undefined;
  const open = (start?: string, link?: string) => {
    opened = { link, at: now() };
    request?.abort();
    // Stop accounting and release focus immediately, before React unmounts media.
    session?.setBackgrounded(true);
    session = undefined;
    const current = (request = new AbortController());
    loading();
    void load(current.signal, start).then(
      (plan) => {
        if (disposed || current.signal.aborted) return;
        session = new SessionController(plan);
        // A plan that arrives while the app is away waits, paused, for its return.
        if (backgrounded) session.setBackgrounded(true);
        accept(session);
      },
      (error: unknown) => {
        if (!disposed && !current.signal.aborted) fail(error);
      },
    );
  };
  const appSubscription = appState?.addEventListener("change", (state) => {
    if (disposed) return;
    if (state === "background" && !backgrounded) {
      backgrounded = true;
      session?.setBackgrounded(true);
    } else if (state === "active" && backgrounded) {
      backgrounded = false;
      session?.setBackgrounded(false);
    }
  });
  const linkSubscription = links?.addEventListener("url", ({ url }) => {
    if (disposed) return;
    const start = sharedStart(url);
    if (!start) return;
    if (opened?.link === url && now() - opened.at < SAME_LINK_MS) return;
    open(start, url);
  });
  if (!links) open();
  else
    void links.getInitialURL().then(
      (url) => {
        // A link event may already have opened the shared session.
        if (disposed || opened) return;
        open(sharedStart(url), url ?? undefined);
      },
      () => {
        if (!disposed && !opened) open();
      },
    );
  return () => {
    disposed = true;
    appSubscription?.remove();
    linkSubscription?.remove();
    request?.abort();
    session?.setBackgrounded(true);
  };
}
