import {
  parseSession,
  type MediaItem,
  type SessionPlan,
  type SessionProvider,
} from "@mofied/contracts";
import publicMedia from "./public-media.json";

const media: MediaItem[] = publicMedia.map((item) => ({
  kind: "media",
  id: `media-${item.id}`,
  mediaId: String(item.id),
  title: item.title,
  pageUrl: `https://faqieh.com/ar/media/${item.id}`,
  posterUrl: item.thumbnail,
  durationMs: item.duration * 1000,
  playback: {
    url: item.playlistUrl,
    mimeType: "application/vnd.apple.mpegurl",
  },
  speaker: {
    id: String(item.speaker.id),
    name: item.speaker.name,
    pageUrl: `https://faqieh.com${item.speaker.url}`,
    imageUrl: item.speaker.image,
  },
}));

export type FixtureName =
  "normal" | "long-title" | "missing-portrait" | "unavailable";
/** `start` mirrors Rails: a known shared media opens the plan. */
export function fixture(
  name: FixtureName = "normal",
  start?: string,
): SessionPlan {
  const shared = media.find((item) => item.mediaId === start);
  const first = structuredClone(
    shared ?? (name === "normal" ? media[1]! : media[0]!),
  );
  if (name === "missing-portrait") first.speaker.imageUrl = null;
  if (name === "unavailable")
    first.playback.url = "https://media.invalid/unavailable.m3u8";
  const last = first.mediaId === media[4]!.mediaId ? media[1]! : media[4]!;
  return parseSession({
    schemaVersion: 1,
    id: `development-${name}-v1`,
    locale: "ar",
    policy: {
      maxActiveMs: 600_000,
      limitBehavior: "finish-current-item",
      maxConsecutiveFailures: 3,
    },
    items: [
      first,
      {
        id: "reminder-ash-sharh",
        kind: "reminder",
        durationMs: 20_000,
        content: {
          kind: "quran",
          body: "فَإِذَا فَرَغْتَ فَٱنصَبْ ﴿٧﴾\nوَإِلَىٰ رَبِّكَ فَٱرْغَب ﴿٨﴾",
          citation: "سورة الشرح، الآيتان ٧ - ٨",
          source: "Tanzil",
        },
      },
      last,
    ],
    replacements: [{ ...media[2]!, id: `replacement-${media[2]!.mediaId}` }],
    ending: {
      title: "حان وقت التوقّف",
      body: "خذ لحظةً للتفكر، ثم اعمل بشيء مما تعلّمته؛ بصلاة، أو مساعدة أحد، أو نشر فائدة.",
    },
  });
}
export function createFixtureProvider(
  name: FixtureName = "normal",
): SessionProvider {
  return {
    async load(signal) {
      signal?.throwIfAborted();
      return fixture(name);
    },
  };
}
