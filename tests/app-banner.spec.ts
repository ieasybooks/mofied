import { expect, test, type Browser, type Page } from "@playwright/test";
import { media, plan, serveMp4 } from "./fixtures";

const ua = {
  androidChrome:
    "Mozilla/5.0 (Linux; Android 13; SM-N980F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36",
  androidWebView:
    "Mozilla/5.0 (Linux; Android 13; SM-N980F; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/142.0.0.0 Mobile Safari/537.36",
  iphoneChrome:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 19_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/142.0.7444.46 Mobile/15E148 Safari/604.1",
  iphoneSafari:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 19_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.1 Mobile/15E148 Safari/604.1",
};
const play = "https://play.google.com/store/apps/details?id=com.mofied.app";
const intent = (link: string) =>
  `intent://${link}#Intent;scheme=https;package=com.mofied.app;S.browser_fallback_url=${encodeURIComponent(play)};end`;

async function open(browser: Browser, userAgent: string, path = "/") {
  const context = await browser.newContext({
    userAgent,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  const session = plan();
  session.items[0] = { ...media("first"), mediaId: "4321" };
  await page.route("**/__test/session*", (route) =>
    route.fulfill({ json: session }),
  );
  await serveMp4(page);
  await page.goto(
    `http://127.0.0.1:5173${path}${path.includes("?") ? "&" : "?"}test-session=1`,
  );
  await expect(page.locator("main")).toHaveAttribute("data-status", "playing");
  return page;
}
const banner = (page: Page) => page.locator(".app-banner");

test("Android browsers open the app at the same link, below which the player moves down", async ({
  browser,
}) => {
  const page = await open(browser, ua.androidChrome, "/?start=4321");
  await expect(banner(page)).toBeVisible();
  await expect(banner(page)).toContainText("شاهد في تطبيق مفيد");
  const link = page.getByRole("link", { name: "فتح" });
  // The address is cleaned once the session opens; the banner keeps the share.
  expect(new URL(page.url()).searchParams.has("start")).toBe(false);
  await expect(link).toHaveAttribute("href", intent("mofied.com/?start=4321"));
  const bar = (await banner(page).boundingBox())!;
  expect(bar).toMatchObject({ x: 0, y: 0, width: 390, height: 60 });
  const header = (await page.locator(".session-header").boundingBox())!;
  expect(header.y).toBeGreaterThanOrEqual(60 + 18);
  const main = (await page.locator("main").boundingBox())!;
  expect(main.y + main.height).toBeLessThanOrEqual(844);
  expect(
    await page.evaluate(() => document.documentElement.scrollHeight),
  ).toBeLessThanOrEqual(844);

  // Leaving for the app pauses the web session. Keep the test page here.
  await page.evaluate(() =>
    document
      .querySelector(".app-banner-open")!
      .addEventListener("click", (event) => event.preventDefault()),
  );
  await link.click();
  await expect(page.locator("main")).toHaveAttribute("data-status", "paused");
});

test("× hides the banner for this visit only and restores the layout", async ({
  browser,
}) => {
  const page = await open(browser, ua.androidChrome);
  await expect(page.getByRole("link", { name: "فتح" })).toHaveAttribute(
    "href",
    intent("mofied.com/"),
  );
  await page.getByRole("button", { name: "إغلاق", exact: true }).click();
  await expect(banner(page)).toHaveCount(0);
  await expect(page.locator("html")).not.toHaveAttribute("data-app-banner");
  const header = (await page.locator(".session-header").boundingBox())!;
  expect(header.y).toBeLessThan(40);
  await expect(page.locator("main")).toHaveAttribute("data-status", "playing");
  await page.reload();
  await expect(banner(page)).toBeVisible();
});

test("in-app and other iPhone browsers go to the store page", async ({
  browser,
}) => {
  const android = await open(browser, ua.androidWebView);
  await expect(android.getByRole("link", { name: "فتح" })).toHaveAttribute(
    "href",
    play,
  );
  const iphone = await open(browser, ua.iphoneChrome);
  await expect(iphone.getByRole("link", { name: "فتح" })).toHaveAttribute(
    "href",
    "https://apps.apple.com/app/id6831969465",
  );
});

test("iPhone Safari gets Apple's banner, carrying a shared media", async ({
  browser,
}) => {
  const page = await open(browser, ua.iphoneSafari, "/?start=4321");
  await expect(banner(page)).toHaveCount(0);
  await expect(page.locator('meta[name="apple-itunes-app"]')).toHaveAttribute(
    "content",
    "app-id=6831969465, app-argument=https://mofied.com/?start=4321",
  );
  const plain = await open(browser, ua.iphoneSafari);
  await expect(plain.locator('meta[name="apple-itunes-app"]')).toHaveAttribute(
    "content",
    "app-id=6831969465",
  );
});

test("desktop browsers show no banner", async ({ page }) => {
  await page.route("**/__test/session*", (route) =>
    route.fulfill({ json: plan() }),
  );
  await serveMp4(page);
  await page.goto("/?test-session=1");
  await expect(page.locator("main")).toHaveAttribute("data-status", "playing");
  await expect(banner(page)).toHaveCount(0);
  await expect(page.locator("html")).not.toHaveAttribute("data-app-banner");
});

test("the banner also sits above the loading error screen", async ({
  browser,
}) => {
  const context = await browser.newContext({
    userAgent: ua.androidChrome,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.route("**/__test/session*", (route) =>
    route.fulfill({ status: 503 }),
  );
  await page.goto("http://127.0.0.1:5173/?test-session=1");
  await expect(
    page.getByRole("heading", { name: "تعذّر تحميل الجلسة" }),
  ).toBeVisible();
  await expect(banner(page)).toBeVisible();
  const info = (await page
    .getByRole("button", { name: "عن التطبيق", exact: true })
    .boundingBox())!;
  expect(info.y).toBeGreaterThanOrEqual(60);
});
