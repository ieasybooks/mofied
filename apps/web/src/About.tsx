import { useEffect, useRef, useState } from "react";
import {
  X,
  Info,
  Shield,
  FileText,
  Mail,
  Globe,
  ChevronLeft,
  ChevronRight,
  Play,
} from "lucide-react";
import { copy, pages, type Locale, type PageId } from "@mofied/design";
import { version as appVersion } from "../package.json";
import appIcon from "@mofied/design/assets/icons/app-icon-flat-dark-1024.png";
import { SlidePages } from "./SlidePages";
import { PageText } from "./PageText";

export function About({
  locale,
  setLocale,
  close,
  hasPlayback,
}: {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  close: () => void;
  hasPlayback: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [page, setPage] = useState<PageId | null>(null);
  const [detailPage, setDetailPage] = useState<PageId>("about");
  const changedPage = useRef(false);
  const content = useRef<HTMLDivElement>(null);
  const navigate = (next: PageId | null) => {
    changedPage.current = true;
    if (next) setDetailPage(next);
    setPage(next);
    // A page opened from a link further down another starts at its top.
    dialog.current?.scrollTo({ top: 0 });
  };
  useEffect(() => {
    if (!changedPage.current) return;
    const timer = window.setTimeout(
      () => {
        const target = page
          ? content.current?.querySelector<HTMLButtonElement>(
              ".about-content button",
            )
          : content.current?.querySelector<HTMLButtonElement>(
              `[data-about-page="${detailPage}"]`,
            );
        target?.focus({ preventScroll: true });
      },
      matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 290,
    );
    return () => clearTimeout(timer);
  }, [page, detailPage]);
  const t = copy[locale];
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const rows = [
    [Info, "about"],
    [Shield, "privacy"],
    [FileText, "terms"],
    [Mail, "support"],
  ] as const;
  return (
    <dialog
      ref={dialog}
      className="about-dialog"
      dir={locale === "ar" ? "rtl" : "ltr"}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target === dialog.current) {
          const bounds = dialog.current.getBoundingClientRect();
          if (
            event.clientX < bounds.left ||
            event.clientX > bounds.right ||
            event.clientY < bounds.top ||
            event.clientY > bounds.bottom
          )
            close();
        }
      }}
      aria-labelledby="about-title"
    >
      <div className="sheet-handle" />
      <button
        type="button"
        className="close-about round-button"
        aria-label={t.close}
        onClick={close}
      >
        <X size={20} />
      </button>
      <div className="about-heading">
        <img src={appIcon} alt="" />
        <div>
          <h2 id="about-title">{page ? pages[locale][page].title : t.name}</h2>
          {hasPlayback && <p>{t.pausedAbout}</p>}
        </div>
      </div>
      <div ref={content}>
        <SlidePages
          detail={!!page}
          rtl={locale === "ar"}
          main={
            <div className="about-rows">
              {rows.map(([Icon, key]) => (
                <button
                  type="button"
                  className="about-row"
                  key={key}
                  data-about-page={key}
                  onClick={() => navigate(key)}
                >
                  <span className="row-lead">
                    <Icon size={20} />
                    <span>{pages[locale][key].title}</span>
                  </span>
                  {locale === "ar" ? (
                    <ChevronLeft size={18} />
                  ) : (
                    <ChevronRight size={18} />
                  )}
                </button>
              ))}
              <button
                type="button"
                className="about-row"
                onClick={() => setLocale(locale === "ar" ? "en" : "ar")}
              >
                <span className="row-lead">
                  <Globe size={20} />
                  <span>{t.language}</span>
                </span>
                <span className="row-trail">
                  <bdi>{locale === "ar" ? "العربية" : "English"}</bdi>
                  {locale === "ar" ? (
                    <ChevronLeft size={18} />
                  ) : (
                    <ChevronRight size={18} />
                  )}
                </span>
              </button>
            </div>
          }
        >
          <div className="about-content">
            <PageText
              page={pages[locale][detailPage]}
              locale={locale}
              open={navigate}
            />
            <button
              type="button"
              className="text-button"
              onClick={() => navigate(null)}
            >
              {t.back}
            </button>
          </div>
        </SlidePages>
      </div>
      <p className="version">
        {t.version} <bdi>{appVersion}</bdi>
      </p>
      {hasPlayback && (
        <>
          <button type="button" className="resume-button" onClick={close}>
            <Play size={18} />
            <span>{t.resume}</span>
          </button>
          <p className="resume-note">{t.resumeNote}</p>
        </>
      )}
    </dialog>
  );
}
