import { expect, test, type Locator, type Page } from "@playwright/test";
import { media, plan, position, start } from "./fixtures";

const current = (page: Page) => page.locator('[data-page="current"]');
const links = {
  title: ".media-title a",
  speaker: ".speaker span",
  portrait: ".speaker img",
};
async function setup(page: Page, reminder = false) {
  const session = plan(10_000);
  if (!reminder)
    session.items = [media("first"), media("second"), media("third")];
  for (const item of session.items) {
    if (item.kind === "media")
      item.speaker.imageUrl = "https://portraits.example.test/speaker.svg";
  }
  const opened: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  // Exercise real browser link defaults/popups without navigating to third-party pages.
  await page.context().route("https://faqieh.com/**", async (route) => {
    opened.push(route.request().url());
    await route.fulfill({ body: "Link destination", contentType: "text/html" });
  });
  await page.route("https://portraits.example.test/**", (route) =>
    route.fulfill({
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36"><rect width="36" height="36" fill="gold"/></svg>',
      contentType: "image/svg+xml",
    }),
  );
  await start(page, session);
  return { opened, errors };
}
async function drag(page: Page, from: Locator, dy: number, dx = 0) {
  const box = (await from.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + Math.min(16, box.height / 2);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 12 });
}
async function settled(page: Page, id = "first") {
  await expect(page.locator(".session-pages")).toHaveAttribute(
    "data-phase",
    "idle",
  );
  await expect(page.locator("main")).toHaveAttribute("data-item-id", id);
}
async function opens(
  page: Page,
  target: Locator,
  action = () => target.click(),
) {
  await page.bringToFront();
  // Modified clicks may open a separate window without an opener/popup event.
  const popup = page.context().waitForEvent("page");
  await action();
  const destination = await popup;
  await destination.waitForURL((url) => /^https?:$/.test(url.protocol), {
    waitUntil: "commit",
  });
  const url = destination.url();
  await destination.close();
  await page.bringToFront();
  return url;
}

for (const width of [390, 1440]) {
  for (const [name, selector] of Object.entries(links)) {
    test(`swiping from ${name} follows the finger and advances exactly once at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 844 });
      const { opened, errors } = await setup(page);
      const video = await page.locator("video").elementHandle();
      await drag(page, current(page).locator(selector), -250);
      await expect(page.locator(".session-pages")).toHaveAttribute(
        "data-phase",
        "dragging",
      );
      expect((await current(page).boundingBox())!.y).toBeCloseTo(-250, 0);
      await expect(page.locator("video")).toHaveJSProperty("paused", true);
      await page.mouse.up();
      await settled(page, "second");
      await expect.poll(() => position(page)).toBeGreaterThan(0.2);
      expect(
        await video!.evaluate((v) => v === document.querySelector("video")),
      ).toBe(true);
      expect(opened).toEqual([]);
      expect(errors).toEqual([]);
    });
  }
}

for (const name of ["title", "speaker"] as const) {
  test(`a ${name} tap opens its link once without toggling manual pause, including after a cancelled drag`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const { opened } = await setup(page);
    await page.locator(".media-tap").click({ position: { x: 120, y: 200 } });
    const paused = await position(page);
    const target = current(page).locator(links[name]);
    await drag(page, target, -50);
    await page.waitForTimeout(180); // Release without flick velocity.
    await page.mouse.up();
    await settled(page);
    expect(opened).toEqual([]);
    await opens(page, target);
    expect(opened).toEqual([
      `https://faqieh.com/ar/${name === "title" ? "media" : "speakers"}/1`,
    ]);
    await expect(page.locator("main")).toHaveAttribute("data-status", "paused");
    expect(await position(page)).toBeCloseTo(paused, 1);
  });
}

test("horizontal movement and pointer cancellation neither open a link nor toggle playback", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { opened } = await setup(page);
  await page.locator(".media-tap").click({ position: { x: 120, y: 200 } });
  const target = current(page).locator(links.title);
  await drag(page, target, 5, -70);
  await page.mouse.up();
  await settled(page);
  await drag(page, target, -120);
  await page.locator(".session-pages").dispatchEvent("pointercancel");
  await page.mouse.up();
  await settled(page);
  await expect(page.locator("main")).toHaveAttribute("data-status", "paused");
  expect(opened).toEqual([]);
  await opens(page, target);
  expect(opened).toHaveLength(1);
});

test("CDP touch input swipes links, cancels a two-finger gesture and preserves the next tap", async ({
  page,
  browserName,
}) => {
  test.skip(
    browserName !== "chromium",
    "Real iOS touch is checked by XCTest; this case uses Chromium's input protocol",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  const { opened } = await setup(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true });
  const point = async (target: Locator) => {
    const box = (await target.boundingBox())!;
    return { x: box.x + box.width / 2, y: box.y + 16, id: 1 };
  };
  let origin = await point(current(page).locator(links.title));
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [origin],
  });
  for (let step = 1; step <= 10; step++) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ ...origin, y: origin.y - step * 25 }],
    });
    await page.waitForTimeout(16);
  }
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await settled(page, "second");
  expect(opened).toEqual([]);
  await page.locator(".media-tap").click({ position: { x: 120, y: 200 } });
  origin = await point(current(page).locator(links.speaker));
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [origin],
  });
  const moved = { ...origin, y: origin.y - 50 };
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [moved],
  });
  await expect(page.locator(".session-pages")).toHaveAttribute(
    "data-phase",
    "dragging",
  );
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [moved, { ...moved, x: moved.x - 40, id: 2 }],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await settled(page, "second");
  await expect(page.locator("main")).toHaveAttribute("data-status", "paused");
  expect(opened).toEqual([]);
  origin = await point(current(page).locator(links.speaker));
  const destination = await opens(
    page,
    current(page).locator(links.speaker),
    async () => {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [origin],
      });
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
    },
  );
  expect(destination).toBe("https://faqieh.com/ar/speakers/1");
});

test("metadata gestures preserve backwards history and the first-item boundary", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { opened } = await setup(page);
  await drag(page, current(page).locator(links.title), 70);
  await page.waitForTimeout(180);
  await page.mouse.up();
  await settled(page);
  await page.keyboard.press("ArrowDown");
  await settled(page, "second");
  const target = current(page).locator(links.speaker);
  await drag(page, target, 250);
  await page.mouse.up();
  await settled(page, "first");
  expect(opened).toEqual([]);
});

test("keyboard and modified link activation still work after a drag", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { opened } = await setup(page);
  const target = current(page).locator(links.title);
  await drag(page, target, -35);
  await page.waitForTimeout(180);
  await page.mouse.up();
  await settled(page);
  await target.focus();
  await opens(page, target, () => page.keyboard.press("Enter"));
  // Firefox's automation can strand a new window's first request when routing
  // is enabled, even for a plain anchor. Use an unmocked local destination.
  await page.context().unrouteAll({ behavior: "wait" });
  await page.unrouteAll({ behavior: "wait" });
  await target.evaluate((link: HTMLAnchorElement) => {
    link.href = "/favicon.ico";
  });
  const destination = await opens(page, target, () =>
    target.click({ modifiers: ["Shift"] }),
  );
  expect(new URL(destination).pathname).toBe("/favicon.ico");
  expect(opened).toHaveLength(1);
  await settled(page);
});

test("a metadata swipe enters the required reminder and its reading gestures cannot skip it", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { opened } = await setup(page, true);
  await drag(page, current(page).locator(links.title), -250);
  await page.mouse.up();
  await settled(page, "reminder");
  await page
    .getByRole("button", { name: "أوقف العدّ لمواصلة القراءة" })
    .click();
  await drag(page, page.locator(".reminder-body"), -160);
  await page.mouse.up();
  await settled(page, "reminder");
  expect(opened).toEqual([]);
});

test("pointer taps and keyboard activation of playback controls still toggle exactly once", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await setup(page);
  const tap = page.locator(".media-tap");
  await tap.click();
  await expect(page.locator("main")).toHaveAttribute("data-status", "paused");
  await tap.focus();
  await page.keyboard.press("Space");
  await expect(page.locator("main")).toHaveAttribute("data-status", "playing");
  await page.locator(".small-pause").click();
  await expect(page.locator("main")).toHaveAttribute("data-status", "paused");
});
