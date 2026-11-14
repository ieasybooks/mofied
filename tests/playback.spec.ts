import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import {
  finishMedia,
  media,
  plan,
  position,
  serveMp4,
  start,
} from "./fixtures";

/** Deterministic per-element audible permission. Real decoding still occurs.
 * Desktop automation grants gestures more freely than iOS, so this deliberately
 * does not use navigator.userActivation as an oracle for an iPhone policy. */
async function audiblePolicy(page: Page) {
  await page.addInitScript(() => {
    const authorized = new WeakSet<HTMLMediaElement>();
    let gesture = false;
    for (const name of ["click", "keydown"]) {
      window.addEventListener(
        name,
        (event) => {
          gesture = event.isTrusted;
        },
        true,
      );
      window.addEventListener(name, () => {
        gesture = false;
      });
    }
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (!this.muted) {
        if (gesture) authorized.add(this);
        if (!authorized.has(this))
          return Promise.reject(
            new DOMException(
              "Tap this element to play sound",
              "NotAllowedError",
            ),
          );
      }
      return play.call(this);
    };
  });
}
async function next(page: Page, id: string) {
  await page.keyboard.press("ArrowDown");
  await expect(page.locator("main")).toHaveAttribute("data-item-id", id);
}
async function sound(page: Page) {
  await page.getByRole("button", { name: "تشغيل الصوت", exact: true }).click();
  await expect(page.locator("video")).toHaveJSProperty("muted", false);
}

test("audible swipe and natural transitions retain one authorized element through reminders and history", async ({
  page,
}) => {
  await audiblePolicy(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const session = plan(1200);
  session.items.splice(1, 0, media("second"), media("third"));
  await start(page, session);
  const original = await page.locator("video").elementHandle();
  await sound(page);
  for (const id of ["second", "third"]) {
    await page.mouse.move(180, 500);
    await page.mouse.down();
    await page.mouse.move(180, 200, { steps: 10 });
    await page.mouse.up();
    await expect(page.locator("main")).toHaveAttribute("data-item-id", id);
    await expect(page.locator("main")).toHaveAttribute(
      "data-status",
      "playing",
    );
    expect(
      await original!.evaluate(
        (element) => element === document.querySelector("video"),
      ),
    ).toBe(true);
    await expect.poll(() => position(page)).toBeGreaterThan(0.2);
    await expect(page.locator("video")).toHaveJSProperty("muted", false);
  }
  await finishMedia(page);
  await expect(page.locator("main")).toHaveAttribute(
    "data-item-id",
    "reminder",
  );
  await expect(page.locator("video")).toBeHidden();
  await expect(page.locator("video")).toHaveJSProperty("paused", true);
  await expect(page.locator("main")).toHaveAttribute("data-item-id", "last");
  await expect.poll(() => position(page)).toBeGreaterThan(0.2);
  expect(
    await original!.evaluate(
      (element) => element === document.querySelector("video"),
    ),
  ).toBe(true);
  await page.keyboard.press("ArrowUp");
  await expect(page.locator("main")).toHaveAttribute("data-item-id", "third");
  await next(page, "last");
  await expect(page.locator("main")).toHaveAttribute("data-status", "playing");
  await finishMedia(page);
  await expect(page.locator("main")).toHaveAttribute("data-status", "ended");
  await expect(page.locator("video")).not.toHaveAttribute("src");
});

test("manual pause survives Info, and the next media plays with sound enabled", async ({
  page,
}) => {
  await audiblePolicy(page);
  const session = plan();
  session.items = [media("first"), media("second"), media("third")];
  await start(page, session);
  await sound(page);
  await page.locator(".small-pause").click();
  await expect(page.locator("video")).toHaveJSProperty("paused", true);
  const before = await position(page);
  await page.getByRole("button", { name: "عن التطبيق", exact: true }).click();
  await page
    .getByRole("button", { name: "سياسة الخصوصية", exact: true })
    .click();
  await page.getByRole("button", { name: "رجوع", exact: true }).click();
  await page
    .getByRole("button", { name: "متابعة المشاهدة", exact: true })
    .click();
  expect(await position(page)).toBeCloseTo(before, 1);
  await expect(page.locator("video")).toHaveJSProperty("paused", true);
  // A pause belongs to the media it was made on; the next media plays.
  await next(page, "second");
  await expect(page.locator("main")).toHaveAttribute("data-status", "playing");
  await expect.poll(() => position(page)).toBeGreaterThan(0.3);
  await expect(page.locator("video")).toHaveJSProperty("muted", false);
  await expect(page.locator(".player-message")).toHaveCount(0);
});

test("next MP4 is fetched while current plays and reused without a second download", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.url().startsWith("https://media.example.test/"))
      requests.push(request.url());
  });
  const session = plan();
  session.items = [media("first"), media("second"), media("third")];
  await start(page, session);
  await expect
    .poll(() => requests.filter((url) => url.endsWith("second.mp4")).length)
    .toBe(1);
  expect(requests.filter((url) => url.endsWith("third.mp4"))).toHaveLength(0);
  await page.waitForTimeout(300);
  await expect(page.locator("main")).toHaveAttribute("data-item-id", "first");
  await next(page, "second");
  await expect.poll(() => position(page)).toBeGreaterThan(0.2);
  expect(requests.filter((url) => url.endsWith("second.mp4"))).toHaveLength(1);
  await expect(page.locator("video")).toHaveAttribute("src", /^blob:/);
});

test("next HLS manifest and opening segments preload and decode through the same player", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const canPlayType = HTMLMediaElement.prototype.canPlayType;
    HTMLMediaElement.prototype.canPlayType = function (type) {
      return /mpegurl/i.test(type) ? "" : canPlayType.call(this, type);
    };
  });
  const session = plan();
  session.items = [
    media("first"),
    {
      ...media("hls"),
      playback: {
        url: "https://hls.example.test/index.m3u8",
        mimeType: "application/vnd.apple.mpegurl",
      },
    },
    media("third"),
  ];
  const requests: string[] = [];
  await page.route("https://hls.example.test/**", (route) => {
    const name = new URL(route.request().url()).pathname.slice(1);
    requests.push(name);
    return route.fulfill({
      body: readFileSync(new URL(`./assets/hls/${name}`, import.meta.url)),
      contentType: name.endsWith("m3u8")
        ? "application/vnd.apple.mpegurl"
        : "video/mp2t",
      headers: { "access-control-allow-origin": "*" },
    });
  });
  await start(page, session);
  await expect.poll(() => requests.length).toBe(3);
  expect(requests).toEqual(["index.m3u8", "segment-00.ts", "segment-01.ts"]);
  await next(page, "hls");
  await expect.poll(() => position(page)).toBeGreaterThan(0.5);
  expect(requests.filter((name) => name === "index.m3u8")).toHaveLength(1);
  expect(requests.filter((name) => name === "segment-00.ts")).toHaveLength(1);
  expect(requests.filter((name) => name === "segment-01.ts")).toHaveLength(1);
  expect(
    await page
      .locator("video")
      .evaluate((video: HTMLVideoElement) => video.videoWidth),
  ).toBeGreaterThan(0);
});

test("speculative failure does not replace current media or skip its required reminder", async ({
  page,
}) => {
  const session = plan(1200);
  session.replacements = [media("spare")];
  let failures = 0;
  await serveMp4(page);
  await page.route("https://media.example.test/last.mp4", (route) => {
    failures++;
    return route.abort();
  });
  await page.route("**/__test/session", (route) =>
    route.fulfill({ json: session }),
  );
  await page.goto("/?test-session=1");
  await expect.poll(() => failures).toBe(1);
  await expect(page.locator("main")).toHaveAttribute("data-item-id", "first");
  await expect.poll(() => position(page)).toBeGreaterThan(0.5);
  await next(page, "reminder");
  await expect(page.locator("main")).toHaveAttribute("data-item-id", "spare");
  await expect.poll(() => position(page)).toBeGreaterThan(0.2);
});

test("reduced-data mode suppresses speculative downloads but navigation still works", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "connection", {
      value: { saveData: true },
    }),
  );
  const session = plan();
  session.items = [media("first"), media("second")];
  let nextRequests = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("second.mp4")) nextRequests++;
  });
  await start(page, session);
  await expect.poll(() => position(page)).toBeGreaterThan(0.5);
  expect(nextRequests).toBe(0);
  await next(page, "second");
  await expect.poll(() => position(page)).toBeGreaterThan(0.2);
  expect(nextRequests).toBeGreaterThan(0);
});

test("late playback callbacks from the outgoing source cannot block or advance the next source", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const play = HTMLMediaElement.prototype.play;
    const pending: (() => void)[] = [];
    Object.assign(window, {
      rejectOldPlayback: () => pending.forEach((reject) => reject()),
    });
    HTMLMediaElement.prototype.play = function () {
      const result = play.call(this);
      if (!this.src.includes("first.mp4")) return result;
      return result.then(
        () =>
          new Promise<void>((_resolve, reject) =>
            pending.push(() =>
              reject(new DOMException("Late denial", "NotAllowedError")),
            ),
          ),
      );
    };
  });
  const session = plan();
  session.items = [media("first"), media("second")];
  await start(page, session);
  await next(page, "second");
  await expect.poll(() => position(page)).toBeGreaterThan(0.2);
  await page.evaluate(() =>
    (window as Window & { rejectOldPlayback?: () => void })
      .rejectOldPlayback!(),
  );
  await page.locator("video").evaluate((video) => {
    video.dispatchEvent(new Event("ended"));
    video.dispatchEvent(new Event("error"));
  });
  await expect.poll(() => position(page)).toBeGreaterThan(0.5);
  await expect(page.locator("main")).toHaveAttribute("data-status", "playing");
});

test("reusing playback does not retain a broken portrait or the previous preview duration", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const first = media("first"),
    second = media("second");
  first.speaker.imageUrl = "https://images.example.test/broken.svg";
  second.speaker.imageUrl = "https://images.example.test/valid.svg";
  second.durationMs = 7000;
  const session = plan();
  session.items = [first, second];
  await page.route("https://images.example.test/broken.svg", (route) =>
    route.abort(),
  );
  await page.route("https://images.example.test/valid.svg", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="white"/></svg>',
    }),
  );
  await start(page, session);
  await expect(page.locator(".speaker img")).toBeHidden();
  await page.mouse.move(180, 500);
  await page.mouse.down();
  await page.mouse.move(180, 200, { steps: 8 });
  await expect(page.locator('[data-page="preview"] .media-time')).toHaveText(
    "0:00 / 0:07",
  );
  await page.mouse.up();
  await expect(page.locator("main")).toHaveAttribute("data-item-id", "second");
  await expect(
    page.locator('[data-page="current"] .speaker img'),
  ).toBeVisible();
});
