import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { SessionPlan } from "@mofied/contracts";
const shippedPlan: SessionPlan = JSON.parse(
  readFileSync(
    new URL("../docs/session.example.json", import.meta.url),
    "utf8",
  ),
);
import { serveMp4, plan, media, start, position } from "./fixtures";

test("navigation arrows work after clicking or focusing media controls without overriding activation", async ({
  page,
}) => {
  const session = plan();
  session.items = [session.items[0]!, session.items[2]!];
  await start(page, session);
  await page.locator(".media-tap").click();
  await expect(page.locator("main")).toHaveAttribute("data-status", "paused");
  await page.keyboard.press("Space");
  await expect(page.locator("main")).toHaveAttribute("data-status", "playing");
  await page.keyboard.press("ArrowDown");
  await expect(page.locator("main")).toHaveAttribute("data-item-id", "last");
  await page.locator(".speaker").focus();
  await page.keyboard.press("ArrowUp");
  await expect(page.locator("main")).toHaveAttribute("data-item-id", "first");
});

test("modified wheel gestures never navigate, while ordinary wheel navigation still works", async ({
  page,
}) => {
  await start(page, plan(20_000));
  for (const modifier of ["ctrlKey", "metaKey", "altKey", "shiftKey"]) {
    await page
      .locator("main")
      .dispatchEvent("wheel", { deltaY: 150, [modifier]: true });
    await expect(page.locator("main")).toHaveAttribute("data-item-id", "first");
  }
  await page.locator("main").dispatchEvent("wheel", { deltaY: 150 });
  await expect(page.locator("main")).toHaveAttribute(
    "data-item-id",
    "reminder",
  );
});

test("narrow web exposes semantic navigation and reveals it on keyboard focus", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const session = plan();
  session.items = [session.items[0]!, session.items[2]!];
  await start(page, session);
  const next = page.getByRole("button", {
    name: "المادة التالية",
    exact: true,
  });
  await expect(next).toHaveCount(1);
  await next.focus();
  await expect(next).toBeInViewport();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toHaveAttribute("data-item-id", "last");
  const previous = page.getByRole("button", {
    name: "المادة السابقة",
    exact: true,
  });
  await previous.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toHaveAttribute("data-item-id", "first");
});

for (const variant of [
  "short desktop Quran",
  "long phone text",
  "large phone text",
] as const) {
  test(`reminder reading region and controls remain separate and reachable: ${variant}`, async ({
    page,
  }) => {
    await page.setViewportSize(
      variant === "short desktop Quran"
        ? { width: 1440, height: 600 }
        : { width: 390, height: 844 },
    );
    const session = plan(300_000);
    const reminder = session.items[1]!;
    if (reminder.kind !== "reminder") throw new Error("Expected reminder");
    if (variant === "short desktop Quran") {
      const shipped = shippedPlan.items.find(
        (item) => item.kind === "reminder",
      )!;
      if (shipped.kind === "reminder") reminder.content = shipped.content;
    } else {
      reminder.content.body =
        "التفكر في العلم والعمل به ينفع المرء في حياته. ".repeat(35);
    }
    await start(page, session);
    await page.keyboard.press("ArrowDown");
    await page
      .getByRole("button", { name: "أوقف العدّ لمواصلة القراءة", exact: true })
      .click();
    if (variant === "large phone text")
      await page.addStyleTag({
        content: ".reminder-text { font-size: 46px; }",
      });
    await page.evaluate(() => document.fonts.ready);
    const body = page.locator(".reminder-body");
    const footer = page.locator(".reminder-bottom");
    const bodyBox = (await body.boundingBox())!;
    const footerBox = (await footer.boundingBox())!;
    expect(bodyBox.y + bodyBox.height).toBeLessThanOrEqual(footerBox.y + 1);
    expect(footerBox.y + footerBox.height).toBeLessThanOrEqual(
      page.viewportSize()!.height,
    );
    // Keyboard scrolling belongs to the reading region, never the global navigator.
    await body.focus();
    if (variant !== "short desktop Quran") {
      await page.keyboard.press("ArrowDown");
      await expect
        .poll(() => body.evaluate((element) => element.scrollTop))
        .toBeGreaterThan(0);
    }
    await page.keyboard.press("End");
    await expect
      .poll(() =>
        body.evaluate((element) => {
          const citation = element
            .querySelector(".citation")!
            .getBoundingClientRect();
          const region = element.getBoundingClientRect();
          return (
            citation.bottom <= region.bottom + 1 && citation.top >= region.top
          );
        }),
      )
      .toBe(true);
    await expect(page.locator("main")).toHaveAttribute(
      "data-item-id",
      "reminder",
    );
    await expect(
      page.getByRole("button", { name: "متابعة العدّ", exact: true }),
    ).toBeInViewport();
  });
}

test("every production reload/navigation requests a fresh session regardless of query strings", async ({
  page,
}) => {
  let requests = 0;
  await page.route("https://api.example.test/session", (route) => {
    requests++;
    const fresh = plan();
    fresh.items[0] = media(`fresh-${requests}`);
    return route.fulfill({
      json: { ...fresh, id: `production-${requests}` },
      headers: { "access-control-allow-origin": "*" },
    });
  });
  await serveMp4(page);
  await page.goto("http://127.0.0.1:4173/");
  await expect.poll(() => position(page)).toBeGreaterThan(0.5);
  await page.locator(".media-tap").click();
  for (const query of [
    "",
    "?utm_source=telegram",
    "?fixture=normal&test-session=1",
    "?arbitrary=value",
  ]) {
    const nextRequest = requests + 1;
    if (!query) await page.reload();
    else await page.goto(`http://127.0.0.1:4173/${query}`);
    await expect(page.locator("main")).toHaveAttribute(
      "data-item-id",
      `fresh-${nextRequest}`,
    );
    await expect(page.locator("main")).toHaveAttribute(
      "data-status",
      "playing",
    );
    expect(requests).toBe(nextRequest);
    expect(
      await page.evaluate(() =>
        sessionStorage.getItem("mofied.session.v1.production"),
      ),
    ).toBeNull();
  }
});

test("startup language switches document metadata before any session has loaded", async ({
  page,
}) => {
  await page.route("**/__test/session", (route) =>
    route.fulfill({ status: 503, body: "" }),
  );
  await page.goto("/?test-session=1");
  await page.getByRole("button", { name: "عن التطبيق", exact: true }).click();
  await page.getByRole("button", { name: /اللغة/ }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
});
