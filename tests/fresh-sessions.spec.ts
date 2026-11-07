import { expect, test } from "@playwright/test";
import { legacySession, media, plan, position, serveMp4 } from "./fixtures";

const api = "https://api.example.test/session";
const origin = "http://127.0.0.1:4173/";

test("valid legacy progress is removed without reading it or writing new progress", async ({
  page,
}) => {
  await page.addInitScript((saved) => {
    sessionStorage.setItem("mofied.session.v1.production", saved);
    sessionStorage.setItem("mofied.session.v1.development", saved);
    sessionStorage.setItem("unrelated", "keep");
    const reads: string[] = [],
      writes: string[] = [];
    const get = Storage.prototype.getItem,
      set = Storage.prototype.setItem;
    Storage.prototype.getItem = function (key) {
      reads.push(key);
      return get.call(this, key);
    };
    Storage.prototype.setItem = function (key, value) {
      writes.push(key);
      return set.call(this, key, value);
    };
    Object.assign(window, { storageAccess: { reads, writes } });
  }, legacySession());
  let calls = 0;
  await page.route(api, (route) => {
    calls++;
    return route.fulfill({ json: { ...plan(), items: [media("fresh")] } });
  });
  await serveMp4(page);
  await page.goto(origin);
  await expect(page.locator("main")).toHaveAttribute("data-item-id", "fresh");
  await expect.poll(() => position(page)).toBeGreaterThan(2);
  expect(await position(page)).toBeLessThan(5);
  await page.locator(".media-tap").click();
  await page.evaluate(() =>
    window.dispatchEvent(new PageTransitionEvent("pagehide")),
  );
  expect(await page.evaluate(() => (window as any).storageAccess)).toEqual({
    reads: [],
    writes: [],
  });
  expect(await page.evaluate(() => ({ ...sessionStorage }))).toEqual({
    unrelated: "keep",
  });
  expect(calls).toBe(1);
});

test("a failed refresh shows Retry instead of replaying the previous session", async ({
  page,
}) => {
  let calls = 0;
  await page.route(api, (route) => {
    calls++;
    return calls === 2
      ? route.fulfill({ status: 503 })
      : route.fulfill({
          json: {
            ...plan(),
            id: `session-${calls}`,
            items: [media(`fresh-${calls}`)],
          },
        });
  });
  await serveMp4(page);
  await page.goto(origin);
  await expect.poll(() => position(page)).toBeGreaterThan(0.3);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "تعذّر تحميل الجلسة" }),
  ).toBeVisible();
  await expect(page.locator("video")).toHaveCount(0);
  await page.getByRole("button", { name: "إعادة المحاولة" }).click();
  await expect(page.locator("main")).toHaveAttribute("data-item-id", "fresh-3");
  await expect.poll(() => position(page)).toBeGreaterThan(0.3);
  expect(calls).toBe(3);
});

test("Info, manual pause and tab visibility do not request another session", async ({
  page,
}) => {
  let calls = 0;
  await page.route(api, (route) => {
    calls++;
    return route.fulfill({ json: plan() });
  });
  await serveMp4(page);
  await page.goto(origin);
  await expect.poll(() => position(page)).toBeGreaterThan(0.3);
  await page.locator(".media-tap").click();
  const paused = await position(page);
  await page.getByRole("button", { name: "عن التطبيق", exact: true }).click();
  await page.getByRole("button", { name: "إغلاق", exact: true }).click();
  await page.evaluate(() => {
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(
      new PageTransitionEvent("pageshow", { persisted: false }),
    );
  });
  await expect(page.locator("main")).toHaveAttribute("data-status", "paused");
  await expect.poll(() => position(page)).toBeCloseTo(paused, 1);
  expect(calls).toBe(1);
});

test("session loading and refresh work when browser storage is unavailable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    for (const method of ["getItem", "setItem", "removeItem"] as const)
      Storage.prototype[method] = () => {
        throw new DOMException("Disabled", "SecurityError");
      };
  });
  let calls = 0;
  await page.route(api, (route) => {
    calls++;
    return route.fulfill({ json: plan() });
  });
  await serveMp4(page);
  await page.goto(origin);
  await expect.poll(() => position(page)).toBeGreaterThan(0.3);
  await page.reload();
  await expect.poll(() => position(page)).toBeGreaterThan(0.3);
  expect(calls).toBe(2);
});

test("a reminder or ending does not survive a refresh", async ({ page }) => {
  let calls = 0;
  await page.route(api, (route) => {
    calls++;
    return route.fulfill({
      json: {
        ...plan(500),
        items: calls === 1 ? [plan(500).items[1]!] : [media("new-opening")],
      },
    });
  });
  await serveMp4(page);
  await page.goto(origin);
  await expect(page.locator("main")).toHaveAttribute("data-status", "ended");
  await page.reload();
  await expect(page.locator("main")).toHaveAttribute(
    "data-item-id",
    "new-opening",
  );
  await expect.poll(() => position(page)).toBeGreaterThan(0.3);
  expect(calls).toBe(2);
});
