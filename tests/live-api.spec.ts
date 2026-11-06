import { expect, test } from "@playwright/test";
import { resolve } from "node:path";
import { parseSession } from "@mofied/contracts";

// Opt-in: one anonymous production session request, then restore without another.
// Build apps/web/dist with the default endpoint first. Only the app assets are
// served locally; API, CORS, images, HLS manifests and segments are all real.
test("deployed-origin API, HLS playback and paused restoration", async ({
  page,
}) => {
  test.skip(process.env.LIVE_API !== "1", "Uses the deployed public API");
  test.setTimeout(90_000);
  let calls = 0;
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (request.url().startsWith("https://faqieh.com/api/v1/mofied/session"))
      calls++;
  });
  await page.route("https://mofied.com/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({
      path: resolve(
        "apps/web/dist",
        path === "/" ? "index.html" : path.slice(1),
      ),
    });
  });
  const responsePromise = page.waitForResponse((response) =>
    response.url().startsWith("https://faqieh.com/api/v1/mofied/session"),
  );
  await page.goto("https://mofied.com/");
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  expect(response.headers()["access-control-allow-origin"]).toBe(
    "https://mofied.com",
  );
  expect(response.headers()["cache-control"]).toContain("no-store");
  const plan = parseSession(await response.json());
  expect(plan.locale).toBe("ar");
  expect(plan.expiresAt && Date.parse(plan.expiresAt)).toBeGreaterThan(
    Date.now(),
  );
  await expect(page.locator("main")).toHaveAttribute("data-status", "playing", {
    timeout: 45_000,
  });
  await expect
    .poll(
      () =>
        page
          .locator("video")
          .evaluate((video: HTMLVideoElement) => video.currentTime),
      { timeout: 20_000 },
    )
    .toBeGreaterThan(2);
  expect(
    await page
      .locator("video")
      .evaluate((video: HTMLVideoElement) => video.videoWidth),
  ).toBeGreaterThan(0);
  await page.locator(".media-tap").click();
  const paused = await page
    .locator("video")
    .evaluate((video: HTMLVideoElement) => video.currentTime);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const saved = sessionStorage.getItem("mofied.session.v1.production");
        return saved ? JSON.parse(saved).positionMs : 0;
      }),
    )
    .toBeGreaterThan(1500);
  await page.reload();
  await expect(page.locator("main")).toHaveAttribute("data-status", "paused");
  await expect
    .poll(
      () =>
        page
          .locator("video")
          .evaluate((video: HTMLVideoElement) => video.currentTime),
      { timeout: 15_000 },
    )
    .toBeCloseTo(paused, 0);
  await expect(page.locator("video")).toHaveJSProperty("paused", true);
  expect(calls).toBe(1);
  expect(errors).toEqual([]);
});
