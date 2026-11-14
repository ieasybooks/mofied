import { test, expect } from "@playwright/test";
import { realBrowser } from "./real-browser";
import {
  audiblePolicy,
  media,
  plan,
  start,
  finishMedia,
  position,
} from "./fixtures";

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

test("English remaining time reads number-first on desktop and phone, including behind Info", async ({
  page,
}) => {
  const session = plan();
  session.policy.maxActiveMs = 480_000;
  await start(page, session);
  await page.getByRole("button", { name: "عن التطبيق", exact: true }).click();
  await page.getByRole("button", { name: /اللغة/ }).click();
  await page.evaluate(() => document.fonts.ready);
  const label = page.locator(".budget > span");
  const checkOrder = async () => {
    await expect(label).toHaveText("8 minutes left");
    const positions = await label.evaluate((element) => {
      const text = element.textContent!;
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      let offset = 0;
      const positions: Record<string, number> = {};
      let node: Node | null;
      while ((node = walker.nextNode())) {
        for (const token of ["8", "minutes left"]) {
          const index = text.indexOf(token) - offset;
          if (index >= 0 && index + token.length <= node.textContent!.length) {
            const range = document.createRange();
            range.setStart(node, index);
            range.setEnd(node, index + token.length);
            positions[token] = range.getBoundingClientRect().x;
          }
        }
        offset += node.textContent!.length;
      }
      return positions;
    });
    expect(positions["8"]).toBeLessThan(positions["minutes left"]!);
  };
  for (const width of [1280, 375]) {
    await page.setViewportSize({ width, height: 800 });
    await checkOrder();
  }
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await checkOrder();
  await page.setViewportSize({ width: 1280, height: 800 });
  await checkOrder();
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
  await expect(
    page.getByText("Reminder text source", { exact: true }),
  ).toHaveCount(0);
  const reference = await page.locator(".citation").evaluate((element) => {
    const node = element.firstChild!;
    const text = node.textContent!;
    const positions = ["١٠", "١٢"].map((number) => {
      const start = text.indexOf(number);
      const range = document.createRange();
      range.setStart(node, start);
      range.setEnd(node, start + number.length);
      return range.getBoundingClientRect().x;
    });
    return { text: text.replace(/[\u200E\u2066\u2069]/g, ""), positions };
  });
  expect(reference.text).toBe("الأحاديث ١٠ - ١٢");
  expect(reference.positions[0]).toBeLessThan(reference.positions[1]!);
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
  await expect(page.locator("video")).toBeHidden();
  await expect(page.locator("video")).not.toHaveAttribute("src");
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
    // Chrome may already allow sound; otherwise activate it with a gesture.
    const enable = page.getByRole("button", {
      name: "تشغيل الصوت",
      exact: true,
    });
    if (await enable.count()) await enable.click();
    await expect(page.locator("video")).toHaveJSProperty("muted", false);
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

test("a buffered stalled event keeps playing and counting beyond the recovery timeout", async ({
  page,
}) => {
  test.setTimeout(40_000);
  const session = plan();
  session.replacements = [media("spare")];
  await start(page, session);
  await expect.poll(() => position(page)).toBeGreaterThan(0.5);
  const readiness = await page
    .locator("video")
    .evaluate((video: HTMLVideoElement) => {
      // Keep the 12-second local clip playing past the 20-second watchdog. This
      // exercises real decoded playback with the native-HLS buffered-stalled sequence.
      video.loop = true;
      video.dispatchEvent(new Event("stalled"));
      return { readyState: video.readyState, paused: video.paused };
    });
  expect(readiness.readyState).toBeGreaterThanOrEqual(3);
  expect(readiness.paused).toBe(false);
  await expect(page.locator("main")).toHaveAttribute("data-status", "playing");
  await page.waitForTimeout(22_000);
  await expect(page.locator("main")).toHaveAttribute("data-item-id", "first");
  await expect(page.locator("main")).toHaveAttribute("data-status", "playing");
  await expect(page.locator(".player-status")).toHaveCount(0);
  expect(
    Number(await page.locator("main").getAttribute("data-active-ms")),
  ).toBeGreaterThan(19_000);
  expect(
    await page.evaluate(() =>
      sessionStorage.getItem("mofied.session.v1.development"),
    ),
  ).toBeNull();
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

test("mobile overlay keeps sound, tap and swipe navigation accessible without extra controls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await audiblePolicy(page);
  await start(page, plan(5000));
  await expect(page.locator(".sound-hint")).toBeVisible();
  expect(
    await page
      .locator(".media-title a")
      .evaluate((element) => getComputedStyle(element).webkitLineClamp),
  ).toBe("2");
  await expect(
    page.getByRole("button", { name: "المادة التالية", exact: true }),
  ).toHaveCount(1);
  const sound = page.getByRole("button", { name: "تشغيل الصوت", exact: true });
  await expect(sound).toHaveCount(1);
  await sound.click();
  await expect(page.locator("video")).toHaveJSProperty("muted", false);
  await expect(page.locator("main")).toHaveAttribute("data-status", "playing");

  // The decorative fade must not intercept taps or swipes above the links.
  const overlay = await page.locator(".media-bottom").boundingBox();
  const gestureY = overlay!.y + 40;
  await page.mouse.click(180, gestureY);
  await expect(page.locator("main")).toHaveAttribute("data-status", "paused");
  await page.getByRole("button", { name: "كتم الصوت", exact: true }).click();
  await expect(page.locator("video")).toHaveJSProperty("muted", true);
  await expect(page.locator("main")).toHaveAttribute("data-status", "paused");
  await page.mouse.click(180, gestureY);
  await expect(page.locator("main")).toHaveAttribute("data-status", "playing");
  await page.mouse.move(180, gestureY);
  await page.mouse.down();
  await page.mouse.move(180, Math.max(50, gestureY - 260), { steps: 8 });
  await page.mouse.up();
  await expect(page.locator("main")).toHaveAttribute(
    "data-item-id",
    "reminder",
  );
  await expect(
    page.getByRole("button", { name: /^(تشغيل الصوت|كتم الصوت)$/ }),
  ).toHaveCount(0);
  const overflowing = await page.evaluate(
    () => document.documentElement.scrollWidth > innerWidth,
  );
  expect(overflowing).toBe(false);
});
