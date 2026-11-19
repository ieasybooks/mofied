export const colors = {
  background: "#0A0A0A",
  surface: "#151515",
  text: "#F5F5F5",
  secondary: "#B8B8B8",
  border: "#2B2B2B",
} as const;
export const typography = {
  title: "Thmanyah",
  ui: "NotoNaskhUI",
  quran: "Kitab",
  latin: "Gilroy",
} as const;
export type Locale = "ar" | "en";
const ar = {
  name: "مفيد",
  info: "عن التطبيق",
  privacy: "سياسة الخصوصية",
  support: "التواصل والدعم",
  language: "اللغة",
  version: "الإصدار",
  resume: "متابعة المشاهدة",
  close: "إغلاق",
  pausedAbout: "توقّف التشغيل مؤقتًا",
  resumeNote: "تعود إلى المادة من حيث توقّفت",
  pause: "إيقاف مؤقت",
  play: "تشغيل",
  next: "المادة التالية",
  previous: "المادة السابقة",
  soundOn: "تشغيل الصوت",
  soundOff: "كتم الصوت",
  tapToUnmute: "اضغط لتشغيل الصوت",
  share: "مشاركة المادة",
  linkCopied: "تم نسخ الرابط",
  copyFailed: "تعذّر نسخ الرابط",
  watchInApp: "شاهد في تطبيق مفيد",
  openApp: "فتح",
  navigate: "للتنقّل",
  pauseHint: "للإيقاف",
  loading: "جارٍ تحميل المادة",
  starting: "جارٍ فتح مفيد",
  buffering: "جارٍ التحميل",
  loadError: "تعذّر تحميل الجلسة",
  mediaError: "تعذّر تشغيل المادة",
  connection: "تحقّق من اتصالك ثم أعد المحاولة.",
  retry: "إعادة المحاولة",
  autoplay: "اضغط لبدء المشاهدة",
  quran: "من القرآن الكريم",
  reflection: "تذكير",
  pauseRead: "أوقف العدّ لمواصلة القراءة",
  resumeRead: "متابعة العدّ",
  back: "رجوع",
  aboutBody: "مفيد مساحة لمواد نافعة وجلسات محدودة، تتخلّلها لحظات للتفكر.",
  privacyBody:
    "لا يتطلّب مفيد حسابًا. تبدأ جلسة جديدة عند فتح التطبيق أو تحديث الصفحة، ولا يُحفظ تقدم الجلسة. تُحمّل المواد والصور من خوادم الوسائط، وقد تسجّل هذه الخوادم معلومات الاتصال المعتادة. لا يتضمّن هذا الإصدار أدوات إعلانية أو تحليلات.",
  supportBody: "مفيد من تطوير الكتب المُيسّرة. يمكنكم التواصل معنا عبر:",
  offline: "الاتصال غير متاح حاليًا",
  linkError: "تعذّر فتح الرابط",
  linkErrorBody: "تأكّد من وجود تطبيق مناسب لفتح الرابط، ثم أعد المحاولة.",
  finishingMedia: "حتى نهاية المادة",
  finishingReminder: "حتى نهاية التذكير",
} as const;
const en: Record<keyof typeof ar, string> = {
  name: "Mofied",
  info: "About Mofied",
  privacy: "Privacy policy",
  support: "Contact & support",
  language: "Language",
  version: "Version",
  resume: "Continue watching",
  close: "Close",
  pausedAbout: "Playback is paused",
  resumeNote: "Return to the same media and position",
  pause: "Pause",
  play: "Play",
  next: "Next media",
  previous: "Previous media",
  soundOn: "Enable sound",
  soundOff: "Mute sound",
  tapToUnmute: "Tap to unmute",
  share: "Share media",
  linkCopied: "Link copied",
  copyFailed: "Could not copy the link",
  watchInApp: "Watch in the Mofied app",
  openApp: "Open",
  navigate: "Navigate",
  pauseHint: "Pause",
  loading: "Loading media",
  starting: "Opening Mofied",
  buffering: "Buffering",
  loadError: "Could not load the session",
  mediaError: "Could not play this media",
  connection: "Check your connection and try again.",
  retry: "Try again",
  autoplay: "Tap to start watching",
  quran: "From the Quran",
  reflection: "Reminder",
  pauseRead: "Pause the countdown to read",
  resumeRead: "Resume countdown",
  back: "Back",
  aboutBody:
    "Mofied offers useful media in finite sessions, with moments to reflect.",
  privacyBody:
    "Mofied does not require an account. A new session starts when you open the app or refresh the page. Session progress is not saved. Media and images load from media servers, which may record ordinary connection information. This version has no advertising or analytics tools.",
  supportBody: "Mofied is developed by EasyBooks. You can contact us through:",
  offline: "You are currently offline",
  linkError: "Could not open the link",
  linkErrorBody:
    "Make sure an app is available to open this link, then try again.",
  finishingMedia: "Finishing media",
  finishingReminder: "Finishing reminder",
};
export const copy = { ar, en };
const numberFormatters = {
  ar: new Intl.NumberFormat("ar-u-nu-arab"),
  en: new Intl.NumberFormat("en"),
};
function arabicCount(
  value: number,
  forms: { one: string; two: string; few: string; other: string },
) {
  // Callers supply rounded, nonnegative integers. Arabic cardinal rules use
  // singular/dual only for exactly 1/2; the few form applies to 3–10 modulo 100.
  // Keep this independent of Intl.PluralRules, which native Hermes lacks.
  if (value === 1) return forms.one;
  if (value === 2) return forms.two;
  const remainder = value % 100;
  return `${numberFormatters.ar.format(value)} ${remainder >= 3 && remainder <= 10 ? forms.few : forms.other}`;
}

export function formatTime(milliseconds: number) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
export function remainingLabel(
  ms: number,
  locale: Locale,
  itemKind?: "media" | "reminder",
) {
  if (ms <= 0 && itemKind)
    return itemKind === "media"
      ? copy[locale].finishingMedia
      : copy[locale].finishingReminder;
  const minutes = Math.ceil(Math.max(0, ms) / 60_000);
  if (locale === "en")
    return `${numberFormatters.en.format(minutes)} ${minutes === 1 ? "minute" : "minutes"} left`;
  if (minutes === 0) return "لم يتبقّ وقت";
  return `بقيت ${arabicCount(minutes, {
    one: "دقيقة واحدة",
    two: "دقيقتان",
    few: "دقائق",
    other: "دقيقة",
  })}`;
}
export function countdownLabel(ms: number, locale: Locale) {
  const seconds = Math.ceil(Math.max(0, ms) / 1000);
  if (seconds === 0)
    return locale === "ar" ? "تُستأنف المواد الآن" : "Media resumes now";
  if (locale === "en")
    return `Media resumes in ${numberFormatters.en.format(seconds)} ${seconds === 1 ? "second" : "seconds"}`;
  return `تُستأنف المواد بعد ${arabicCount(seconds, {
    one: "ثانية واحدة",
    two: "ثانيتين",
    few: "ثوانٍ",
    other: "ثانية",
  })}`;
}

/** Keep numeric citation ranges in their supplied order inside RTL text. */
export function formatCitation(citation: string) {
  return citation.replace(
    /[0-9٠-٩۰-۹]+(?:\s*[-–—]\s*[0-9٠-٩۰-۹]+)+/g,
    // Arabic-Indic digits resolve a neutral hyphen as RTL even inside an LTR
    // isolate. Direction marks around the separator preserve the range order.
    (range) =>
      `\u2066${range.replace(/\s*[-–—]\s*/g, "\u200E - \u200E")}\u2069`,
  );
}
export { contactLinks } from "./contact";
