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
  sources: "المصادر والتراخيص",
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
  swipe: "اسحب للمادة التالية",
  navigate: "للتنقّل",
  pauseHint: "للإيقاف",
  loading: "جارٍ تحميل المادة",
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
  textSource: "نص المصحف: Tanzil",
  back: "رجوع",
  aboutBody: "مفيد مساحة لمواد نافعة وجلسات محدودة، تتخلّلها لحظات للتأمّل.",
  privacyBody:
    "لا يتطلّب مفيد حسابًا. يُحفظ موضع الجلسة وتفضيل الصوت محليًا على جهازك. تُحمّل المواد والصور من خوادم الوسائط، وقد تسجّل هذه الخوادم معلومات الاتصال المعتادة. لا يتضمّن هذا الإصدار أدوات إعلانية أو تحليلات.",
  supportBody: "يمكنك الإبلاغ عن مشكلة أو اقتراح تحسين من صفحة دعم المشروع.",
  sourcesBody:
    "المواد وروابط المتحدثين من فقيه. نص القرآن من Tanzil. يعتمد التطبيق على برمجيات مفتوحة المصدر، منها React وExpo وhls.js وLucide.",
  offline: "الاتصال غير متاح حاليًا",
} as const;
const en: Record<keyof typeof ar, string> = {
  name: "Mofied",
  info: "About Mofied",
  privacy: "Privacy policy",
  support: "Contact & support",
  sources: "Sources & licenses",
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
  swipe: "Swipe for the next media",
  navigate: "Navigate",
  pauseHint: "Pause",
  loading: "Loading media",
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
  textSource: "Quran text: Tanzil",
  back: "Back",
  aboutBody:
    "Mofied offers useful media in finite sessions, with moments to reflect.",
  privacyBody:
    "Mofied does not require an account. Session progress and sound preferences are saved locally on your device. Media and images load from media servers, which may record ordinary connection information. This version has no advertising or analytics tools.",
  supportBody:
    "Report a problem or suggest an improvement through the project support page.",
  sourcesBody:
    "Media and speaker links come from Faqieh. Quran text comes from Tanzil. The app uses open-source software including React, Expo, hls.js and Lucide.",
  offline: "You are currently offline",
};
export const copy = { ar, en };
export function formatTime(milliseconds: number) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
export function remainingLabel(ms: number, locale: Locale) {
  const minutes = Math.ceil(Math.max(0, ms) / 60_000);
  const number = new Intl.NumberFormat(
    locale === "ar" ? "ar-u-nu-arab" : "en",
  ).format(minutes);
  return locale === "ar" ? `بقي ${number} دقيقة` : `${number} min left`;
}
export function countdownLabel(ms: number, locale: Locale) {
  const seconds = new Intl.NumberFormat(
    locale === "ar" ? "ar-u-nu-arab" : "en",
  ).format(Math.ceil(Math.max(0, ms) / 1000));
  return locale === "ar"
    ? `تُستأنف المواد بعد ${seconds} ثوانٍ`
    : `Media resumes in ${seconds}s`;
}
