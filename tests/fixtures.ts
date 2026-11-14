import { expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { SessionPlan, MediaItem } from "@mofied/contracts";

export const bytes = readFileSync(
  new URL("./assets/media.mp4", import.meta.url),
);
export const media = (id: string): MediaItem => ({
  kind: "media",
  id,
  mediaId: id,
  title: "أثر النية الصالحة في حياة المسلم والعمل النافع الذي يبقى أثره",
  pageUrl: "https://faqieh.com/ar/media/1",
  posterUrl: null,
  durationMs: 12_000,
  playback: {
    url: `https://media.example.test/${id}.mp4`,
    mimeType: "video/mp4",
  },
  speaker: {
    id: "speaker",
    name: "اسم المتحدث",
    pageUrl: "https://faqieh.com/ar/speakers/1",
    imageUrl: null,
  },
});
export const plan = (durationMs = 2000): SessionPlan => ({
  schemaVersion: 1,
  id: "browser-test",
  locale: "ar",
  policy: {
    maxActiveMs: 120_000,
    limitBehavior: "finish-current-item",
    maxConsecutiveFailures: 3,
  },
  items: [
    media("first"),
    {
      id: "reminder",
      kind: "reminder",
      durationMs,
      content: {
        kind: "text",
        body: "لحظة للتفكر والعمل بما تعلّمت.",
        citation: "الأحاديث ١٠–١٢",
        source: "Reminder text source",
      },
    },
    media("last"),
  ],
  replacements: [],
  ending: { title: "حان وقت التوقّف", body: "خذ لحظة للتفكر." },
});

export async function start(page: Page, session = plan()) {
  await page.route("**/__test/session", (route) =>
    route.fulfill({ json: session }),
  );
  await serveMp4(page);
  await page.goto("http://127.0.0.1:5173/?test-session=1");
  await expect(page.locator("main")).toHaveAttribute("data-status", "playing");
}
export async function finishMedia(page: Page) {
  await page.locator("video").evaluate((video: HTMLVideoElement) => {
    video.currentTime = video.duration - 0.12;
  });
}
export const position = (page: Page) =>
  page
    .locator("video")
    .evaluate((video: HTMLVideoElement) => video.currentTime);

export async function serveMp4(page: Page) {
  await page.route("https://media.example.test/**", (route) => {
    const range = /bytes=(\d+)-(\d*)/.exec(
      route.request().headers()["range"] ?? "",
    );
    const start = range ? Number(range[1]) : 0;
    const end = range?.[2]
      ? Math.min(Number(range[2]), bytes.length - 1)
      : bytes.length - 1;
    return route.fulfill({
      status: range ? 206 : 200,
      body: bytes.subarray(start, end + 1),
      contentType: "video/mp4",
      headers: {
        "access-control-allow-origin": "*",
        "access-control-expose-headers": "content-range",
        "accept-ranges": "bytes",
        ...(range
          ? { "content-range": `bytes ${start}-${end}/${bytes.length}` }
          : {}),
      },
    });
  });
}

/** Deterministic per-element audible permission. Real decoding still occurs.
 * Like Safari and Chrome on a first visit, sound needs a gesture on the element
 * and muted playback does not. A pointer release counts, as iOS treats touchend.
 * Desktop automation grants gestures more freely than iOS, so this deliberately
 * does not use navigator.userActivation as an oracle for an iPhone policy. */
export async function audiblePolicy(page: Page, { muted = true } = {}) {
  await page.addInitScript((allowMuted) => {
    const authorized = new WeakSet<HTMLMediaElement>();
    let gesture = false;
    for (const name of ["click", "keydown", "pointerup"])
      window.addEventListener(
        name,
        (event) => {
          gesture = event.isTrusted;
          // The gesture lasts for every listener of this event, including the
          // app's own window listeners, and ends once dispatch is over.
          setTimeout(() => {
            gesture = false;
          });
        },
        true,
      );
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (gesture) authorized.add(this);
      if ((!this.muted || !allowMuted) && !authorized.has(this))
        return Promise.reject(
          new DOMException("Tap this element to play sound", "NotAllowedError"),
        );
      return play.call(this);
    };
    // Unmuting inside a gesture also authorizes the element, as in WebKit.
    const muted = Object.getOwnPropertyDescriptor(
      HTMLMediaElement.prototype,
      "muted",
    )!;
    Object.defineProperty(HTMLMediaElement.prototype, "muted", {
      ...muted,
      set(value: boolean) {
        if (!value && gesture) authorized.add(this);
        muted.set!.call(this, value);
      },
    });
  }, muted);
}
