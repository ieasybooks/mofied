import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { bytes, media, plan, position, serveMp4 } from "./fixtures";

const current = (page: Page) => page.locator('[data-page="current"]');
const cover = (page: Page) => current(page).locator(".media-cover");
const poster = (id: string) => `https://posters.example.test/${id}.svg`;

async function setup(page: Page, ids = ["first", "second", "third"]) {
  await page.setViewportSize({ width: 390, height: 844 });
  const session = plan();
  session.items = ids.map((id) => ({ ...media(id), posterUrl: poster(id) }));
  await page.route("**/__test/session", (route) =>
    route.fulfill({ json: session }),
  );
  await page.route("https://posters.example.test/**", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      headers: { "cache-control": "public, max-age=3600" },
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="390" height="844"><rect width="390" height="844" fill="#804020"/></svg>',
    }),
  );
  await serveMp4(page);
  return session;
}

test("swipe retains the incoming poster while media is delayed, until its first frame", async ({
  page,
}) => {
  await setup(page);
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("https://media.example.test/second.mp4", async (route) => {
    await pending;
    await route.fulfill({
      body: bytes,
      contentType: "video/mp4",
      headers: { "access-control-allow-origin": "*" },
    });
  });
  const posterRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().startsWith("https://posters.example.test"))
      posterRequests.push(request.url());
  });
  try {
    await page.goto("/?test-session=1");
    await expect.poll(() => position(page)).toBeGreaterThan(0.2);
    await expect
      .poll(() => posterRequests.includes(poster("second")))
      .toBe(true);
    expect(posterRequests).not.toContain(poster("third"));
    const video = await page.locator("video").elementHandle();
    await page.mouse.move(180, 500);
    await page.mouse.down();
    await page.mouse.move(180, 200, { steps: 8 });
    await expect(
      page.locator('[data-page="preview"] .media-poster'),
    ).toHaveAttribute("src", poster("second"));
    await page.mouse.up();
    await expect(page.locator("main")).toHaveAttribute(
      "data-item-id",
      "second",
    );
    await expect(page.locator(".session-pages")).toHaveAttribute(
      "data-phase",
      "idle",
    );
    await expect(cover(page)).toBeVisible();
    await expect(cover(page).locator("img")).toHaveAttribute(
      "src",
      poster("second"),
    );
    await expect
      .poll(() =>
        cover(page)
          .locator("img")
          .evaluate((img: HTMLImageElement) => img.naturalWidth),
      )
      .toBeGreaterThan(0);
    await page.waitForTimeout(400);
    await expect(cover(page)).toBeVisible();
    await page.screenshot({
      path: "artifacts/poster-loading/delayed-poster.png",
    });
    release();
    await expect.poll(() => position(page)).toBeGreaterThan(0.2);
    await expect(cover(page)).toHaveCount(0);
    expect(
      await video!.evaluate(
        (element) => element === document.querySelector("video"),
      ),
    ).toBe(true);
    expect(posterRequests).toContain(poster("second"));
  } finally {
    release();
  }
});

type FrameGate = { queued: string[]; release: (id: string) => void };
async function holdFrameNotifications(page: Page) {
  await page.addInitScript(() => {
    const native = HTMLVideoElement.prototype.requestVideoFrameCallback;
    const pending = new Map<string, () => void>();
    const gate: FrameGate = {
      queued: [],
      release: (id) => pending.get(id)?.(),
    };
    Object.assign(window, { frameGate: gate });
    HTMLVideoElement.prototype.requestVideoFrameCallback = function (callback) {
      return native.call(this, (now, metadata) => {
        const id = document.querySelector("main")?.dataset.itemId ?? "";
        gate.queued.push(id);
        // Retain even a cancelled callback so the stale-generation path is
        // exercised deliberately. Actual media decoding/presentation continues.
        pending.set(id, () => callback(now, metadata));
      });
    };
  });
}
async function queued(page: Page, id: string) {
  await expect
    .poll(() =>
      page.evaluate(
        (id) =>
          (
            window as unknown as { frameGate: FrameGate }
          ).frameGate.queued.includes(id),
        id,
      ),
    )
    .toBe(true);
}
async function releaseFrame(page: Page, id: string) {
  await page.evaluate(
    (id) =>
      (window as unknown as { frameGate: FrameGate }).frameGate.release(id),
    id,
  );
}
async function next(page: Page, id: string) {
  await page.keyboard.press("ArrowDown");
  await expect(page.locator("main")).toHaveAttribute("data-item-id", id);
  await expect(page.locator(".session-pages")).toHaveAttribute(
    "data-phase",
    "idle",
  );
}

test("metadata and playing do not uncover video before its presentation callback", async ({
  page,
}) => {
  await holdFrameNotifications(page);
  await setup(page);
  await page.goto("/?test-session=1");
  await queued(page, "first");
  await expect.poll(() => position(page)).toBeGreaterThan(0.2);
  await expect(cover(page)).toBeVisible();
  await releaseFrame(page, "first");
  await expect(cover(page)).toHaveCount(0);
});

test("late frames from two previous shorts cannot remove the current poster", async ({
  page,
}) => {
  await holdFrameNotifications(page);
  await setup(page);
  await page.goto("/?test-session=1");
  await queued(page, "first");
  const video = await page.locator("video").elementHandle();
  await next(page, "second");
  await queued(page, "second");
  await next(page, "third");
  await queued(page, "third");
  for (const id of ["first", "second"]) {
    await releaseFrame(page, id);
    await expect(cover(page).locator("img")).toHaveAttribute(
      "src",
      poster("third"),
    );
  }
  await releaseFrame(page, "third");
  await expect(cover(page)).toHaveCount(0);
  expect(
    await video!.evaluate(
      (element) => element === document.querySelector("video"),
    ),
  ).toBe(true);
});

test("returning to the last presented short requires a new frame before uncovering it", async ({
  page,
}) => {
  await holdFrameNotifications(page);
  await setup(page);
  await page.goto("/?test-session=1");
  await queued(page, "first");
  await releaseFrame(page, "first");
  await expect(cover(page)).toHaveCount(0);
  await next(page, "second");
  await queued(page, "second");
  await page.keyboard.press("ArrowUp");
  await expect(page.locator("main")).toHaveAttribute("data-item-id", "first");
  await expect(page.locator(".session-pages")).toHaveAttribute(
    "data-phase",
    "idle",
  );
  await expect(cover(page).locator("img")).toHaveAttribute(
    "src",
    poster("first"),
  );
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as unknown as { frameGate: FrameGate }
          ).frameGate.queued.filter((id) => id === "first").length,
      ),
    )
    .toBe(2);
  await releaseFrame(page, "first");
  await expect(cover(page)).toHaveCount(0);
});

test("poster loading preserves manual pause and Info, then reveals resumed playback", async ({
  page,
}) => {
  await setup(page);
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("https://media.example.test/first.mp4", async (route) => {
    await pending;
    await route.fulfill({
      body: bytes,
      contentType: "video/mp4",
      headers: { "access-control-allow-origin": "*" },
    });
  });
  try {
    await page.goto("/?test-session=1");
    await expect(cover(page).locator("img")).toBeVisible();
    await page.locator(".media-tap").click();
    await page.locator(".info-button").click();
    await page.locator('[data-about-page="privacy"]').click();
    release();
    await expect
      .poll(() =>
        page.locator("video").evaluate((v: HTMLVideoElement) => v.readyState),
      )
      .toBeGreaterThanOrEqual(2);
    await expect(page.locator("video")).toHaveJSProperty("paused", true);
    expect(await position(page)).toBe(0);
    await page.locator(".about-content .text-button").click();
    await page.locator(".close-about").click();
    await expect(page.locator("video")).toHaveJSProperty("paused", true);
    await page.locator(".media-tap").click();
    await expect.poll(() => position(page)).toBeGreaterThan(0.2);
    await expect(cover(page)).toHaveCount(0);
  } finally {
    release();
  }
});

test("a failed poster stays nonfatal and the next item's poster is not hidden", async ({
  page,
}) => {
  await holdFrameNotifications(page);
  await setup(page);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route(poster("first"), (route) => route.abort());
  await page.goto("/?test-session=1");
  await queued(page, "first");
  await expect(cover(page).locator("img")).toHaveCount(0);
  await expect(cover(page).locator(".preview-placeholder")).toBeVisible();
  await expect.poll(() => position(page)).toBeGreaterThan(0.2);
  await releaseFrame(page, "first");
  await expect(cover(page)).toHaveCount(0);
  await next(page, "second");
  await queued(page, "second");
  await expect(cover(page).locator("img")).toHaveAttribute(
    "src",
    poster("second"),
  );
  await expect
    .poll(() =>
      cover(page)
        .locator("img")
        .evaluate((img: HTMLImageElement) => img.naturalWidth),
    )
    .toBeGreaterThan(0);
  await releaseFrame(page, "second");
  await expect(cover(page)).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("terminal retry keeps the poster until the retried source presents a frame", async ({
  page,
}) => {
  await holdFrameNotifications(page);
  await setup(page, ["first"]);
  let fail = true;
  await page.route("https://media.example.test/first.mp4", (route) =>
    route.fulfill({
      status: fail ? 404 : 200,
      body: fail ? "" : bytes,
      contentType: "video/mp4",
      headers: { "access-control-allow-origin": "*" },
    }),
  );
  await page.goto("/?test-session=1");
  await expect(page.locator("main")).toHaveAttribute("data-status", "error");
  await expect(cover(page).locator("img")).toHaveAttribute(
    "src",
    poster("first"),
  );
  fail = false;
  await page.locator(".player-message .text-button").click();
  await queued(page, "first");
  await expect.poll(() => position(page)).toBeGreaterThan(0.2);
  await expect(cover(page)).toBeVisible();
  await releaseFrame(page, "first");
  await expect(cover(page)).toHaveCount(0);
});

test("older browsers reveal decoded video without a frame-callback API", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(
      HTMLVideoElement.prototype,
      "requestVideoFrameCallback",
      { value: undefined },
    ),
  );
  await setup(page);
  await page.goto("/?test-session=1");
  await expect.poll(() => position(page)).toBeGreaterThan(0.2);
  await expect(cover(page)).toHaveCount(0);
  await next(page, "second");
  await expect.poll(() => position(page)).toBeGreaterThan(0.2);
  await expect(cover(page)).toHaveCount(0);
});

test("reduced-data mode loads the current poster without warming future posters", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "connection", {
      value: { saveData: true },
    }),
  );
  await setup(page);
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.url().startsWith("https://posters.example.test"))
      requests.push(request.url());
  });
  await page.goto("/?test-session=1");
  await expect.poll(() => position(page)).toBeGreaterThan(0.4);
  expect(requests).toEqual([poster("first")]);
  await next(page, "second");
  await expect.poll(() => position(page)).toBeGreaterThan(0.2);
  expect(requests).toContain(poster("second"));
  expect(requests).not.toContain(poster("third"));
});

test("a fresh video frame is visible while startup About keeps playback paused", async ({
  page,
}) => {
  const session = await setup(page);
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/__test/session", async (route) => {
    await pending;
    await route.fulfill({ json: session });
  });
  try {
    await page.goto("/?test-session=1");
    await page.getByRole("button", { name: "عن التطبيق", exact: true }).click();
    release();
    await expect(page.locator("main")).toHaveAttribute("data-status", "paused");
    await expect.poll(() => position(page)).toBe(0);
    await expect(cover(page)).toHaveCount(0);
    await expect(page.locator("video")).toHaveJSProperty("paused", true);
  } finally {
    release();
  }
});

test("HLS holds its poster through initial loading and retains the video frame during later buffering", async ({
  page,
}) => {
  test.setTimeout(45_000);
  const session = await setup(page, ["hls"]);
  session.items[0] = {
    ...(session.items[0] as ReturnType<typeof media>),
    playback: {
      url: "https://hls.example.test/index.m3u8",
      mimeType: "application/vnd.apple.mpegurl",
    },
  };
  await page.route("**/__test/session", (route) =>
    route.fulfill({ json: session }),
  );
  await page.addInitScript(() => {
    const native = HTMLMediaElement.prototype.canPlayType;
    HTMLMediaElement.prototype.canPlayType = function (type) {
      return /mpegurl/i.test(type) ? "" : native.call(this, type);
    };
  });
  let first!: () => void, rest!: () => void;
  const firstSegment = new Promise<void>((resolve) => {
    first = resolve;
  });
  const remaining = new Promise<void>((resolve) => {
    rest = resolve;
  });
  await page.route("https://hls.example.test/**", async (route) => {
    const name = new URL(route.request().url()).pathname.slice(1);
    if (name.endsWith(".ts"))
      await (name === "segment-00.ts" ? firstSegment : remaining);
    await route.fulfill({
      body: readFileSync(new URL(`./assets/hls/${name}`, import.meta.url)),
      contentType: name.endsWith(".m3u8")
        ? "application/vnd.apple.mpegurl"
        : "video/mp2t",
      headers: { "access-control-allow-origin": "*" },
    });
  });
  try {
    await page.goto("/?test-session=1");
    await expect(cover(page).locator("img")).toHaveAttribute(
      "src",
      poster("hls"),
    );
    await expect
      .poll(() =>
        cover(page)
          .locator("img")
          .evaluate((img: HTMLImageElement) => img.naturalWidth),
      )
      .toBeGreaterThan(0);
    first();
    await expect.poll(() => position(page)).toBeGreaterThan(0.2);
    await expect(cover(page)).toHaveCount(0);
    await expect(page.locator("main")).toHaveAttribute(
      "data-status",
      "buffering",
      { timeout: 10_000 },
    );
    await expect(cover(page)).toHaveCount(0);
    const stopped = await position(page);
    rest();
    await expect.poll(() => position(page)).toBeGreaterThan(stopped + 0.3);
    await expect(cover(page)).toHaveCount(0);
  } finally {
    first();
    rest();
  }
});

test("an initial frame delivered before seek completion is revealed without playback", async ({
  page,
}) => {
  const session = await setup(page);
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/__test/session", async (route) => {
    await pending;
    await route.fulfill({ json: session });
  });
  await page.addInitScript(() => {
    const original = HTMLVideoElement.prototype.requestVideoFrameCallback;
    HTMLVideoElement.prototype.requestVideoFrameCallback = function (callback) {
      return original.call(this, (at, metadata) => {
        (window as any).__earlyInitialFrame = true;
        Object.defineProperty(this, "seeking", {
          configurable: true,
          value: true,
        });
        callback(at, metadata);
        delete (this as any).seeking;
        this.dispatchEvent(new Event("seeked"));
      });
    };
  });
  try {
    await page.goto("/?test-session=1");
    await page.getByRole("button", { name: "عن التطبيق", exact: true }).click();
    release();
    await expect
      .poll(() => page.evaluate(() => (window as any).__earlyInitialFrame))
      .toBe(true);
    await expect(cover(page)).toHaveCount(0);
    await expect(page.locator("video")).toHaveJSProperty("paused", true);
    await expect.poll(() => position(page)).toBe(0);
  } finally {
    release();
  }
});
