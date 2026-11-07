import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { media, plan, position, start } from "./fixtures";

const cache = "public, max-age=0, s-maxage=31536000, must-revalidate";
const hls = (id: string) => ({
  ...media(id),
  posterUrl: "https://media.example.test/poster.svg",
  playback: {
    url: `https://preload.example.test/${id}/master.m3u8`,
    mimeType: "application/vnd.apple.mpegurl" as const,
  },
});
function gate() {
  let release!: () => void;
  return {
    promise: new Promise<void>((resolve) => {
      release = resolve;
    }),
    release: () => release(),
  };
}
async function streams(
  page: Page,
  before?: (path: string, count: number) => Promise<"fail" | void>,
) {
  const requests: string[] = [];
  await page.route("https://preload.example.test/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    requests.push(path);
    const fault = await before?.(
      path,
      requests.filter((p) => p === path).length,
    );
    if (fault === "fail")
      return route.fulfill({ status: 503, body: "temporarily unavailable" });
    const name = path.split("/").at(-1)!;
    await route
      .fulfill({
        body:
          name === "master.m3u8"
            ? "#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=400000\nindex.m3u8\n"
            : readFileSync(new URL(`./assets/hls/${name}`, import.meta.url)),
        contentType: name.endsWith("m3u8")
          ? "application/vnd.apple.mpegurl"
          : "video/mp2t",
        headers: { "access-control-allow-origin": "*", "cache-control": cache },
      })
      .catch(() => {}); // A deliberately aborted speculative request may finish last.
  });
  await page.route("https://media.example.test/poster.svg", (route) =>
    route.fulfill({
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="500"><rect width="300" height="500" fill="#674c27"/></svg>',
      contentType: "image/svg+xml",
    }),
  );
  return requests;
}
async function setup(page: Page, before?: Parameters<typeof streams>[1]) {
  const session = plan();
  session.items = [media("first"), hls("second"), media("third")];
  const requests = await streams(page, before);
  await start(page, session);
  // start's MP4 route is registered last; keep the poster response specific.
  await page.route("https://media.example.test/poster.svg", (route) =>
    route.fulfill({
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="500"><rect width="300" height="500" fill="#674c27"/></svg>',
      contentType: "image/svg+xml",
    }),
  );
  return requests;
}
async function next(page: Page, id = "second") {
  await page.keyboard.press("ArrowDown");
  await expect(page.locator("main")).toHaveAttribute("data-item-id", id);
}
const opening = ["master.m3u8", "index.m3u8", "segment-00.ts", "segment-01.ts"];

for (const nativeAdvertised of [false, true]) {
  test(`completed HLS warmup bypasses HTTP revalidation and stays quiet (native advertised: ${nativeAdvertised})`, async ({
    page,
  }) => {
    await page.addInitScript((native) => {
      const canPlay = HTMLMediaElement.prototype.canPlayType;
      HTMLMediaElement.prototype.canPlayType = function (type) {
        return /mpegurl/i.test(type)
          ? native
            ? "maybe"
            : ""
          : canPlay.call(this, type);
      };
    }, nativeAdvertised);
    const requests = await setup(page);
    await expect
      .poll(() => opening.every((name) => requests.includes(`/second/${name}`)))
      .toBe(true);
    await page.waitForTimeout(250);
    await page.evaluate(() => {
      (window as any).__notices = [];
      new MutationObserver(() => {
        if (document.querySelector(".player-status"))
          (window as any).__notices.push(performance.now());
      }).observe(document.querySelector("main")!, {
        childList: true,
        subtree: true,
      });
    });
    const video = await page.locator("video").elementHandle();
    await next(page);
    await expect.poll(() => position(page)).toBeGreaterThan(0.25);
    await expect(
      page.locator('[data-page="current"] .media-cover'),
    ).toHaveCount(0);
    for (const name of opening)
      expect(requests.filter((p) => p === `/second/${name}`)).toHaveLength(1);
    await expect(page.locator("video")).toHaveAttribute("src", /^blob:/);
    expect(
      await video!.evaluate((v) => v === document.querySelector("video")),
    ).toBe(true);
    expect(await page.evaluate(() => (window as any).__notices)).toEqual([]);
  });
}

for (const heldFile of ["master.m3u8", "segment-00.ts"]) {
  test(`handoff shares the pending ${heldFile}, keeps its poster, and reports a prolonged wait`, async ({
    page,
  }) => {
    const held = gate();
    const requests = await setup(page, async (path) => {
      if (path.endsWith(heldFile)) await held.promise;
    });
    try {
      await expect
        .poll(() => requests.filter((p) => p.endsWith(heldFile)).length)
        .toBe(1);
      await next(page);
      await expect(page.locator(".player-status")).toHaveCount(0);
      await expect(page.locator(".player-status")).toBeVisible();
      await expect(
        page.locator('[data-page="current"] .media-cover'),
      ).toBeVisible();
      expect(requests.filter((p) => p.endsWith(heldFile))).toHaveLength(1);
      held.release();
      await expect.poll(() => position(page)).toBeGreaterThan(0.3);
      await expect(page.locator(".player-status")).toHaveCount(0);
      for (const name of opening)
        expect(requests.filter((p) => p === `/second/${name}`)).toHaveLength(1);
    } finally {
      held.release();
    }
  });
}

for (const pause of ["manual", "Info"]) {
  test(`unfinished preloading resumes after ${pause} without re-fetching completed resources`, async ({
    page,
  }) => {
    const held = gate();
    await page.addInitScript(() => {
      (window as any).__abortedWarmups = [];
      const fetcher = window.fetch.bind(window);
      window.fetch = (url, options) => {
        options?.signal?.addEventListener("abort", () =>
          (window as any).__abortedWarmups.push(String(url)),
        );
        return fetcher(url, options);
      };
    });
    const requests = await setup(page, async (path, count) => {
      if (path.endsWith("segment-00.ts") && count === 1) await held.promise;
    });
    try {
      await expect
        .poll(() => requests.filter((p) => p.endsWith("segment-00.ts")).length)
        .toBe(1);
      if (pause === "manual") await page.locator(".small-pause").click();
      else
        await page
          .getByRole("button", { name: "عن التطبيق", exact: true })
          .click();
      await expect
        .poll(() =>
          page.evaluate(() =>
            (window as any).__abortedWarmups.some((url: string) =>
              url.endsWith("segment-00.ts"),
            ),
          ),
        )
        .toBe(true);
      if (pause === "manual") await page.locator(".small-pause").click();
      else
        await page
          .getByRole("button", { name: "متابعة المشاهدة", exact: true })
          .click();
      await expect
        .poll(() => requests.filter((p) => p.endsWith("segment-00.ts")).length)
        .toBe(2);
      await expect
        .poll(() => requests.filter((p) => p.endsWith("segment-01.ts")).length)
        .toBe(1);
      await next(page);
      await expect.poll(() => position(page)).toBeGreaterThan(0.3);
      expect(requests.filter((p) => p.endsWith("master.m3u8"))).toHaveLength(1);
      expect(requests.filter((p) => p.endsWith("index.m3u8"))).toHaveLength(1);
    } finally {
      held.release();
    }
  });
}

test("failed speculation retries while the current short continues playing", async ({
  page,
}) => {
  const requests = await setup(page, async (path, count) =>
    path.endsWith("master.m3u8") && count === 1 ? "fail" : undefined,
  );
  await expect
    .poll(() => requests.filter((p) => p.endsWith("master.m3u8")).length)
    .toBe(2);
  await expect
    .poll(() => requests.filter((p) => p.endsWith("segment-01.ts")).length)
    .toBe(1);
  await expect(page.locator("main")).toHaveAttribute("data-item-id", "first");
  await expect.poll(() => position(page)).toBeGreaterThan(0.3);
  await next(page);
  await expect.poll(() => position(page)).toBeGreaterThan(0.3);
  expect(requests.filter((p) => p.endsWith("master.m3u8"))).toHaveLength(2);
});

test("loading notice waits afresh after pause and cannot leak into another item", async ({
  page,
}) => {
  const held = gate();
  const requests = await setup(page, async (path) => {
    if (path.endsWith("segment-00.ts")) await held.promise;
  });
  try {
    await expect
      .poll(() => requests.some((p) => p.endsWith("segment-00.ts")))
      .toBe(true);
    await next(page);
    await expect(page.locator(".player-status")).toBeVisible();
    await page.locator(".small-pause").click();
    await expect(page.locator(".player-status")).toHaveCount(0);
    await page.waitForTimeout(850);
    await page.locator(".small-pause").click();
    await page.waitForTimeout(250);
    await expect(page.locator(".player-status")).toHaveCount(0);
    await expect(page.locator(".player-status")).toBeVisible();
    await next(page, "third");
    await expect.poll(() => position(page)).toBeGreaterThan(0.3);
    await expect(page.locator(".player-status")).toHaveCount(0);
    held.release();
    await page.waitForTimeout(400);
    await expect(page.locator("main")).toHaveAttribute("data-item-id", "third");
    await expect(page.locator(".player-status")).toHaveCount(0);
  } finally {
    held.release();
  }
});

for (const paused of [false, true]) {
  test(`connectivity recovery restarts exhausted preloading only when eligible (paused: ${paused})`, async ({
    page,
  }) => {
    let offline = true;
    const requests = await setup(page, async (path) =>
      offline && path.endsWith("master.m3u8") ? "fail" : undefined,
    );
    await expect.poll(() => requests.length).toBe(3);
    await page.waitForTimeout(250);
    if (paused) await page.locator(".small-pause").click();
    offline = false;
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    if (paused) {
      await page.waitForTimeout(500);
      expect(requests).toHaveLength(3);
      await expect(page.locator("main")).toHaveAttribute(
        "data-status",
        "paused",
      );
      await page.locator(".small-pause").click();
    }
    await expect
      .poll(() => requests.some((p) => p.endsWith("segment-01.ts")))
      .toBe(true);
    await next(page);
    await expect.poll(() => position(page)).toBeGreaterThan(0.3);
    expect(requests.filter((p) => p.endsWith("master.m3u8"))).toHaveLength(4);
  });
}

test("leaving and returning through bfcache releases old HLS work and starts a fresh session", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const requests = await setup(page);
  await expect
    .poll(() => requests.some((p) => p.endsWith("segment-01.ts")))
    .toBe(true);
  await next(page);
  await expect.poll(() => position(page)).toBeGreaterThan(0.5);
  await page.locator(".small-pause").click();
  // Deterministic Page Transition Events exercise the bfcache path; hidden-tab
  // behavior is covered separately and must not release the playing element.
  await page.evaluate(() =>
    window.dispatchEvent(
      new PageTransitionEvent("pagehide", { persisted: true }),
    ),
  );
  await expect(page.locator("video")).not.toHaveAttribute("src");
  await page.waitForTimeout(200);
  await page.evaluate(() =>
    window.dispatchEvent(
      new PageTransitionEvent("pageshow", { persisted: true }),
    ),
  );
  await expect(page.locator("main")).toHaveAttribute("data-item-id", "first");
  await expect.poll(() => position(page)).toBeGreaterThan(0.3);
  await expect(page.locator("video")).toHaveJSProperty("paused", false);
  expect(errors).toEqual([]);
});

test("reconnection honors a newly enabled data-saving policy", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "connection", {
      value: { saveData: false },
    });
  });
  let offline = true;
  const requests = await setup(page, async (path) =>
    offline && path.endsWith("master.m3u8") ? "fail" : undefined,
  );
  await expect.poll(() => requests.length).toBe(3);
  offline = false;
  await page.evaluate(() => {
    (navigator as any).connection.saveData = true;
    window.dispatchEvent(new Event("online"));
  });
  await page.waitForTimeout(400);
  expect(requests).toHaveLength(3);
  await page.evaluate(() => {
    (navigator as any).connection.saveData = false;
    window.dispatchEvent(new Event("online"));
  });
  await expect
    .poll(() => requests.some((p) => p.endsWith("segment-01.ts")))
    .toBe(true);
});

test("reload cancels outstanding HLS downloads without retries in the departing document", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const urls = new WeakMap<XMLHttpRequest, string>();
    const open = XMLHttpRequest.prototype.open;
    const abort = XMLHttpRequest.prototype.abort;
    (window as any).__xhrAborts = [];
    XMLHttpRequest.prototype.open = function (method, url, ...args: any[]) {
      urls.set(this, String(url));
      return (open as any).call(this, method, url, ...args);
    };
    XMLHttpRequest.prototype.abort = function () {
      (window as any).__xhrAborts.push(urls.get(this));
      return abort.call(this);
    };
  });
  const held = gate();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const requests = await streams(page, async (path, count) => {
    if (path.endsWith("segment-02.ts") && count === 1) await held.promise;
  });
  const session = plan();
  session.items = [hls("current"), media("next")];
  try {
    await start(page, session);
    await expect
      .poll(() => requests.some((p) => p.endsWith("segment-02.ts")))
      .toBe(true);
    await expect.poll(() => position(page)).toBeGreaterThan(0.5);
    await page.evaluate(() => {
      // Registered after the player, so this observes its early cleanup before
      // WebKit cancels the old document's network requests and fires pagehide.
      window.addEventListener("beforeunload", () => {
        sessionStorage.setItem(
          "qa.earlyAbort",
          String(
            (window as any).__xhrAborts.some((url: string) =>
              url.endsWith("segment-02.ts"),
            ),
          ),
        );
      });
    });
    await page.reload();
    held.release();
    await expect.poll(() => position(page)).toBeGreaterThan(0.5);
    expect(
      await page.evaluate(() => sessionStorage.getItem("qa.earlyAbort")),
    ).toBe("true");
    expect(errors).toEqual([]);
  } finally {
    held.release();
  }
});

test("a decoder still waiting to present its first frame gets a delayed notice", async ({
  page,
}) => {
  await page.addInitScript(() => {
    (window as any).__frames = [];
    const original = HTMLVideoElement.prototype.requestVideoFrameCallback;
    HTMLVideoElement.prototype.requestVideoFrameCallback = function (callback) {
      return original.call(this, (at, metadata) =>
        (window as any).__frames.push(() => callback(at, metadata)),
      );
    };
  });
  await start(page);
  await expect(page.locator(".player-status")).toHaveCount(0);
  await expect(page.locator(".player-status")).toBeVisible();
  await expect(
    page.locator('[data-page="current"] .media-cover'),
  ).toBeVisible();
  await page.evaluate(() =>
    (window as any).__frames.splice(0).forEach((fn: () => void) => fn()),
  );
  await expect(page.locator(".player-status")).toHaveCount(0);
  await expect(page.locator('[data-page="current"] .media-cover')).toHaveCount(
    0,
  );
});

test("a timed-out speculative download restarts without another user gesture", async ({
  page,
}) => {
  const held = gate();
  const requests = await setup(page, async (path, count) => {
    if (path.endsWith("segment-00.ts") && count === 1) await held.promise;
  });
  try {
    await expect
      .poll(() => requests.filter((p) => p.endsWith("segment-00.ts")).length, {
        timeout: 12_000,
      })
      .toBe(2);
    await expect
      .poll(() => requests.some((p) => p.endsWith("segment-01.ts")))
      .toBe(true);
    await expect(page.locator("main")).toHaveAttribute("data-item-id", "first");
    await next(page);
    await expect.poll(() => position(page)).toBeGreaterThan(0.3);
    expect(requests.filter((p) => p.endsWith("master.m3u8"))).toHaveLength(1);
  } finally {
    held.release();
  }
});

test("a failed in-flight handoff falls back to the active loader without stranding playback", async ({
  page,
}) => {
  const held = gate();
  const requests = await setup(page, async (path, count) => {
    if (path.endsWith("master.m3u8") && count === 1) {
      await held.promise;
      return "fail";
    }
  });
  try {
    await expect.poll(() => requests.length).toBe(1);
    await next(page);
    held.release();
    await expect.poll(() => position(page)).toBeGreaterThan(0.3);
    expect(requests.filter((p) => p.endsWith("master.m3u8"))).toHaveLength(2);
    await expect(page.locator(".player-status")).toHaveCount(0);
  } finally {
    held.release();
  }
});
