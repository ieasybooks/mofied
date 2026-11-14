import { expect, test, type Page } from "@playwright/test";
import {
  audiblePolicy,
  finishMedia,
  media,
  plan,
  position,
  serveMp4,
  start,
} from "./fixtures";

const hint = (page: Page) => page.locator(".sound-hint");
const video = (page: Page) => page.locator("video");
const railButtons = (page: Page) =>
  page
    .locator(".control-rail button")
    .evaluateAll((buttons) =>
      buttons.map((button) => button.getBoundingClientRect().toJSON()),
    );

async function withheldStart(page: Page, session = plan()) {
  await audiblePolicy(page);
  await start(page, session);
  await expect(video(page)).toHaveJSProperty("muted", true);
  await expect(hint(page)).toBeVisible();
  await expect(hint(page)).toHaveText("اضغط لتشغيل الصوت");
}

test("withheld sound plays muted with an alert, and a tap on the picture restores it without pausing or moving the rail", async ({
  page,
}) => {
  await withheldStart(page);
  await expect(page.locator("main")).toHaveAttribute(
    "data-sound-withheld",
    "true",
  );
  await expect(
    page.getByRole("button", { name: "تشغيل الصوت", exact: true }),
  ).toBeVisible();
  // The rail no longer carries a label that disappears on unmute.
  await expect(page.locator(".control-rail p")).toHaveCount(0);
  const before = await railButtons(page);
  const frame = (await page.locator(".player-frame").first().boundingBox())!;
  const pill = (await hint(page).boundingBox())!;
  expect(pill.y - frame.y).toBeLessThan(40);

  await page.locator(".media-tap").click();
  await expect(video(page)).toHaveJSProperty("muted", false);
  await expect(hint(page)).toHaveCount(0);
  await expect(page.locator("main")).toHaveAttribute("data-status", "playing");
  const resumed = await position(page);
  await expect.poll(() => position(page)).toBeGreaterThan(resumed + 0.2);
  await expect(
    page.getByRole("button", { name: "كتم الصوت", exact: true }),
  ).toBeVisible();
  expect(await railButtons(page)).toEqual(before);

  // Once sound is back, a tap is an ordinary pause.
  await page.locator(".media-tap").click();
  await expect(page.locator("main")).toHaveAttribute("data-status", "paused");
  // Muting by choice shows no alert and keeps the rail in place too.
  await page.getByRole("button", { name: "كتم الصوت", exact: true }).click();
  await expect(video(page)).toHaveJSProperty("muted", true);
  await expect(hint(page)).toHaveCount(0);
  expect(await railButtons(page)).toEqual(before);
});

test("the alert itself restores sound and playback continues", async ({
  page,
}) => {
  await withheldStart(page);
  await hint(page).click();
  await expect(video(page)).toHaveJSProperty("muted", false);
  await expect(hint(page)).toHaveCount(0);
  await expect(page.locator("main")).toHaveAttribute("data-status", "playing");
  await expect(video(page)).toHaveJSProperty("paused", false);
});

test("the sound button brings withheld sound back instead of muting again", async ({
  page,
}) => {
  await withheldStart(page);
  await page.getByRole("button", { name: "تشغيل الصوت", exact: true }).click();
  await expect(video(page)).toHaveJSProperty("muted", false);
  await expect(hint(page)).toHaveCount(0);
  await expect(page.locator("main")).toHaveAttribute("data-status", "playing");
});

test("keyboard navigation restores sound and the next media plays audibly", async ({
  page,
}) => {
  const session = plan();
  session.items = [media("first"), media("second")];
  await withheldStart(page, session);
  await page.keyboard.press("ArrowDown");
  await expect(page.locator("main")).toHaveAttribute("data-item-id", "second");
  await expect(page.locator("main")).toHaveAttribute("data-status", "playing");
  await expect.poll(() => position(page)).toBeGreaterThan(0.3);
  await expect(video(page)).toHaveJSProperty("muted", false);
  await expect(hint(page)).toHaveCount(0);
});

test("on a phone the alert sits below the header and a swipe restores sound", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const session = plan();
  session.items = [media("first"), media("second")];
  await withheldStart(page, session);
  const header = (await page.locator(".session-header").boundingBox())!;
  const pill = (await hint(page).boundingBox())!;
  expect(pill.y).toBeGreaterThanOrEqual(header.y + header.height);
  expect(pill.x).toBeGreaterThanOrEqual(0);
  expect(pill.x + pill.width).toBeLessThanOrEqual(390);
  await page.mouse.move(195, 520);
  await page.mouse.down();
  await page.mouse.move(195, 200, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator("main")).toHaveAttribute("data-item-id", "second");
  await expect(page.locator("main")).toHaveAttribute("data-status", "playing");
  await expect.poll(() => position(page)).toBeGreaterThan(0.3);
  await expect(video(page)).toHaveJSProperty("muted", false);
  await expect(hint(page)).toHaveCount(0);
});

test("reminders hide the alert and keep sound withheld for the next media", async ({
  page,
}) => {
  await withheldStart(page, plan(1200));
  await finishMedia(page);
  await expect(page.locator("main")).toHaveAttribute(
    "data-item-id",
    "reminder",
  );
  await expect(hint(page)).toHaveCount(0);
  // Reminders are silent: a tap there does not spend the withheld sound.
  await page.locator(".reminder-body").click();
  await expect(page.locator("main")).toHaveAttribute("data-item-id", "last", {
    timeout: 5000,
  });
  await expect(page.locator("main")).toHaveAttribute("data-status", "playing");
  await expect(video(page)).toHaveJSProperty("muted", true);
  await expect(hint(page)).toBeVisible();
  await page.locator(".media-tap").click();
  await expect(video(page)).toHaveJSProperty("muted", false);
});

test("when even muted autoplay is refused, the start prompt plays with sound", async ({
  page,
}) => {
  await audiblePolicy(page, { muted: false });
  await page.route("**/__test/session", (route) =>
    route.fulfill({ json: plan() }),
  );
  await serveMp4(page);
  await page.goto("http://127.0.0.1:5173/?test-session=1");
  await expect(page.locator("main")).toHaveAttribute(
    "data-status",
    "autoplay-blocked",
  );
  await expect(hint(page)).toHaveCount(0);
  await page.locator(".player-message").click();
  await expect(page.locator("main")).toHaveAttribute("data-status", "playing");
  await expect(video(page)).toHaveJSProperty("muted", false);
  await expect(hint(page)).toHaveCount(0);
});

test("a browser that allows sound starts audibly with no alert", async ({
  page,
}) => {
  await start(page);
  await expect(video(page)).toHaveJSProperty("muted", false);
  await expect(hint(page)).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "كتم الصوت", exact: true }),
  ).toBeVisible();
});
