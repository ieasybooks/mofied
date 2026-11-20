import { test, expect } from "@playwright/test";
import { plan, start, serveMp4, position } from "./fixtures";

test("consecutive reminders start at the top while About and language preserve reading position", async ({
  page,
}) => {
  const session = plan(1500);
  const first = session.items[1]!;
  if (first.kind !== "reminder") throw new Error("Expected reminder");
  first.content.body =
    "بداية التذكير الأول. " +
    "التفكر في العلم والعمل به ينفع المرء في حياته. ".repeat(100);
  const second = {
    ...first,
    id: "second-reminder",
    durationMs: 60_000,
    content: {
      ...first.content,
      body: "بداية التذكير الثاني. " + first.content.body,
    },
  };
  session.items.splice(2, 0, second);
  await start(page, session);
  await page.keyboard.press("ArrowDown");
  await page
    .getByRole("button", { name: "أوقف العدّ لمواصلة القراءة", exact: true })
    .click();
  const reading = page.locator(".reminder-body");
  await reading.focus();
  await page.keyboard.press("End");
  // End scrolls asynchronously. Sample only after it reaches the bottom.
  await expect
    .poll(() =>
      reading.evaluate((el) =>
        Math.abs(el.scrollHeight - el.clientHeight - el.scrollTop),
      ),
    )
    .toBeLessThanOrEqual(1);
  await expect
    .poll(() => reading.evaluate((el) => el.scrollTop))
    .toBeGreaterThan(1000);
  const before = await reading.evaluate((el) => el.scrollTop);
  await page.getByRole("button", { name: "عن التطبيق", exact: true }).click();
  await page.getByRole("button", { name: /اللغة/ }).click();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect.poll(() => reading.evaluate((el) => el.scrollTop)).toBe(before);
  await page
    .getByRole("button", { name: "Resume countdown", exact: true })
    .click();
  await expect(page.locator("main")).toHaveAttribute("data-item-id", second.id);
  await expect.poll(() => reading.evaluate((el) => el.scrollTop)).toBe(0);
  await expect(reading).toContainText("بداية التذكير الثاني.");
});

for (const enlarged of [false, true]) {
  test(`ending first and last lines remain reachable in a short desktop window, enlarged=${enlarged}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 600 });
    const session = plan();
    session.items = [session.items[0]!];
    session.ending = {
      title: "حان الآن وقت التأمّل",
      body: "التفكر في العلم والعمل به ينفع المرء في حياته. ".repeat(9),
    };
    await start(page, session);
    await page.keyboard.press("ArrowDown");
    await expect(page.locator("main")).toHaveAttribute("data-status", "ended");
    if (enlarged)
      await page.addStyleTag({
        content:
          ".ending-frame h1 { font-size: 56px } .ending-frame p { font-size: 38px }",
      });
    await page.evaluate(() => document.fonts.ready);
    const frame = page.locator(".ending-frame");
    const title = page.locator("#ending-title");
    const frameBox = (await frame.boundingBox())!;
    const titleBox = (await title.boundingBox())!;
    expect(titleBox.y).toBeGreaterThanOrEqual(frameBox.y);
    expect(titleBox.y + titleBox.height).toBeLessThanOrEqual(
      frameBox.y + frameBox.height,
    );
    const reading = frame.locator("[data-reading-region]");
    await reading.focus();
    await page.keyboard.press("End");
    await expect
      .poll(() =>
        frame.evaluate((el) => {
          const body = el.querySelector("p")!.getBoundingClientRect();
          const bounds = el.getBoundingClientRect();
          return body.bottom <= bounds.bottom && body.bottom > bounds.top;
        }),
      )
      .toBe(true);
  });
}

test("ending content direction and language follow the English plan, independently of UI language", async ({
  page,
}) => {
  const session = plan();
  session.locale = "en";
  session.items = [session.items[0]!];
  session.ending = {
    title: "Time to reflect!",
    body: "Take a moment to reflect.",
  };
  await start(page, session);
  await page.keyboard.press("ArrowDown");
  const title = page.locator("#ending-title");
  await expect(title).toHaveText("Time to reflect!");
  expect(await title.evaluate((el) => getComputedStyle(el).direction)).toBe(
    "ltr",
  );
  expect(
    await title.evaluate((el) => el.closest("[lang]")?.getAttribute("lang")),
  ).toBe("en");
});

test("loading a session preserves the open Privacy page and keyboard focus", async ({
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/__test/session", async (route) => {
    await gate;
    await route.fulfill({ json: plan() });
  });
  await serveMp4(page);
  await page.goto("/?test-session=1");
  await page.getByRole("button", { name: "عن التطبيق", exact: true }).click();
  await page
    .getByRole("button", { name: "سياسة الخصوصية", exact: true })
    .click();
  const back = page.getByRole("button", { name: "رجوع", exact: true });
  await back.focus();
  release();
  await expect(page.locator("video")).toHaveCount(1);
  await expect(page.getByRole("dialog")).toHaveAccessibleName("سياسة الخصوصية");
  await expect(back).toBeFocused();
  await expect(page.locator("video")).toHaveJSProperty("paused", true);
  expect(await position(page)).toBe(0);
  await page.getByRole("button", { name: "إغلاق", exact: true }).click();
  await expect.poll(() => position(page)).toBeGreaterThan(0);
});

test("fractional reminder durations expose a progress value within its maximum", async ({
  page,
}) => {
  await start(page, plan(1500));
  await page.keyboard.press("ArrowDown");
  await page
    .getByRole("button", { name: "أوقف العدّ لمواصلة القراءة", exact: true })
    .click();
  const progress = page.getByRole("progressbar");
  const now = Number(await progress.getAttribute("aria-valuenow"));
  const max = Number(await progress.getAttribute("aria-valuemax"));
  expect(now).toBeGreaterThan(0);
  expect(now).toBeLessThanOrEqual(max);
});
