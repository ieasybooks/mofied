import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { SessionPlan, MediaItem } from "@mofied/contracts";
import { realBrowser } from "./real-browser";

const bytes = readFileSync(new URL("./assets/media.mp4", import.meta.url));
const media = (id: string): MediaItem => ({
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
const plan = (durationMs = 2000): SessionPlan => ({
  schemaVersion: 1,
  id: "browser-test",
  locale: "ar",
  expiresAt: null,
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
        body: "لحظة للتأمّل والعمل بما تعلّمت.",
        citation: "تذكير",
        source: "",
      },
    },
    media("last"),
  ],
  replacements: [],
  ending: { title: "حان وقت التوقّف", body: "خذ لحظة للتأمّل." },
});

async function start(page: Page, session = plan()) {
  await page.route("**/__test/session", (route) =>
    route.fulfill({ json: session }),
  );
  await page.route("https://media.example.test/**", (route) =>
    route.fulfill({
      body: bytes,
      contentType: "video/mp4",
      headers: { "access-control-allow-origin": "*", "accept-ranges": "bytes" },
    }),
  );
  await page.goto("http://127.0.0.1:5173/?test-session=1");
  await expect(page.locator("main")).toHaveAttribute("data-status", "playing");
}
async function finishMedia(page: Page) {
  await page.locator("video").evaluate((video: HTMLVideoElement) => {
    video.currentTime = video.duration - 0.12;
  });
}
const position = (page: Page) =>
  page
    .locator("video")
    .evaluate((video: HTMLVideoElement) => video.currentTime);

test("opens directly into playback; About pauses and restores the same position and manual pause intent", async ({
  page,
}) => {
  await start(page);
  await expect(page.getByText("من مكتبة فقيه")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "عن التطبيق", exact: true }),
  ).toHaveText("");
  await expect(page.locator(".media-title a")).toHaveAttribute(
    "target",
    "_blank",
  );
  await expect(page.locator(".speaker")).toHaveAttribute(
    "href",
    "https://faqieh.com/ar/speakers/1",
  );
  await page.getByRole("button", { name: "عن التطبيق", exact: true }).click();
  const pausedAt = await position(page);
  await page.waitForTimeout(700);
  expect(await position(page)).toBeCloseTo(pausedAt, 1);
  await page
    .getByRole("button", { name: "سياسة الخصوصية", exact: true })
    .click();
  await expect(page.getByText(/لا يتطلّب مفيد حسابًا/)).toBeVisible();
  await page
    .getByRole("button", { name: "متابعة المشاهدة", exact: true })
    .click();
  await expect(page.locator("main")).toHaveAttribute("data-status", "playing");
  await page.locator(".media-tap").click();
  await expect(page.locator("main")).toHaveAttribute("data-status", "paused");
  await page.getByRole("button", { name: "عن التطبيق", exact: true }).click();
  await page.getByRole("button", { name: "إغلاق", exact: true }).click();
  await expect(page.locator("main")).toHaveAttribute("data-status", "paused");
});

test("media ends into the ordered reminder, which cannot be skipped; ends quietly after the last media", async ({
  page,
}) => {
  await start(page, plan(3000));
  await finishMedia(page);
  await expect(page.locator("main")).toHaveAttribute(
    "data-item-id",
    "reminder",
  );
  await expect(
    page.getByRole("button", { name: "المادة التالية", exact: true }),
  ).toHaveCount(0);
  await page.keyboard.press("ArrowDown");
  await expect(page.locator("main")).toHaveAttribute(
    "data-item-id",
    "reminder",
  );
  await page
    .getByRole("button", { name: "أوقف العدّ لمواصلة القراءة", exact: true })
    .click();
  const remaining = await page
    .getByRole("progressbar")
    .getAttribute("aria-valuenow");
  await page.waitForTimeout(900);
  expect(
    await page.getByRole("progressbar").getAttribute("aria-valuenow"),
  ).toBe(remaining);
  await page.getByRole("button", { name: "متابعة العدّ", exact: true }).click();
  await expect(page.locator("main")).toHaveAttribute("data-item-id", "last");
  await expect(page.locator("main")).toHaveAttribute("data-status", "playing");
  await finishMedia(page);
  await expect(
    page.getByRole("heading", { name: "حان وقت التوقّف" }),
  ).toBeVisible();
  await expect(page.getByRole("button")).toHaveCount(1);
  await expect(page.locator("video")).toHaveCount(0);
  await page.getByRole("button", { name: "عن التطبيق", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "متابعة المشاهدة", exact: true }),
  ).toHaveCount(0);
});

test("continues actual media playback and reminder-to-media transitions in a hidden browser tab after sound activation", async () => {
  const browser = await realBrowser();
  const context = browser.context;
  const page = await context.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  try {
    await start(page, plan(1200));
    await page
      .getByRole("button", { name: "تشغيل الصوت", exact: true })
      .click();
    const before = await position(page);
    const other = await context.newPage();
    await other.goto("about:blank");
    await other.bringToFront();
    await expect
      .poll(() => page.evaluate(() => document.visibilityState))
      .toBe("hidden");
    await page.waitForTimeout(1200);
    expect(await position(page)).toBeGreaterThan(before + 0.5);
    // Dispatch a normal keyboard navigation while the page is hidden: its ordered
    // reminder must run on wall time, then start the next real video without focus.
    await page.evaluate(() =>
      window.dispatchEvent(
        new KeyboardEvent("keydown", { code: "ArrowDown", bubbles: true }),
      ),
    );
    await expect(page.locator("main")).toHaveAttribute(
      "data-item-id",
      "reminder",
    );
    await expect(page.locator("main")).toHaveAttribute("data-item-id", "last");
    await expect(page.locator("main")).toHaveAttribute(
      "data-status",
      "playing",
    );
    await expect.poll(() => position(page)).toBeGreaterThan(0.2);
    await other.close();
  } finally {
    await browser.close();
  }
});

test("unavailable media uses the supplied spare once, without changing the following reminder", async ({
  page,
}) => {
  const session = plan();
  session.items[0] = {
    ...media("missing"),
    playback: {
      url: "https://broken.example.test/404.mp4",
      mimeType: "video/mp4",
    },
  };
  session.replacements = [media("spare")];
  await page.route("https://broken.example.test/**", (route) =>
    route.fulfill({ status: 404, body: "" }),
  );
  await start(page, session);
  await expect(page.locator("main")).toHaveAttribute("data-item-id", "spare");
  await page
    .getByRole("button", { name: "المادة التالية", exact: true })
    .click();
  await expect(page.locator("main")).toHaveAttribute(
    "data-item-id",
    "reminder",
  );
});

test("failed session responses show an error instead of silently playing fixtures", async ({
  page,
}) => {
  let mediaRequests = 0;
  page.on("request", (request) => {
    if (request.url().includes("shorts.faqieh.com")) mediaRequests++;
  });
  await page.route("**/__test/session", (route) =>
    route.fulfill({ status: 503, body: "" }),
  );
  await page.goto("/?test-session=1");
  await expect(
    page.getByRole("heading", { name: "تعذّر تحميل الجلسة" }),
  ).toBeVisible();
  expect(mediaRequests).toBe(0);
  await expect(page.locator("video")).toHaveCount(0);
  await page.getByRole("button", { name: "عن التطبيق", exact: true }).click();
  await page
    .getByRole("button", { name: "سياسة الخصوصية", exact: true })
    .click();
  await expect(page.getByText(/لا يتطلّب مفيد حسابًا/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "متابعة المشاهدة", exact: true }),
  ).toHaveCount(0);
});

test("mobile browser layout clamps titles, supports swiping and has no extra transport toolbar", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await start(page, plan(5000));
  expect(
    await page
      .locator(".media-title a")
      .evaluate((element) => getComputedStyle(element).webkitLineClamp),
  ).toBe("2");
  await expect(page.locator(".control-rail")).toBeHidden();
  await page.mouse.move(180, 540);
  await page.mouse.down();
  await page.mouse.move(180, 240, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator("main")).toHaveAttribute(
    "data-item-id",
    "reminder",
  );
  const overflowing = await page.evaluate(
    () => document.documentElement.scrollWidth > innerWidth,
  );
  expect(overflowing).toBe(false);
});
