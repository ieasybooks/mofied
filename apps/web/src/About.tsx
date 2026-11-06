import { useEffect, useRef, useState } from "react";
import {
  X,
  Info,
  Shield,
  Mail,
  Globe,
  ChevronLeft,
  ChevronRight,
  Play,
} from "lucide-react";
import { appVersion, copy, type Locale } from "@mofied/design";
import appIcon from "@mofied/design/assets/icons/app-icon-flat-dark-1024.png";
import { ContactLinks } from "./ContactLinks";

type Page = "info" | "privacy" | "support";
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
  const [page, setPage] = useState<Page | null>(null);
  const t = copy[locale];
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const rows = [
    [Info, "info"],
    [Shield, "privacy"],
    [Mail, "support"],
  ] as const;
  const bodies = {
    info: t.aboutBody,
    privacy: t.privacyBody,
    support: t.supportBody,
  };
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
          <h2 id="about-title">{page ? t[page] : t.name}</h2>
          {hasPlayback && <p>{t.pausedAbout}</p>}
        </div>
      </div>
      {page ? (
        <div className="about-content">
          <p>{bodies[page]}</p>
          {page === "support" && <ContactLinks locale={locale} />}
          <button
            type="button"
            className="text-button"
            onClick={() => setPage(null)}
          >
            {t.back}
          </button>
        </div>
      ) : (
        <div className="about-rows">
          {rows.map(([Icon, key]) => (
            <button
              type="button"
              className="about-row"
              key={key}
              onClick={() => setPage(key)}
            >
              <span className="row-lead">
                <Icon size={20} />
                <span>{t[key]}</span>
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
      )}
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
