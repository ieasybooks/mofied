import { expect, test, type Page } from "@playwright/test";
import {
  finishMedia,
  media,
  plan,
  position,
  serveMp4,
  start,
} from "./fixtures";

const shared = () => {
  const session = plan(1200);
  session.items[0] = { ...media("first"), mediaId: "4321" };
  return session;
};

async function stubShare(page: Page, outcome: "shared" | "dismissed") {
  await page.addInitScript((outcome) => {
    const calls: ShareData[] = [];
    Object.assign(window, { shareCalls: calls });
    navigator.share = async (data?: ShareData) => {
      calls.push(data!);
      if (outcome === "dismissed")
        throw new DOMException("Share dismissed", "AbortError");
    };
  }, outcome);
}

test("desktop share copies the media's link without interrupting playback", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: "http://127.0.0.1:5173",
  });
  await start(page, shared());
  await expect(page.locator(".mobile-share")).toBeHidden();
  await page
    .getByRole("button", { name: "مشاركة المادة", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("تم نسخ الرابط");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "https://mofied.com/?start=4321",
  );
  await expect(page.locator("main")).toHaveAttribute("data-status", "playing");
  const before = await position(page);
  await expect.poll(() => position(page)).toBeGreaterThan(before + 0.2);
  await expect(page.locator(".share-notice")).toHaveCount(0, {
    timeout: 4000,
  });
});

test("a phone shares through the system sheet from the header", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await stubShare(page, "shared");
  await start(page, shared());
  await expect(page.locator(".rail-share")).toBeHidden();
  const header = page.locator(".session-header .mobile-share");
  await expect(header).toBeVisible();
  await header.click();
  expect(await page.evaluate(() => (window as any).shareCalls)).toEqual([
    { text: `${media("first").title}\nhttps://mofied.com/?start=4321` },
  ]);
  await expect(page.locator(".share-notice")).toHaveCount(0);
  await expect(page.locator("main")).toHaveAttribute("data-status", "playing");
});

test("dismissing the share sheet neither copies nor reports anything", async ({
  page,
}) => {
  await stubShare(page, "dismissed");
  await start(page, shared());
  await page
    .getByRole("button", { name: "مشاركة المادة", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => (window as any).shareCalls.length))
    .toBe(1);
  await expect(page.locator(".share-notice")).toHaveCount(0);
});

test("reminders and the ending offer no share button", async ({ page }) => {
  await start(page, shared());
  await page.keyboard.press("ArrowDown");
  await expect(page.locator("main")).toHaveAttribute(
    "data-item-id",
    "reminder",
  );
  await expect(
    page.getByRole("button", { name: "مشاركة المادة", exact: true }),
  ).toHaveCount(0);
  // The reminder runs out into the last media, which can be shared again.
  await expect(page.locator("main")).toHaveAttribute("data-item-id", "last");
  await expect(page.locator("main")).toHaveAttribute("data-status", "playing");
  await expect(
    page.getByRole("button", { name: "مشاركة المادة", exact: true }),
  ).not.toHaveCount(0);
  await finishMedia(page);
  await expect(page.locator("main")).toHaveAttribute("data-status", "ended");
  await expect(
    page.getByRole("button", { name: "مشاركة المادة", exact: true }),
  ).toHaveCount(0);
});

test("a share link opens the session from that media, keeps it through Retry and then clears the address", async ({
  page,
}) => {
  const requests: string[] = [];
  await page.route("**/__test/session*", (route) => {
    requests.push(new URL(route.request().url()).search);
    return requests.length === 1
      ? route.fulfill({ status: 503 })
      : route.fulfill({ json: shared() });
  });
  await serveMp4(page);
  await page.goto("/?test-session=1&start=4321");
  await page.getByRole("button", { name: "إعادة المحاولة" }).click();
  await expect(page.locator("main")).toHaveAttribute("data-status", "playing");
  expect(requests).toEqual(["?start=4321", "?start=4321"]);
  expect(new URL(page.url()).search).toBe("?test-session=1");
});

test("a malformed start is ignored and the address is cleaned", async ({
  page,
}) => {
  const requests: string[] = [];
  await page.route("**/__test/session*", (route) => {
    requests.push(new URL(route.request().url()).search);
    return route.fulfill({ json: plan() });
  });
  await serveMp4(page);
  await page.goto("/?start=12abc&test-session=1");
  await expect(page.locator("main")).toHaveAttribute("data-status", "playing");
  expect(requests).toEqual([""]);
  expect(new URL(page.url()).search).toBe("?test-session=1");
});

test("Info, sound and share leave the time pill room on a 320px phone", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await start(page, shared());
  const controls = (await page.locator(".header-controls").boundingBox())!;
  const budget = (await page.locator(".budget").boundingBox())!;
  expect(budget.x - (controls.x + controls.width)).toBeGreaterThanOrEqual(8);
  expect(budget.x + budget.width).toBeLessThanOrEqual(300);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
});
