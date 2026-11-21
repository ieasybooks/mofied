import { expect, test } from "@playwright/test";
import { readdirSync } from "node:fs";
import { inline, pageIds, pagePath, pages } from "@mofied/design";
import { plan, serveMp4 } from "./fixtures";

const api = "https://faqieh.com/api/v1/mofied/session?locale=ar";

test("install and social metadata are readable without JavaScript", async ({
  browser,
  request,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto("http://127.0.0.1:8787/?utm_source=shared");
    const manifestUrl = await page
      .locator('link[rel="manifest"]')
      .getAttribute("href");
    const response = await request.get(manifestUrl!);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("manifest+json");
    const manifest = await response.json();
    expect(manifest.name).toBe("مفيد");
    expect(manifest.short_name).toBe("مفيد");
    expect(manifest.id).toBe("/");
    expect(manifest.start_url).toBe("/");
    expect(manifest.scope).toBe("/");
    expect(manifest.display).toBe("standalone");
    expect(
      manifest.icons.some(
        (icon: { purpose: string }) => icon.purpose === "maskable",
      ),
    ).toBe(true);
    await expect(
      page.locator('meta[name="apple-mobile-web-app-title"]'),
    ).toHaveAttribute("content", "مفيد");
    await expect(
      page.locator('meta[name="apple-mobile-web-app-capable"]'),
    ).toHaveAttribute("content", "yes");
    // Safari's own banner works before JavaScript runs.
    await expect(page.locator('meta[name="apple-itunes-app"]')).toHaveAttribute(
      "content",
      "app-id=6831969465",
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      "https://mofied.com/",
    );
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
      "content",
      "https://mofied.com/",
    );
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
      "content",
      "summary_large_image",
    );
    const og = await page
      .locator('meta[property="og:image"]')
      .getAttribute("content");
    expect(og).toBe("https://mofied.com/og-card.png");
    await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute(
      "content",
      og!,
    );
    await expect(
      page.locator('meta[property="og:image:alt"]'),
    ).not.toHaveAttribute("content", "");

    const appleIcon = await page
      .locator('link[rel="apple-touch-icon"]')
      .getAttribute("href");
    for (const { src, sizes } of [
      ...manifest.icons,
      { src: appleIcon, sizes: "180x180" },
      { src: new URL(og!).pathname, sizes: "1200x630" },
    ]) {
      const asset = await request.get(src);
      expect(asset.status()).toBe(200);
      expect(asset.headers()["content-type"]).toContain("image/png");
      expect(asset.headers()["cache-control"]).not.toContain("immutable");
      const dimensions = await page.evaluate(async (src) => {
        const image = new Image();
        image.src = src;
        await image.decode();
        return `${image.naturalWidth}x${image.naturalHeight}`;
      }, src);
      expect(dimensions).toBe(sizes);
    }
  } finally {
    await context.close();
  }
});

test("Chromium can install the app while automatic install prompts are suppressed", async ({
  playwright,
  launchOptions,
  headless,
  baseURL,
}) => {
  // Playwright's usual contexts are off the record, where headed Chromium
  // won't install apps ("in-incognito"), so this uses a temporary profile.
  const context = await playwright.chromium.launchPersistentContext("", {
    ...launchOptions,
    headless,
    baseURL,
  });
  try {
    const page = context.pages()[0] ?? (await context.newPage());
    await page.route(api, (route) => route.fulfill({ json: plan() }));
    await serveMp4(page);
    await page.goto("/");
    await expect(page.locator("main")).toHaveAttribute(
      "data-status",
      "playing",
    );
    const cdp = await context.newCDPSession(page);
    const manifest = await cdp.send("Page.getAppManifest");
    expect(manifest.errors).toEqual([]);
    expect(manifest.url).toBe("http://127.0.0.1:8787/manifest.webmanifest");
    await expect
      .poll(
        async () =>
          (await cdp.send("Page.getInstallabilityErrors")).installabilityErrors,
      )
      .toEqual([]);

    const banner = await page.evaluate(() => {
      const event = new Event("beforeinstallprompt", { cancelable: true });
      let prompts = 0;
      Object.assign(event, {
        prompt: () => {
          prompts++;
        },
      });
      window.dispatchEvent(event);
      return { prevented: event.defaultPrevented, prompts };
    });
    expect(banner).toEqual({ prevented: true, prompts: 0 });
  } finally {
    await context.close();
  }
});

const origin = "http://127.0.0.1:8787";
const plain = (paragraph: string) =>
  inline(paragraph)
    .map((part) => part.text)
    .join("");

for (const locale of ["ar", "en"] as const)
  for (const id of pageIds) {
    const path = pagePath(id, locale);
    const source = pages[locale][id];
    const twin = locale === "ar" ? "en" : "ar";
    test(`${path} serves the ${locale} ${id} page without a redirect, JavaScript or a session`, async ({
      browser,
      request,
    }) => {
      // Stores and links reach it directly: no redirect to /privacy/.
      const direct = await request.get(path, { maxRedirects: 0 });
      expect(direct.status()).toBe(200);
      expect(direct.headers()["content-type"]).toContain("text/html");
      expect(direct.headers()["cache-control"]).toContain("max-age=0");

      const context = await browser.newContext({ javaScriptEnabled: false });
      const page = await context.newPage();
      const requests: string[] = [];
      page.on("request", (request) => requests.push(request.url()));
      try {
        for (const width of [320, 1440]) {
          await page.setViewportSize({ width, height: 800 });
          const response = await page.goto(path);
          expect(response?.status()).toBe(200);
          expect(response?.request().redirectedFrom()).toBeNull();
          await expect(page.locator("html")).toHaveAttribute("lang", locale);
          await expect(page.locator("html")).toHaveAttribute(
            "dir",
            locale === "ar" ? "rtl" : "ltr",
          );
          await expect(
            page.getByRole("heading", { level: 1, name: source.title }),
          ).toBeVisible();
          expect(
            await page
              .locator("header img")
              .evaluate((img: HTMLImageElement) => img.naturalWidth),
          ).toBeGreaterThan(0);
          // Nothing scrolls sideways. clientWidth is the viewport less any
          // classic scrollbar, which headed Chromium on Linux shows.
          const { scrollWidth, clientWidth } = await page.evaluate(() => ({
            scrollWidth: document.documentElement.scrollWidth,
            clientWidth: document.documentElement.clientWidth,
          }));
          expect(scrollWidth).toBe(clientWidth);
          expect(clientWidth).toBeGreaterThan(width - 20);
          await expect(page.locator("video")).toHaveCount(0);
        }
        await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
          "href",
          `https://mofied.com${path}`,
        );

        // The shared text, heading for heading and paragraph for paragraph.
        await expect(page.locator("article h2")).toHaveText(
          source.sections.flatMap((section) => section.heading ?? []),
        );
        await expect(page.locator("article p:not(.date)")).toHaveText(
          source.sections.flatMap((section) => section.paragraphs.map(plain)),
        );
        await expect(page.locator("article .date")).toHaveText(
          source.updated ? [source.updated] : [],
        );
        // Its links, with this language's pages for links to the others.
        const links = source.sections.flatMap((section) =>
          section.paragraphs.flatMap((paragraph) =>
            inline(paragraph).flatMap((part) =>
              "page" in part
                ? [pagePath(part.page, locale)]
                : "href" in part
                  ? [part.href]
                  : [],
            ),
          ),
        );
        expect(
          await page
            .locator("article a")
            .evaluateAll((links) =>
              links.map((link) => link.getAttribute("href")),
            ),
        ).toEqual(links);

        // It ends with the other three pages in its language.
        const others = pageIds.filter((other) => other !== id);
        const footer = page.locator("footer a");
        await expect(footer).toHaveText(
          others.map((other) => pages[locale][other].title),
        );
        expect(
          await footer.evaluateAll((links) =>
            links.map((link) => link.getAttribute("href")),
          ),
        ).toEqual(others.map((other) => pagePath(other, locale)));
        // Each link on the site answers itself, without a redirect.
        const local = await page
          .locator('a[href^="/"]')
          .evaluateAll((links) =>
            links.map((link) => link.getAttribute("href")!),
          );
        for (const href of new Set(local)) {
          const response = await request.get(href, { maxRedirects: 0 });
          expect(response.status(), href).toBe(200);
        }

        // The same page in the other language.
        const other = page.locator(`header a[hreflang="${twin}"]`);
        await expect(other).toHaveAttribute("href", pagePath(id, twin));
        await other.click();
        await expect(page).toHaveURL(`${origin}${pagePath(id, twin)}`);
        await expect(page.locator("html")).toHaveAttribute("lang", twin);
        await expect(page.locator("h1")).toHaveText(pages[twin][id].title);
        await expect(
          page.locator(`header a[hreflang="${locale}"]`),
        ).toHaveAttribute("href", path);
        expect(requests.some((url) => url.includes("/session"))).toBe(false);
      } finally {
        await context.close();
      }
    });
  }

test("the /privacy/ and /support/ the stores linked redirect to /privacy and /support", async ({
  page,
  request,
}) => {
  for (const [path, title] of [
    ["/privacy", pages.ar.privacy.title],
    ["/support", pages.ar.support.title],
  ]) {
    const old = await request.get(`${path}/`, { maxRedirects: 0 });
    expect(old.status()).toBe(307);
    expect(new URL(old.headers().location!, origin).pathname).toBe(path);
    const response = await page.goto(`${path}/`);
    expect(response?.status()).toBe(200);
    expect(page.url()).toBe(`${origin}${path}`);
    await expect(page.locator("h1")).toHaveText(title!);
  }
});

test("/app sends a phone on to its store, and gives a computer the stores' badges", async ({
  browser,
  page,
  request,
}) => {
  for (const path of ["/app", "/en/app"]) {
    // Served as the page itself: phones leave from the page, not the server.
    const direct = await request.get(path, { maxRedirects: 0 });
    expect(direct.status()).toBe(200);
    expect(direct.headers()["content-type"]).toContain("text/html");
    expect(direct.headers()["cache-control"]).toContain("max-age=0");
    const html = await direct.text();
    expect(html).toContain("location.replace(");
    expect(html).toContain('<meta name="robots" content="noindex" />');
    // The badges are fingerprinted assets, cached for good.
    const badges = [...html.matchAll(/<img src="(\/assets\/[^"]+)"/g)].map(
      (match) => match[1]!,
    );
    expect(badges).toHaveLength(3);
    for (const badge of badges) {
      const asset = await request.get(badge);
      expect(asset.status()).toBe(200);
      expect(asset.headers()["content-type"]).toMatch(/^image\//);
      expect(asset.headers()["cache-control"]).toBe(
        "public, max-age=31536000, immutable",
      );
    }
    const slash = await request.get(`${path}/`, { maxRedirects: 0 });
    expect(slash.status()).toBe(307);
    expect(new URL(slash.headers().location!, origin).pathname).toBe(path);
  }

  await page.goto("/app");
  await page.waitForLoadState("networkidle");
  expect(page.url()).toBe(`${origin}/app`);
  for (const image of await page.locator(".stores img").all())
    expect(
      await image.evaluate((image: HTMLImageElement) => image.naturalWidth),
    ).toBeGreaterThan(0);

  const play = "https://play.google.com/store/apps/details?id=com.mofied.app";
  const phone = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36",
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    await phone.route(/^https:\/\/play\.google\.com\//, (route) =>
      route.fulfill({ contentType: "text/html", body: "<title>store</title>" }),
    );
    const tab = await phone.newPage();
    await tab.goto(`${origin}/app`, { waitUntil: "commit" });
    await tab.waitForURL(play);
  } finally {
    await phone.close();
  }
});

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

test("production API loading and fresh sessions on refresh work under Cloudflare", async ({
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
  await page.reload();
  await expect(page.locator("main")).toHaveAttribute("data-status", "playing");
  await expect(page.locator("video")).toHaveJSProperty("paused", false);
  expect(calls).toBe(2);
  expect(
    await page.evaluate(() =>
      sessionStorage.getItem("mofied.session.v1.production"),
    ),
  ).toBeNull();
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

test("app association files are JSON at the apex, without redirects", async ({
  request,
}) => {
  const apple = await request.get("/.well-known/apple-app-site-association", {
    maxRedirects: 0,
  });
  expect(apple.status()).toBe(200);
  expect(apple.headers()["content-type"]).toBe("application/json");
  const details = (await apple.json()).applinks.details;
  expect(details).toEqual([
    expect.objectContaining({
      appIDs: ["KJ597HLVMB.com.mofied.app"],
      components: [expect.objectContaining({ "/": "/" })],
    }),
  ]);

  const android = await request.get("/.well-known/assetlinks.json", {
    maxRedirects: 0,
  });
  expect(android.status()).toBe(200);
  expect(android.headers()["content-type"]).toContain("application/json");
  expect(await android.json()).toEqual([
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: "com.mofied.app",
        sha256_cert_fingerprints: [
          "2C:F5:F2:29:E9:35:C4:BA:6A:D9:D4:38:54:A1:8B:BB:4A:41:23:8E:AB:AA:CD:40:D1:EA:49:1A:D2:E9:AB:37",
        ],
      },
    },
  ]);
});

test("a share link asks Faqieh for that media first, then leaves a plain address", async ({
  page,
}) => {
  const requests: string[] = [];
  await page.route(
    (url) => url.href.startsWith("https://faqieh.com/api/v1/mofied/session"),
    (route) => {
      requests.push(route.request().url());
      return route.fulfill({ json: plan() });
    },
  );
  await serveMp4(page);
  await page.goto("/?start=4321&utm_source=whatsapp");
  await expect(page.locator("main")).toHaveAttribute("data-status", "playing");
  expect(requests).toEqual([`${api}&start=4321`]);
  expect(new URL(page.url()).search).toBe("?utm_source=whatsapp");
  await page.reload();
  await expect(page.locator("main")).toHaveAttribute("data-status", "playing");
  expect(requests).toEqual([`${api}&start=4321`, api]);
});
