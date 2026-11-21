// mofied.com/app, the one address to share for the apps: a phone goes on to
// its store as the page loads (apps/web/src/stores.ts), and a computer, or a
// phone whose store we can't tell, gets the page: the three stores' badges,
// and on wide windows a QR code of the page.
import { createRequire } from "node:module";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { STORES, type Store } from "../apps/web/src/stores";

const storeHosts =
  /^https:\/\/(apps\.apple\.com|play\.google\.com|appgallery\.huawei\.com)\//;
const jsQR = createRequire(import.meta.url).resolve("jsqr/dist/jsQR.js");

const ua = {
  iphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 19_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.1 Mobile/15E148 Safari/604.1",
  // iPad Safari asks for the desktop site, as a Mac.
  ipad: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.1 Safari/605.1.15",
  android:
    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36",
  huawei:
    "Mozilla/5.0 (Linux; Android 10; NOH-NX9; HMSCore 6.15.0.302) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.5735.196 HuaweiBrowser/15.0.4.312 Mobile Safari/537.36",
  harmonyNext:
    "Mozilla/5.0 (Phone; OpenHarmony 6.0; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36 ArkWeb/6.0.0.130 Mobile HuaweiBrowser/5.1.12.351",
};

const texts = {
  ar: {
    title: "تطبيق مفيد",
    badges: {
      appStore: "تنزيل مفيد من App Store",
      googlePlay: "تنزيل مفيد من Google Play",
      appGallery: "تنزيل مفيد من HUAWEI AppGallery",
    },
    qr: "رمز QR لصفحة تطبيق مفيد",
  },
  en: {
    title: "The Mofied app",
    badges: {
      appStore: "Download Mofied on the App Store",
      googlePlay: "Get Mofied on Google Play",
      appGallery: "Get Mofied from HUAWEI AppGallery",
    },
    qr: "QR code for the Mofied app page",
  },
} as const;
const stores = Object.keys(STORES) as Store[];
const at = (locale: "ar" | "en") => (locale === "en" ? "/en/app" : "/app");

/** A phone's browser, with the touch points a real one reports. */
async function phone(
  browser: Browser,
  userAgent: string,
  { touchPoints = 5, width = 390, height = 844, isMobile = true } = {},
) {
  const context = await browser.newContext({
    userAgent,
    viewport: { width, height },
    isMobile,
    hasTouch: true,
  });
  // Chromium's touch emulation reports a single touch point.
  await context.addInitScript(
    (n) =>
      Object.defineProperty(Navigator.prototype, "maxTouchPoints", {
        get: () => n,
      }),
    touchPoints,
  );
  return context;
}

/** Answers for the stores, so a test never leaves for them. */
const standInForStores = (page: Page) =>
  page
    .context()
    .route(storeHosts, (route) =>
      route.fulfill({ contentType: "text/html", body: "<title>store</title>" }),
    );

/** What a QR code on the page says, read from what the browser drew. */
async function readQr(page: Page, name: string): Promise<string | null> {
  const png = (await page.getByRole("img", { name }).screenshot()).toString(
    "base64",
  );
  await page.addScriptTag({ path: jsQR });
  return page.evaluate(async (source) => {
    const image = new Image();
    image.src = `data:image/png;base64,${source}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d")!;
    context.drawImage(image, 0, 0);
    const { data, width, height } = context.getImageData(
      0,
      0,
      image.width,
      image.height,
    );
    type Read = (
      data: Uint8ClampedArray,
      width: number,
      height: number,
    ) => { data: string } | null;
    return (
      (window as unknown as { jsQR: Read }).jsQR(data, width, height)?.data ??
      null
    );
  }, png);
}

for (const [device, userAgent, store, options] of [
  ["An iPhone", ua.iphone, "appStore", {}],
  [
    "An iPad",
    ua.ipad,
    "appStore",
    { width: 820, height: 1180, isMobile: false },
  ],
  ["An Android phone", ua.android, "googlePlay", {}],
  ["A Huawei phone", ua.huawei, "appGallery", { touchPoints: 10 }],
] as const)
  for (const locale of ["ar", "en"] as const)
    test(`${device} goes on to its store from ${at(locale)}`, async ({
      browser,
    }) => {
      const context = await phone(browser, userAgent, options);
      try {
        const page = await context.newPage();
        await standInForStores(page);
        const from = locale === "en" ? "/en/about" : "/about";
        await page.goto(from);
        await page.goto(at(locale), { waitUntil: "commit" });
        await page.waitForURL(STORES[store]);
        await expect(page).toHaveTitle("store");
        // In place of the page, so Back leads to where the visitor came from.
        await page.goBack();
        await expect(page).toHaveURL(new RegExp(`${from}$`));
      } finally {
        await context.close();
      }
    });

for (const locale of ["ar", "en"] as const)
  test(`HarmonyOS NEXT, which runs no Android apps, gets ${at(locale)} without the QR code`, async ({
    browser,
  }) => {
    const context = await phone(browser, ua.harmonyNext, { touchPoints: 10 });
    try {
      const page = await context.newPage();
      await standInForStores(page);
      await page.goto(at(locale));
      await page.waitForLoadState("networkidle");
      await expect(page).toHaveURL(new RegExp(`${at(locale)}$`));
      for (const store of stores)
        await expect(
          page.getByRole("link", { name: texts[locale].badges[store] }),
        ).toHaveAttribute("href", STORES[store]);
      // A phone has no use for a code it would scan itself.
      await expect(
        page.getByRole("img", { name: texts[locale].qr }),
      ).toBeHidden();
      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(scrollWidth).toBe(clientWidth);
    } finally {
      await context.close();
    }
  });

for (const locale of ["ar", "en"] as const)
  test(`a computer gets ${at(locale)}: the three stores, and a QR code of the page`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on(
      "console",
      (message) => message.type() === "error" && errors.push(message.text()),
    );
    await standInForStores(page);
    await page.goto(at(locale));
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(new RegExp(`${at(locale)}$`));
    await expect(
      page.getByRole("heading", { level: 1, name: texts[locale].title }),
    ).toBeVisible();
    for (const store of stores) {
      const badge = page.getByRole("link", {
        name: texts[locale].badges[store],
      });
      await expect(badge).toBeVisible();
      await expect(badge).toHaveAttribute("href", STORES[store]);
      await expect(badge).toHaveAttribute("rel", "noopener noreferrer");
      expect(
        await badge
          .locator("img")
          .evaluate((image: HTMLImageElement) => image.naturalWidth),
      ).toBeGreaterThan(0);
      // Each opens its store in a tab of its own.
      const [tab] = await Promise.all([
        page.context().waitForEvent("page"),
        badge.click(),
      ]);
      await tab.waitForURL(STORES[store]);
      await tab.close();
    }
    await expect(page).toHaveURL(new RegExp(`${at(locale)}$`));
    await expect(
      page.getByRole("img", { name: texts[locale].qr }),
    ).toBeVisible();
    expect(await readQr(page, texts[locale].qr)).toBe(
      `https://mofied.com${at(locale)}`,
    );

    // The same page in the other language.
    const twin = locale === "ar" ? "en" : "ar";
    await page.locator(`header a[hreflang="${twin}"]`).click();
    await expect(page).toHaveURL(new RegExp(`${at(twin)}$`));
    await expect(page.locator("h1")).toHaveText(texts[twin].title);
    expect(errors).toEqual([]);
  });

test("/app stays out of search engines, and no other page sends anyone to a store", async ({
  page,
  request,
}) => {
  await page.goto("/app");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex",
  );
  for (const path of ["/", "/about", "/en/about"]) {
    const html = await (await request.get(path)).text();
    expect(html, path).not.toContain("location.replace");
  }
  // As Workers static assets do.
  const slash = await request.get("/app/", { maxRedirects: 0 });
  expect(slash.status()).toBe(307);
  expect(slash.headers().location).toBe("/app");
});
