import { expect, test, type Page } from "@playwright/test";
import { inline, pageIds, pagePath, pages, type Locale } from "@mofied/design";
import { start } from "./fixtures";

const plain = (paragraph: string) =>
  inline(paragraph)
    .map((part) => part.text)
    .join("");

async function openAbout(page: Page, locale: Locale) {
  await page.getByRole("button", { name: "عن التطبيق", exact: true }).click();
  if (locale === "en")
    await page.getByRole("button", { name: /اللغة/ }).click();
}

for (const locale of ["ar", "en"] as const)
  test(`About shows the full ${locale} pages, with working links`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await start(page);
    await openAbout(page, locale);
    const dialog = page.getByRole("dialog");
    const back = page.getByRole("button", {
      name: locale === "ar" ? "رجوع" : "Back",
      exact: true,
    });
    // The four pages, in the website's order, then the language.
    await expect(dialog.locator("[data-about-page]")).toHaveText(
      pageIds.map((id) => pages[locale][id].title),
    );
    for (const id of pageIds) {
      const source = pages[locale][id];
      await dialog.locator(`[data-about-page="${id}"]`).click();
      await expect(dialog).toHaveAccessibleName(source.title);
      const text = dialog.locator(".page-text");
      await expect(text.locator("h3")).toHaveText(
        source.sections.flatMap((section) => section.heading ?? []),
      );
      await expect(text.locator("p:not(.page-updated)")).toHaveText(
        source.sections.flatMap((section) => section.paragraphs.map(plain)),
      );
      await expect(text.locator(".page-updated")).toHaveText(
        source.updated ? [source.updated] : [],
      );
      // Addresses open outside the player, mail in the mail app.
      for (const link of await text.locator("a:not([href^='/'])").all()) {
        const href = (await link.getAttribute("href"))!;
        if (href.startsWith("mailto:"))
          await expect(link).not.toHaveAttribute("target");
        else {
          expect(href).toMatch(/^https:\/\//);
          await expect(link).toHaveAttribute("target", "_blank");
          await expect(link).toHaveAttribute("rel", "noopener noreferrer");
        }
      }
      await back.click();
    }
    await expect(page.locator("video")).toHaveJSProperty("paused", true);

    // A link to another page opens it in place, and keeps the website's path.
    await dialog.locator('[data-about-page="support"]').click();
    const terms = dialog.locator(".page-text a", {
      hasText: locale === "ar" ? "شروط الاستخدام" : "the terms of use",
    });
    await expect(terms).toHaveAttribute("href", pagePath("terms", locale));
    // On a short screen, the link is below the fold.
    await page.setViewportSize({ width: 390, height: 520 });
    await dialog.evaluate(
      (element) => (element.scrollTop = element.scrollHeight),
    );
    expect(
      await dialog.evaluate((element) => element.scrollTop),
    ).toBeGreaterThan(0);
    await terms.click();
    await expect(dialog).toHaveAccessibleName(pages[locale].terms.title);
    expect(await dialog.evaluate((element) => element.scrollTop)).toBe(0);
    expect(new URL(page.url()).pathname).toBe("/");
    await expect(back).toBeFocused();

    // The social accounts are on About, not on support.
    await back.click();
    await dialog.locator('[data-about-page="about"]').click();
    expect(
      await dialog
        .locator(".page-text a")
        .evaluateAll((links) => links.map((link) => link.getAttribute("href"))),
    ).toEqual([
      "https://t.me/ieasybooks",
      "https://youtube.com/@ieasybooks",
      "https://x.com/iieasybooks",
      "https://fb.com/ieasybooks",
      "https://github.com/ieasybooks",
    ]);
  });

test("the development server serves the pages, and sends /privacy/ to /privacy", async ({
  request,
}) => {
  for (const locale of ["ar", "en"] as const)
    for (const id of pageIds) {
      const response = await request.get(pagePath(id, locale), {
        maxRedirects: 0,
      });
      expect(response.status()).toBe(200);
      const html = await response.text();
      expect(html).toContain(`<html lang="${locale}"`);
      expect(html).toContain(`<h1 id="title">`);
    }
  const old = await request.get("/privacy/", { maxRedirects: 0 });
  expect(old.status()).toBe(307);
  expect(old.headers().location).toBe("/privacy");
});
