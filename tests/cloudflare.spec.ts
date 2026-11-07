import { expect, test } from "@playwright/test";
import { readdirSync } from "node:fs";
import { plan, serveMp4 } from "./fixtures";

const api = "https://faqieh.com/api/v1/mofied/session?locale=ar";

for (const [path, heading] of [
  ["privacy", "سياسة الخصوصية"],
  ["support", "التواصل والدعم"],
]) {
  test(`store ${path} page works without JavaScript or a session`, async ({
    browser,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    const requests: string[] = [];
    page.on("request", (request) => requests.push(request.url()));
    try {
      for (const width of [320, 1440]) {
        await page.setViewportSize({ width, height: 800 });
        const response = await page.goto(`http://127.0.0.1:8787/${path}/`);
        expect(response?.status()).toBe(200);
        await expect(
          page.getByRole("heading", { name: heading, exact: true }),
        ).toBeVisible();
        await expect(page.locator("header img")).toBeVisible();
        expect(
          await page
            .locator("header img")
            .evaluate((img: HTMLImageElement) => img.naturalWidth),
        ).toBeGreaterThan(0);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBe(width);
        await page.getByRole("link", { name: "English", exact: true }).click();
        await expect(page.locator("#english h1")).toBeInViewport();
        await expect(
          page.locator('a[href="mailto:easybooksdev@gmail.com"]').first(),
        ).toBeAttached();
        await expect(page.locator("video")).toHaveCount(0);
      }
      expect(requests.some((url) => url.includes("/session"))).toBe(false);
    } finally {
      await context.close();
    }
  });
}

test("Cloudflare serves revalidated HTML and immutable fingerprinted assets", async ({
  request,
}) => {
  const response = await request.get("/?utm_source=release");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("text/html");
  expect(response.headers()["cache-control"]).toContain("max-age=0");
  expect(response.headers()["cache-control"]).not.toContain("no-transform");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response.headers()["x-frame-options"]).toBe("DENY");
  expect(await response.text()).toContain('class="launch-artwork"');

  const assets = readdirSync("apps/web/dist/assets");
  for (const [extension, mime] of [
    [".js", "javascript"],
    [".css", "text/css"],
    [".woff2", "font/woff2"],
  ]) {
    const name = assets.find((file) => file.endsWith(extension))!;
    const asset = await request.get(`/assets/${name}`);
    expect(asset.status()).toBe(200);
    expect(asset.headers()["content-type"]).toContain(mime);
    expect(asset.headers()["cache-control"]).toBe(
      "public, max-age=31536000, immutable",
    );
  }

  const icon = await request.get("/favicon.ico");
  expect(icon.status()).toBe(200);
  expect(icon.headers()["cache-control"]).not.toContain("immutable");
});

test("unknown paths and missing assets return 404 without caching HTML as JavaScript", async ({
  request,
}) => {
  const navigation = await request.get(
    "/returning-session?utm_source=release",
    {
      headers: { "Sec-Fetch-Mode": "navigate", Accept: "text/html" },
    },
  );
  expect(navigation.status()).toBe(404);
  expect(navigation.headers()["cache-control"] ?? "").not.toContain(
    "immutable",
  );
  for (const path of [
    "/assets/missing.js",
    "/assets/old-AbCd1234.js",
    "/_headers",
    "/.env",
  ]) {
    const missing = await request.get(path);
    expect(missing.status()).toBe(404);
    expect(missing.headers()["cache-control"] ?? "").not.toContain("immutable");
  }
});

test("production API loading, playback and paused restoration work under Cloudflare", async ({
  page,
}) => {
  let calls = 0;
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route(api, (route) => {
    calls++;
    return route.fulfill({ json: plan() });
  });
  await serveMp4(page);
  // Development query names must have no effect on this production build.
  await page.goto("/?fixture=normal&test-session=1");
  await expect(page.locator("main")).toHaveAttribute("data-status", "playing");
  await expect
    .poll(() =>
      page
        .locator("video")
        .evaluate((video: HTMLVideoElement) => video.currentTime),
    )
    .toBeGreaterThan(1);
  await page.locator(".media-tap").click();
  await expect(page.locator("main")).toHaveAttribute("data-status", "paused");
  const paused = await page
    .locator("video")
    .evaluate((video: HTMLVideoElement) => video.currentTime);
  await page.reload();
  await expect(page.locator("main")).toHaveAttribute("data-status", "paused");
  await expect
    .poll(() =>
      page
        .locator("video")
        .evaluate((video: HTMLVideoElement) => video.currentTime),
    )
    .toBeCloseTo(paused, 0);
  expect(calls).toBe(1);
  expect(errors).toEqual([]);
});

test("production API errors show Retry and recover without fixture playback", async ({
  page,
}) => {
  let calls = 0;
  await page.route(api, (route) =>
    ++calls === 1
      ? route.fulfill({ status: 503 })
      : route.fulfill({ json: plan() }),
  );
  await serveMp4(page);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "تعذّر تحميل الجلسة" }),
  ).toBeVisible();
  await expect(page.locator("video")).toHaveCount(0);
  await page.getByRole("button", { name: "إعادة المحاولة" }).click();
  await expect(page.locator("main")).toHaveAttribute("data-status", "playing");
  expect(calls).toBe(2);
});
