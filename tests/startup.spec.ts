import { expect, test } from "@playwright/test";
import { plan, serveMp4 } from "./fixtures";

for (const production of [false, true]) {
  test(`branded circular loader exists before JavaScript and survives API loading (${production ? "production" : "development"})`, async ({
    page,
  }) => {
    let allowScript!: () => void;
    let allowPlan!: () => void;
    const scriptGate = new Promise<void>((resolve) => {
      allowScript = resolve;
    });
    const planGate = new Promise<void>((resolve) => {
      allowPlan = resolve;
    });
    await page.route(
      production ? /\/assets\/index-[^/]+\.js$/ : "**/src/main.tsx",
      async (route) => {
        await scriptGate;
        await route.continue();
      },
    );
    await page.route(
      production ? "https://api.example.test/session" : "**/__test/session",
      async (route) => {
        await planGate;
        await route.fulfill({ json: plan() });
      },
    );
    await serveMp4(page);
    await page.goto(
      production ? "http://127.0.0.1:4173/" : "/?test-session=1",
      { waitUntil: "commit" },
    );
    const launch = page.getByRole("status", {
      name: "جارٍ فتح مفيد",
      exact: true,
    });
    await expect(launch).toBeVisible();
    await expect(page.locator("main")).toHaveCount(0);
    const mark = page.locator(".launch-mark");
    await expect(mark).toHaveJSProperty("complete", true);
    expect(
      await mark.evaluate((img: HTMLImageElement) => img.naturalWidth),
    ).toBeGreaterThan(0);
    const initialBounds = await mark.boundingBox();
    const spinner = page.locator(".launch-spinner");
    const bounds = (await spinner.boundingBox())!;
    expect(bounds.width).toBeCloseTo(bounds.height, 3);
    await expect(launch).toHaveCSS("background-color", "rgb(10, 10, 10)");
    await expect(page.getByRole("progressbar")).toHaveCount(0);
    allowScript();
    await expect(page.locator("main.startup")).toBeVisible();
    expect(await mark.boundingBox()).toEqual(initialBounds);
    await expect(launch).toBeVisible();
    await page.getByRole("button", { name: "عن التطبيق", exact: true }).click();
    await page
      .getByRole("button", { name: "سياسة الخصوصية", exact: true })
      .click();
    allowPlan();
    await expect(launch).toHaveCount(0);
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "رجوع", exact: true }),
    ).toBeVisible();
    await expect(page.locator("video")).toHaveJSProperty("paused", true);
  });
}

test("startup error replaces the loader, retry restores it, and reduced motion keeps it static", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  let allowRetry!: () => void;
  const retryGate = new Promise<void>((resolve) => {
    allowRetry = resolve;
  });
  let calls = 0;
  await page.route("**/__test/session", async (route) => {
    if (++calls === 1) return route.fulfill({ status: 503 });
    await retryGate;
    await route.fulfill({ json: plan() });
  });
  await serveMp4(page);
  await page.goto("/?test-session=1");
  await expect(
    page.getByRole("heading", { name: "تعذّر تحميل الجلسة" }),
  ).toBeVisible();
  await expect(page.locator(".launch-spinner")).toHaveCount(0);
  await page.getByRole("button", { name: "إعادة المحاولة" }).click();
  await expect(page.locator(".launch-spinner")).toBeVisible();
  await expect(page.locator(".launch-spinner")).toHaveCSS(
    "animation-name",
    "none",
  );
  allowRetry();
  await expect(page.locator("main")).toHaveAttribute("data-status", "playing");
  await expect(page.locator(".launch-spinner")).toHaveCount(0);
});
