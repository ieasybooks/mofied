import { expect, test, type Page } from "@playwright/test";
import { media, plan, position, start } from "./fixtures";

const current = (page: Page) => page.locator('[data-page="current"]');
const preview = (page: Page) => page.locator('[data-page="preview"]');
async function drag(page: Page, dy: number, dx = 0) {
  await page.mouse.move(180, 400);
  await page.mouse.down();
  await page.mouse.move(180 + dx, 400 + dy, { steps: 8 });
}
async function settle(page: Page) {
  await expect(page.locator(".session-pages")).toHaveAttribute(
    "data-phase",
    "idle",
  );
}

test("drag follows the pointer, freezes accounting and cancels without recreating the player", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await start(page, plan(5000));
  const video = await page.locator("video").elementHandle();
  await drag(page, -80);
  await expect(page.locator(".session-pages")).toHaveAttribute(
    "data-phase",
    "dragging",
  );
  expect((await current(page).boundingBox())!.y).toBeCloseTo(-80, 0);
  expect((await preview(page).boundingBox())!.y).toBeCloseTo(764, 0);
  await expect(page.locator("video")).toHaveCount(1);
  await expect(page.locator("video")).toHaveJSProperty("paused", true);
  const before = await position(page);
  await page.waitForTimeout(350); // Hold a partial drag; it must neither count nor flick.
  expect(await position(page)).toBeCloseTo(before, 2);
  await page.mouse.up();
  await settle(page);
  await expect(page.locator("main")).toHaveAttribute("data-item-id", "first");
  expect(await video!.evaluate((element) => element.isConnected)).toBe(true);
  expect((await current(page).boundingBox())!.y).toBe(0);
  await expect(page.locator("video")).toHaveJSProperty("paused", false);
});

test("a committed drag settles before entering the required reminder, whose reading scroll stays independent", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const session = plan(10_000);
  const reminder = session.items[1]!;
  if (reminder.kind === "reminder")
    reminder.content.body = "تأمل في هذا المعنى. ".repeat(220);
  await start(page, session);
  await drag(page, -245);
  await expect(page.locator("main")).toHaveAttribute("data-item-id", "first");
  await expect(preview(page).locator(".countdown-line")).toHaveAttribute(
    "aria-valuenow",
    "10",
  );
  await page.mouse.up();
  await expect(page.locator(".session-pages")).toHaveAttribute(
    "data-phase",
    "settling",
  );
  await settle(page);
  await expect(page.locator("main")).toHaveAttribute(
    "data-item-id",
    "reminder",
  );
  await expect(page.locator("video")).toHaveCount(0);
  await page
    .getByRole("button", { name: "أوقف العدّ لمواصلة القراءة" })
    .click();
  const region = page.locator(".reminder-body");
  await region.hover();
  await page.mouse.wheel(0, 450);
  await expect
    .poll(() => region.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0);
  await page.keyboard.press("ArrowDown");
  await expect(page.locator("main")).toHaveAttribute(
    "data-item-id",
    "reminder",
  );
});

test("horizontal and cancelled gestures preserve manual pause; the first boundary springs back", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await start(page);
  await page.locator(".media-tap").click();
  await drag(page, 10, 100);
  await page.mouse.up();
  await settle(page);
  await expect(page.locator("main")).toHaveAttribute("data-status", "paused");
  await drag(page, 200);
  await expect(preview(page)).toHaveCount(0);
  expect((await current(page).boundingBox())!.y).toBeLessThan(70);
  await page.mouse.up();
  await settle(page);
  await drag(page, -200);
  await page.locator(".session-pages").dispatchEvent("pointercancel");
  await page.mouse.up();
  await settle(page);
  await expect(page.locator("main")).toHaveAttribute("data-item-id", "first");
  await expect(page.locator("video")).toHaveJSProperty("paused", true);
});

test("adjacent media stays a silent preview and rapid wheel inertia does not skip pages", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const session = plan();
  session.items = [media("first"), media("second"), media("third")];
  await start(page, session);
  const root = page.locator("main");
  await drag(page, -80);
  await expect(preview(page)).toHaveCount(1);
  await expect(page.locator("video")).toHaveCount(1);
  await page.waitForTimeout(150);
  await page.mouse.up();
  await settle(page);
  // Deliver one uninterrupted burst in the browser. Separate automation RPCs
  // can exceed the gesture idle gap when native compilers saturate the host.
  await root.evaluate((element) => {
    for (let index = 0; index < 14; index++)
      element.dispatchEvent(
        new WheelEvent("wheel", { deltaY: 100, bubbles: true }),
      );
  });
  await settle(page);
  await expect(root).toHaveAttribute("data-item-id", "second");
  await expect(page.locator("video")).toHaveCount(1);
  await page.keyboard.press("ArrowUp");
  await settle(page);
  await expect(root).toHaveAttribute("data-item-id", "first");
});

test("opening Info cancels a partial swipe and keeps playback paused", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await start(page);
  await drag(page, -150);
  await page
    .getByRole("button", { name: "عن التطبيق", exact: true })
    .evaluate((button: HTMLButtonElement) => button.click());
  await page.mouse.up();
  await settle(page);
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator("main")).toHaveAttribute("data-item-id", "first");
  await expect(page.locator("video")).toHaveJSProperty("paused", true);
});

for (const locale of ["ar", "en"] as const)
  test(`Info subpages slide forward/back in ${locale} and hide inactive controls`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await start(page);
    await page.getByRole("button", { name: "عن التطبيق", exact: true }).click();
    if (locale === "en")
      await page.getByRole("button", { name: /اللغة/ }).click();
    const label = locale === "ar" ? "سياسة الخصوصية" : "Privacy policy";
    const back = locale === "ar" ? "رجوع" : "Back";
    const entry = page.getByRole("button", { name: label, exact: true });
    const detail = page.locator(".about-page").nth(1);
    // Arm before the click: Playwright's post-click settling can otherwise
    // consume the very animation frames this regression is meant to inspect.
    await entry.evaluate((button) => {
      const target = document.querySelectorAll(".about-page")[1]!;
      (window as any).__infoFrames = new Promise<number[]>((resolve) => {
        button.addEventListener(
          "click",
          () => {
            const values: number[] = [];
            const start = performance.now();
            const sample = () => {
              values.push(
                new DOMMatrixReadOnly(getComputedStyle(target).transform).m41,
              );
              if (performance.now() - start < 350)
                requestAnimationFrame(sample);
              else resolve(values);
            };
            requestAnimationFrame(sample);
          },
          { once: true },
        );
      });
    });
    await entry.click();
    const samples = await page.evaluate(
      () => (window as any).__infoFrames as Promise<number[]>,
    );
    const width = (await detail.boundingBox())!.width;
    expect(
      samples.some((x) =>
        locale === "ar" ? x < -1 && x > -width : x > 1 && x < width,
      ),
    ).toBe(true);
    expect(Math.abs(samples.at(-1)!)).toBeLessThan(1);
    await expect(
      page.getByRole("button", { name: back, exact: true }),
    ).toBeFocused();
    await expect(entry).toHaveCount(0);
    await page.getByRole("button", { name: back, exact: true }).click();
    await expect(entry).toBeFocused();
    await expect(page.locator("video")).toHaveJSProperty("paused", true);
  });

test("reduced motion settles paging and Info immediately without losing keyboard navigation", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await start(page, plan(5000));
  await page.keyboard.press("ArrowDown");
  await settle(page);
  await expect(page.locator("main")).toHaveAttribute(
    "data-item-id",
    "reminder",
  );
  await page.getByRole("button", { name: "عن التطبيق", exact: true }).click();
  await page
    .getByRole("button", { name: "سياسة الخصوصية", exact: true })
    .click();
  expect(
    await page
      .locator(".about-page")
      .nth(1)
      .evaluate((element) => getComputedStyle(element).transitionDuration),
  ).toBe("0s");
  await expect(
    page.getByRole("button", { name: "رجوع", exact: true }),
  ).toBeFocused();
});
