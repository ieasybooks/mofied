import {
  useEffect,
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
} from "lucide-react";
import { SessionController, type SessionSnapshot } from "@mofied/session";
import { SessionPager } from "@mofied/session";
import { PagedSession, type PagerHandle } from "./SessionPager";
import { sessionLoadDiagnostic } from "@mofied/contracts";
import {
  copy,
  remainingLabel,
  countdownLabel,
  formatCitation,
  type Locale,
} from "@mofied/design";
import logo from "@mofied/design/assets/icons/icon-white.svg";
import {
  loadSession,
  sessionStorageKey as storageKey,
  usesFixture,
} from "./provider";
import { MediaPlayer } from "./MediaPlayer";
import { About } from "./About";

const subscribeWithoutSession = () => () => {};
function storageRead() {
  try {
    return sessionStorage.getItem(storageKey);
  } catch {
    return null;
  }
}
function storageWrite(value: string | null) {
  try {
    if (value) sessionStorage.setItem(storageKey, value);
    else sessionStorage.removeItem(storageKey);
  } catch {
    /* Storage can be disabled. Playback remains available. */
  }
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
  const showAbout = (open: boolean) => {
    aboutOpenRef.current = open;
    setAboutOpen(open);
    if (open) session?.openAbout();
    else session?.closeAbout();
  };
  useEffect(() => {
    const abort = new AbortController();
    setError(false);
    const saved = usesFixture ? null : storageRead();
    const restored = saved ? SessionController.restore(saved) : null;
    const accept = (next: SessionController) => {
      if (abort.signal.aborted) return;
      if (aboutOpenRef.current) next.openAbout();
      setSession(next);
    };
    if (restored) {
      accept(restored);
      return () => abort.abort();
    }
    void loadSession(abort.signal)
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
      {session ? (
        <SessionView
          session={session}
          locale={locale}
          openAbout={() => showAbout(true)}
        />
      ) : (
        <main className="startup" dir={locale === "ar" ? "rtl" : "ltr"}>
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
          <img src={logo} alt={copy[locale].name} />
          {error ? (
            <>
              <h1>{copy[locale].loadError}</h1>
              <p>{copy[locale].connection}</p>
              <button
                className="text-button"
                onClick={() => setAttempt((value) => value + 1)}
              >
                {copy[locale].retry}
              </button>
            </>
          ) : (
            <div
              className="loader"
              role="status"
              aria-label={copy[locale].loading}
            />
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
  const t = copy[locale];
  const item = state.item;
  useEffect(() => {
    const interval = setInterval(session.tick, 100);
    const save = () => storageWrite(session.serialize());
    const persistence = setInterval(save, 1500);
    window.addEventListener("pagehide", save);
    // Deliberately no visibilitychange / blur pause listener: hidden tabs continue.
    return () => {
      clearInterval(interval);
      clearInterval(persistence);
      window.removeEventListener("pagehide", save);
      save();
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
      if (event.code === "Space") {
        // Buttons/links retain their normal Space/Enter activation; arrow
        // navigation remains available after ordinary clicks and keyboard focus.
        if (
          event.target instanceof Element &&
          event.target.closest('button, a, [role="button"]')
        )
          return;
        event.preventDefault();
        session.togglePlayback();
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
  }, [session, pager, state.aboutOpen, item?.kind]);
  useEffect(() => {
    if (state.status === "ended") storageWrite(null);
  }, [state.status]);
  return (
    <>
      <main
        className={`session-view ${item?.kind ?? "ending"}`}
        data-status={state.status}
        data-item-id={item?.id ?? "ended"}
        onWheel={(event) => pagerRef.current?.wheel(event)}
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
                aria-label={state.muted ? t.soundOn : t.soundOff}
                onClick={session.toggleMuted}
              >
                {state.muted ? <VolumeX size={21} /> : <Volume2 size={21} />}
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
          renderPage={(page, preview) => (
            <SessionPage
              session={session}
              state={page}
              locale={locale}
              preview={preview}
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
              className="round-button"
              aria-label={state.muted ? t.soundOn : t.soundOff}
              onClick={session.toggleMuted}
            >
              {state.muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>
            {state.muted && <p>{t.soundOn}</p>}
          </aside>
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
}: {
  session: SessionController;
  state: SessionSnapshot;
  locale: Locale;
  preview: boolean;
}) {
  const item = state.item;
  const t = copy[locale];
  return (
    <>
      {item?.kind === "media" && (
        <>
          <MediaPlayer
            key={item.id}
            item={item}
            session={session}
            state={state}
            locale={locale}
            preview={preview}
          />
        </>
      )}
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
