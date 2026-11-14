import {
  useEffect,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  Info,
  ChevronUp,
  ChevronDown,
  Volume2,
  VolumeX,
  Clock3,
  BookOpen,
  Pause,
  Play,
  Share,
  X,
} from "lucide-react";
import { SessionController, type SessionSnapshot } from "@mofied/session";
import { SessionPager } from "@mofied/session";
import { PagedSession, type PagerHandle } from "./SessionPager";
import {
  parseStart,
  sessionLoadDiagnostic,
  shareLink,
  type MediaItem,
} from "@mofied/contracts";
import {
  copy,
  remainingLabel,
  countdownLabel,
  formatCitation,
  type Locale,
} from "@mofied/design";
import logo from "@mofied/design/assets/icons/icon-white.svg";
import { loadSession } from "./provider";
import { MediaPlayer, type MediaHandle } from "./MediaPlayer";
import { About } from "./About";
import { LaunchArtwork } from "./LaunchArtwork";
import { appRoute } from "./app-banner";

const subscribeWithoutSession = () => () => {};

/** A share link (https://mofied.com/?start=ID) opens the session from that media. */
function sharedStartFromAddress() {
  return parseStart(new URLSearchParams(location.search).get("start"));
}
/** Once the shared session is open, a refresh behaves like any other refresh. */
function dropSharedStartFromAddress() {
  const url = new URL(location.href);
  if (!url.searchParams.has("start")) return;
  url.searchParams.delete("start");
  history.replaceState(history.state, "", url.pathname + url.search + url.hash);
}

export function App() {
  const [session, setSession] = useState<SessionController | null>(null);
  const hasPlayback = useSyncExternalStore(
    session?.subscribe ?? subscribeWithoutSession,
    () => !!session?.getSnapshot().item,
    () => !!session?.getSnapshot().item,
  );
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [locale, setLocale] = useState<Locale>("ar");
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  }, [locale]);
  const [aboutOpen, setAboutOpen] = useState(false);
  const aboutOpenRef = useRef(false);
  const sharedStart = useRef(sharedStartFromAddress());
  // Open in the app was pressed before the session arrived.
  const leftForApp = useRef(false);
  // Decided once per visit, from the address as it was opened.
  const [banner, setBanner] = useState(() =>
    appRoute({
      userAgent: navigator.userAgent,
      maxTouchPoints: navigator.maxTouchPoints,
      standalone:
        matchMedia("(display-mode: standalone)").matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true,
      start: sharedStart.current,
    }),
  );
  useLayoutEffect(() => {
    document.documentElement.toggleAttribute("data-app-banner", !!banner);
  }, [banner]);
  const showAbout = (open: boolean) => {
    aboutOpenRef.current = open;
    setAboutOpen(open);
    if (open) session?.openAbout();
    else session?.closeAbout();
  };
  useEffect(() => {
    // Sessions live only in memory; a back/forward-cache return loads anew.
    const reopen = (event: PageTransitionEvent) => {
      if (event.persisted) setAttempt((value) => value + 1);
    };
    window.addEventListener("pageshow", reopen);
    return () => window.removeEventListener("pageshow", reopen);
  }, []);
  useEffect(() => {
    const abort = new AbortController();
    setError(false);
    setSession(null);
    const accept = (next: SessionController) => {
      if (abort.signal.aborted) return;
      if (aboutOpenRef.current) next.openAbout();
      if (leftForApp.current) next.pause();
      leftForApp.current = false;
      // Retries keep the shared media until a session has actually opened.
      sharedStart.current = undefined;
      dropSharedStartFromAddress();
      setSession(next);
    };
    void loadSession(abort.signal, sharedStart.current)
      .then((plan) => accept(new SessionController(plan)))
      .catch((error: unknown) => {
        if (!abort.signal.aborted) {
          console.warn(
            "[mofied] Session load failed",
            sessionLoadDiagnostic(error),
          );
          setError(true);
        }
      });
    return () => abort.abort();
  }, [attempt]);
  return (
    <>
      {banner && (
        <AppBanner
          href={banner}
          locale={locale}
          // Leaving for the app or its store page pauses the web session.
          open={() => {
            if (session) session.pause();
            else leftForApp.current = true;
          }}
          // Hidden for this visit only; nothing is stored.
          dismiss={() => setBanner(null)}
        />
      )}
      {session ? (
        <SessionView
          session={session}
          locale={locale}
          openAbout={() => showAbout(true)}
        />
      ) : (
        <main className="startup" dir={locale === "ar" ? "rtl" : "ltr"}>
          {!error && <LaunchArtwork locale={locale} />}
          <header className="session-header">
            <button
              type="button"
              className="info-button round-button"
              aria-label={copy[locale].info}
              onClick={() => showAbout(true)}
            >
              <Info size={21} />
            </button>
          </header>
          {error && (
            <>
              <img src={logo} alt={copy[locale].name} />
              <h1>{copy[locale].loadError}</h1>
              <p>{copy[locale].connection}</p>
              <button
                className="text-button"
                onClick={() => setAttempt((value) => value + 1)}
              >
                {copy[locale].retry}
              </button>
            </>
          )}
        </main>
      )}
      {aboutOpen && (
        <About
          locale={locale}
          setLocale={setLocale}
          close={() => showAbout(false)}
          hasPlayback={hasPlayback}
        />
      )}
    </>
  );
}

function AppBanner({
  href,
  locale,
  open,
  dismiss,
}: {
  href: string;
  locale: Locale;
  open: () => void;
  dismiss: () => void;
}) {
  const t = copy[locale];
  return (
    <aside className="app-banner" aria-label={t.watchInApp}>
      <button
        type="button"
        className="app-banner-close"
        aria-label={t.close}
        onClick={dismiss}
      >
        <X size={18} />
      </button>
      <img src="/icons/icon-192.png" alt="" width={40} height={40} />
      <p>
        <strong>{t.name}</strong>
        <span>{t.watchInApp}</span>
      </p>
      <a className="app-banner-open" href={href} onClick={open}>
        {t.openApp}
      </a>
    </aside>
  );
}

function SessionView({
  session,
  locale,
  openAbout,
}: {
  session: SessionController;
  locale: Locale;
  openAbout: () => void;
}) {
  const pager = useMemo(() => new SessionPager(session), [session]);
  const paging = useSyncExternalStore(pager.subscribe, pager.getSnapshot);
  const state = paging.page;
  const pagerRef = useRef<PagerHandle>(null);
  const mediaRef = useRef<MediaHandle>(null);
  const togglePlayback = useCallback(() => {
    session.togglePlayback();
    // Keep audible play inside the actual click/touch/keyboard handler on iOS.
    mediaRef.current?.synchronize();
  }, [session]);
  const toggleMuted = () => {
    session.toggleMuted();
    mediaRef.current?.synchronize();
  };
  const [notice, setNotice] = useState<{ text: string; id: number } | null>(
    null,
  );
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 2500);
    return () => clearTimeout(timer);
  }, [notice]);
  const share = (media: MediaItem) =>
    void shareMedia(media, (text) => setNotice({ text, id: Date.now() }), t);
  // Any tap, swipe or key on media brings back sound the browser withheld.
  // Unmuting inside the gesture itself is what lets iOS play it audibly.
  const restoredSound = useRef(false);
  const restoreSound = useCallback(() => {
    if (!session.restoreSound()) return;
    restoredSound.current = true;
    mediaRef.current?.synchronize();
  }, [session]);
  const noteGesture = (event: React.SyntheticEvent) => {
    if (
      !(event.target instanceof Element) ||
      !event.target.closest("[data-sound-control]")
    )
      restoreSound();
  };
  // A tap that brings sound back does not also pause, as on Faqieh's Shorts.
  const tapPlayer = useCallback(() => {
    const restored = restoredSound.current;
    restoredSound.current = false;
    const live = session.getSnapshot();
    if (restored && live.wantsToPlay && live.status !== "autoplay-blocked")
      return;
    togglePlayback();
  }, [session, togglePlayback]);
  const t = copy[locale];
  const item = state.item;
  useEffect(() => {
    const interval = setInterval(session.tick, 100);
    // Deliberately no visibilitychange / blur pause listener: hidden tabs continue.
    return () => {
      clearInterval(interval);
    };
  }, [session]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (
        state.aboutOpen ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.defaultPrevented ||
        (event.target instanceof Element &&
          event.target.closest(
            'dialog, [data-reading-region], input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]',
          ))
      )
        return;
      // Space on a sound button activates that button, which brings withheld
      // sound back itself; restoring here first would let its click mute again.
      if (
        event.code === "ArrowUp" ||
        event.code === "ArrowDown" ||
        (event.code === "Space" &&
          !(
            event.target instanceof Element &&
            event.target.closest("[data-sound-control]")
          ))
      )
        restoreSound();
      if (event.code === "Space") {
        // Buttons/links retain their normal Space/Enter activation; arrow
        // navigation remains available after ordinary clicks and keyboard focus.
        if (
          event.target instanceof Element &&
          event.target.closest('button, a, [role="button"]')
        )
          return;
        event.preventDefault();
        togglePlayback();
      }
      if (item?.kind === "media" && event.code === "ArrowDown") {
        event.preventDefault();
        pager.navigate(1);
      }
      if (item?.kind === "media" && event.code === "ArrowUp") {
        event.preventDefault();
        pager.navigate(-1);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [
    session,
    pager,
    state.aboutOpen,
    item?.kind,
    togglePlayback,
    restoreSound,
  ]);
  return (
    <>
      <main
        className={`session-view ${item?.kind ?? "ending"}`}
        data-status={state.status}
        data-session-id={state.sessionId}
        data-active-ms={state.activeMs}
        data-item-id={item?.id ?? "ended"}
        data-sound-withheld={state.soundWithheld || undefined}
        onWheel={(event) => pagerRef.current?.wheel(event)}
        onPointerDownCapture={() => {
          restoredSound.current = false;
        }}
        onPointerUpCapture={noteGesture}
        onKeyDownCapture={(event) => {
          restoredSound.current = false;
          noteGesture(event);
        }}
        onClickCapture={noteGesture}
      >
        <header className="session-header">
          <div className="header-controls">
            <button
              type="button"
              className="info-button round-button"
              aria-label={t.info}
              onClick={openAbout}
            >
              <Info size={21} />
            </button>
            {item?.kind === "media" && (
              <button
                type="button"
                className="mobile-sound round-button"
                data-sound-control
                aria-label={state.muted ? t.soundOn : t.soundOff}
                onClick={toggleMuted}
              >
                {state.muted ? <VolumeX size={21} /> : <Volume2 size={21} />}
              </button>
            )}
            {item?.kind === "media" && (
              <button
                type="button"
                className="mobile-share round-button"
                aria-label={t.share}
                onClick={() => share(item)}
              >
                <Share size={20} />
              </button>
            )}
          </div>
          <div className="brand-budget">
            <img className="header-mark" src={logo} alt={t.name} />
            {item && (
              <div className="budget">
                <Clock3 className="budget-clock" size={16} />
                <span dir={locale === "ar" ? "rtl" : "ltr"}>
                  {remainingLabel(state.remainingMs, locale, item.kind)}
                </span>
                <div className="budget-line">
                  <i
                    style={{
                      width: `${Math.max(0, (state.remainingMs / session.plan.policy.maxActiveMs) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </header>
        <PagedSession
          ref={pagerRef}
          pager={pager}
          togglePlayback={tapPlayer}
          renderPage={(page, preview) => (
            <SessionPage
              session={session}
              state={page}
              locale={locale}
              preview={preview}
              mediaRef={preview ? undefined : mediaRef}
              togglePlayback={togglePlayback}
              tapPlayer={tapPlayer}
            />
          )}
        />
        {item?.kind === "media" && (
          <aside className="control-rail" aria-label={t.navigate}>
            <button
              className="round-button"
              aria-label={t.previous}
              disabled={!state.canPrevious}
              onClick={() => pager.navigate(-1)}
            >
              <ChevronUp size={22} />
            </button>
            <button
              className="round-button"
              aria-label={t.next}
              onClick={() => pager.navigate(1)}
            >
              <ChevronDown size={22} />
            </button>
            <div className="rail-divider" />
            <button
              className="round-button rail-sound"
              data-sound-control
              aria-label={state.muted ? t.soundOn : t.soundOff}
              onClick={toggleMuted}
            >
              {state.muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>
            <button
              className="round-button rail-share"
              aria-label={t.share}
              onClick={() => share(item)}
            >
              <Share size={19} />
            </button>
          </aside>
        )}
        {notice && (
          <p key={notice.id} className="share-notice" role="status">
            {notice.text}
          </p>
        )}
        {item && (
          <div className="keyboard-hint" aria-hidden="true">
            {item.kind === "media" && (
              <>
                <kbd>↑</kbd>
                <kbd>↓</kbd>
                <span>{t.navigate}</span>
                <span>·</span>
              </>
            )}
            <kbd>Space</kbd>
            <span>{t.pauseHint}</span>
          </div>
        )}
      </main>
    </>
  );
}

function SessionPage({
  session,
  state,
  locale,
  preview,
  mediaRef,
  togglePlayback,
  tapPlayer,
}: {
  session: SessionController;
  state: SessionSnapshot;
  locale: Locale;
  preview: boolean;
  mediaRef?: React.Ref<MediaHandle>;
  togglePlayback: () => void;
  tapPlayer: () => void;
}) {
  const item = state.item;
  const t = copy[locale];
  return (
    <>
      {/* The current video stays mounted through media, reminders and ending.
          Reading regions still reset by item identity below. */}
      <MediaPlayer
        ref={mediaRef}
        item={item?.kind === "media" ? item : null}
        session={session}
        state={state}
        locale={locale}
        preview={preview}
        togglePlayback={togglePlayback}
        tapPlayer={tapPlayer}
      />
      {item?.kind === "reminder" && (
        <section
          key={item.id}
          className="player-frame text-frame"
          aria-label={t.reflection}
        >
          <div
            className="reminder-body"
            tabIndex={0}
            data-reading-region
            role="region"
            aria-label={t.reflection}
          >
            <div className="reminder-copy">
              <div className="reminder-kind">
                <BookOpen size={18} />
                <span>
                  {item.content.kind === "quran" ? t.quran : t.reflection}
                </span>
              </div>
              <p
                dir={
                  item.content.kind === "quran" || session.plan.locale === "ar"
                    ? "rtl"
                    : "ltr"
                }
                lang={
                  item.content.kind === "quran" ? "ar" : session.plan.locale
                }
                className={
                  item.content.kind === "quran" ? "verses" : "reminder-text"
                }
              >
                {item.content.body}
              </p>
              <div className="text-rule" />
              <p
                className="citation"
                dir={session.plan.locale === "ar" ? "rtl" : "ltr"}
              >
                {formatCitation(item.content.citation)}
              </p>
            </div>
          </div>
          <div className="reminder-bottom">
            <p>{countdownLabel(state.reminderRemainingMs, locale)}</p>
            <div
              className="countdown-line"
              role="progressbar"
              aria-label={t.reflection}
              aria-valuenow={Math.ceil(state.reminderRemainingMs / 1000)}
              aria-valuemin={0}
              aria-valuemax={Math.ceil(item.durationMs / 1000)}
              aria-valuetext={countdownLabel(state.reminderRemainingMs, locale)}
            >
              <i
                style={{
                  width: `${(state.reminderRemainingMs / item.durationMs) * 100}%`,
                }}
              />
            </div>
            <button
              type="button"
              className="reading-button"
              onClick={session.togglePlayback}
            >
              {state.wantsToPlay ? <Pause size={18} /> : <Play size={18} />}
              <span>{state.wantsToPlay ? t.pauseRead : t.resumeRead}</span>
            </button>
          </div>
        </section>
      )}
      {!item && (
        <section
          className="player-frame text-frame ending-frame"
          aria-labelledby={preview ? "preview-ending-title" : "ending-title"}
        >
          <div
            className="ending-body"
            data-reading-region
            tabIndex={0}
            role="region"
            aria-labelledby={preview ? "preview-ending-title" : "ending-title"}
            lang={session.plan.locale}
            dir={session.plan.locale === "ar" ? "rtl" : "ltr"}
          >
            <div className="ending-copy">
              <img className="ending-mark" src={logo} alt="" />
              <h1 id={preview ? "preview-ending-title" : "ending-title"}>
                {state.ending.title}
              </h1>
              <div className="text-rule" />
              <p>{state.ending.body}</p>
            </div>
          </div>
        </section>
      )}
    </>
  );
}

/**
 * The system share sheet where the browser has one; otherwise copy the link.
 * The title and link travel as one text, as on Faqieh, so every destination,
 * including Copy, gets both. A dismissed share sheet is not an error.
 */
async function shareMedia(
  media: MediaItem,
  notify: (text: string) => void,
  t: (typeof copy)[Locale],
) {
  const url = shareLink(media.mediaId);
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ text: `${media.title}\n${url}` });
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    notify(t.linkCopied);
  } catch {
    notify(t.copyFailed);
  }
}
