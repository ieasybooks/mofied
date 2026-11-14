import { expect, test } from "@playwright/test";
import { resolve } from "node:path";
import { parseSession } from "@mofied/contracts";

// Opt-in: two anonymous production session requests, one on each load.
// Build apps/web/dist with the default endpoint first. Only the app assets are
// served locally; API, CORS, images, HLS manifests and segments are all real.
test("deployed-origin API, HLS playback and fresh sessions on reload", async ({
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
  const freshResponse = page.waitForResponse((response) =>
    response.url().startsWith("https://faqieh.com/api/v1/mofied/session"),
  );
  await page.reload();
  const next = parseSession(await (await freshResponse).json());
  expect(next.id).not.toBe(plan.id);
  await expect(page.locator("main")).toHaveAttribute(
    "data-item-id",
    next.items[0]!.id,
  );
  await expect(page.locator("main")).toHaveAttribute("data-status", "playing", {
    timeout: 45_000,
  });
  expect(calls).toBe(2);
  expect(
    await page.evaluate(() =>
      sessionStorage.getItem("mofied.session.v1.production"),
    ),
  ).toBeNull();
  expect(errors).toEqual([]);
});
