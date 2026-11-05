import { useEffect, useRef, useState, useSyncExternalStore } from "react";
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
import { SessionController } from "@mofied/session";
import {
  copy,
  remainingLabel,
  countdownLabel,
  formatCitation,
  type Locale,
} from "@mofied/design";
import logo from "@mofied/design/assets/icons/icon-white.svg";
import { loadSession } from "./provider";
import { MediaPlayer } from "./MediaPlayer";
import { About } from "./About";

const storageKey = `mofied.session.v1.${import.meta.env.DEV ? "development" : "production"}`;
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
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [locale, setLocale] = useState<Locale>("ar");
  const [startupInfo, setStartupInfo] = useState(false);
  const startupInfoRef = useRef(false);
  const showStartupInfo = (open: boolean) => {
    startupInfoRef.current = open;
    setStartupInfo(open);
  };
  useEffect(() => {
    const abort = new AbortController();
    setError(false);
    // A fixture query intentionally starts a fresh fixture for development checks.
    const saved = !location.search ? storageRead() : null;
    const restored = saved ? SessionController.restore(saved) : null;
    const accept = (next: SessionController) => {
      if (abort.signal.aborted) return;
      if (startupInfoRef.current) next.openAbout();
      setSession(next);
    };
    if (restored) {
      accept(restored);
      return () => abort.abort();
    }
    void loadSession(abort.signal)
      .then((plan) => accept(new SessionController(plan)))
      .catch(() => {
        if (!abort.signal.aborted) setError(true);
      });
    return () => abort.abort();
  }, [attempt]);
  if (!session)
    return (
      <>
        <main className="startup" dir={locale === "ar" ? "rtl" : "ltr"}>
          <header className="session-header">
            <button
              type="button"
              className="info-button round-button"
              aria-label={copy[locale].info}
              onClick={() => showStartupInfo(true)}
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
        {startupInfo && (
          <About
            locale={locale}
            setLocale={setLocale}
            close={() => showStartupInfo(false)}
            hasPlayback={false}
          />
        )}
      </>
    );
  return (
    <SessionView session={session} locale={locale} setLocale={setLocale} />
  );
}

function SessionView({
  session,
  locale,
  setLocale,
}: {
  session: SessionController;
  locale: Locale;
  setLocale: (locale: Locale) => void;
}) {
  const state = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  const lastWheel = useRef(0);
  const t = copy[locale];
  const item = state.item;
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  }, [locale]);
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
        event.target instanceof HTMLButtonElement ||
        event.target instanceof HTMLAnchorElement
      )
        return;
      if (event.code === "Space") {
        event.preventDefault();
        session.togglePlayback();
      }
      if (event.code === "ArrowDown") {
        event.preventDefault();
        session.next();
      }
      if (event.code === "ArrowUp") {
        event.preventDefault();
        session.previous();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [session, state.aboutOpen]);
  useEffect(() => {
    if (state.status === "ended") storageWrite(null);
  }, [state.status]);
  return (
    <>
      <main
        className={`session-view ${item?.kind ?? "ending"}`}
        data-status={state.status}
        data-item-id={item?.id ?? "ended"}
        onWheel={(event) => {
          if (
            state.aboutOpen ||
            Math.abs(event.deltaY) < 45 ||
            Date.now() - lastWheel.current < 700
          )
            return;
          lastWheel.current = Date.now();
          if (event.deltaY > 0) session.next();
          else session.previous();
        }}
      >
        <header className="session-header">
          <div className="header-controls">
            <button
              type="button"
              className="info-button round-button"
              aria-label={t.info}
              onClick={session.openAbout}
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
                <span>{remainingLabel(state.remainingMs, locale)}</span>
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
        {item?.kind === "media" && (
          <>
            <MediaPlayer
              key={item.id}
              item={item}
              session={session}
              state={state}
              locale={locale}
            />
            <aside className="control-rail" aria-label={t.navigate}>
              <button
                className="round-button"
                aria-label={t.previous}
                disabled={!state.canPrevious}
                onClick={session.previous}
              >
                <ChevronUp size={22} />
              </button>
              <button
                className="round-button"
                aria-label={t.next}
                onClick={session.next}
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
          </>
        )}
        {item?.kind === "reminder" && (
          <section
            className="player-frame text-frame"
            aria-label={t.reflection}
          >
            <div className="reminder-body">
              <div className="reminder-kind">
                <BookOpen size={18} />
                <span>
                  {item.content.kind === "quran" ? t.quran : t.reflection}
                </span>
              </div>
              <p
                dir="rtl"
                className={
                  item.content.kind === "quran" ? "verses" : "reminder-text"
                }
              >
                {item.content.body}
              </p>
              <div className="text-rule" />
              <p className="citation" dir="rtl">
                {formatCitation(item.content.citation)}
              </p>
            </div>
            <div className="reminder-bottom">
              <p>{countdownLabel(state.reminderRemainingMs, locale)}</p>
              <div
                className="countdown-line"
                role="progressbar"
                aria-label={t.reflection}
                aria-valuenow={Math.ceil(state.reminderRemainingMs / 1000)}
                aria-valuemin={0}
                aria-valuemax={item.durationMs / 1000}
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
            aria-labelledby="ending-title"
          >
            <img className="ending-mark" src={logo} alt="" />
            <h1 id="ending-title" dir="rtl">
              {state.ending.title}
            </h1>
            <div className="text-rule" />
            <p dir="rtl">{state.ending.body}</p>
          </section>
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
      {state.aboutOpen && (
        <About
          locale={locale}
          setLocale={setLocale}
          close={session.closeAbout}
          hasPlayback={!!item}
        />
      )}
    </>
  );
}
