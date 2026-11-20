import { describe, expect, it } from "vitest";
import { inline, pageIds, pagePath, pages } from "./index";

const locales = ["ar", "en"] as const;
const every = locales.flatMap((locale) =>
  pageIds.map((id) => ({ locale, id, page: pages[locale][id] })),
);

describe("the About, privacy, terms and support pages", () => {
  it("have the same outline in Arabic and English", () => {
    for (const id of pageIds) {
      const outline = (locale: "ar" | "en") =>
        pages[locale][id].sections.map((section) => [
          !!section.heading,
          section.paragraphs.length,
        ]);
      expect(outline("ar"), id).toEqual(outline("en"));
      expect(!!pages.ar[id].updated, id).toBe(!!pages.en[id].updated);
    }
  });

  it("open with paragraphs and give every later section a heading", () => {
    for (const { locale, id, page } of every) {
      const [lead, ...rest] = page.sections;
      expect(lead!.heading, `${locale} ${id}`).toBeUndefined();
      for (const section of rest)
        expect(section.heading, `${locale} ${id}`).toBeTruthy();
    }
  });

  it("date the privacy policy and the terms", () => {
    expect(pages.en.privacy.updated).toBe("Last updated: 20 November 2026");
    expect(pages.ar.privacy.updated).toBe("آخر تحديث: ٢٠ نوفمبر ٢٠٢٦");
    expect(pages.en.terms.updated).toBe(pages.en.privacy.updated);
    expect(pages.ar.terms.updated).toBe(pages.ar.privacy.updated);
    expect(pages.en.about.updated).toBeUndefined();
    expect(pages.en.support.updated).toBeUndefined();
  });

  it("link only to these pages, mofied's issues, EasyBooks' accounts and its email", () => {
    const allowed = new Set([
      "mailto:easybooksdev@gmail.com",
      "https://github.com/ieasybooks/mofied/issues",
      "https://t.me/ieasybooks",
      "https://youtube.com/@ieasybooks",
      "https://x.com/iieasybooks",
      "https://fb.com/ieasybooks",
      "https://github.com/ieasybooks",
    ]);
    const targets = new Set<string>();
    for (const { page } of every)
      for (const section of page.sections)
        for (const paragraph of section.paragraphs)
          for (const part of inline(paragraph)) {
            if ("href" in part) {
              expect(allowed).toContain(part.href);
              targets.add(part.href);
            }
            if ("page" in part) targets.add(`page:${part.page}`);
            // Nothing that looks like an unparsed link is left in the text.
            if (!("href" in part) && !("page" in part))
              expect(part.text).not.toMatch(/\]\(|\[/);
          }
    expect([...targets].sort()).toEqual(
      [...allowed, "page:privacy", "page:terms"].sort(),
    );
  });

  it("say التفكر and made by, never التأمل, developed by or hosting", () => {
    const text = JSON.stringify(pages);
    expect(text).toContain("التفكر");
    for (const word of [
      "التأمل",
      "developed by",
      "hosting",
      "media server",
      "Contact and support",
    ])
      expect(text).not.toContain(word);
  });
});

describe("inline", () => {
  it("splits a paragraph into its text and links, in order", () => {
    expect(
      inline("Email [us](mailto:a@b.c), or see [the terms](page:terms)."),
    ).toEqual([
      { text: "Email " },
      { text: "us", href: "mailto:a@b.c" },
      { text: ", or see " },
      { text: "the terms", page: "terms" },
      { text: "." },
    ]);
    expect(inline("No links.")).toEqual([{ text: "No links." }]);
  });

  it("refuses a link to a page that doesn't exist", () => {
    expect(() => inline("[Home](page:home)")).toThrow("No page called home");
  });
});

describe("pagePath", () => {
  it("puts Arabic at the root and English under /en, without a trailing slash", () => {
    expect(pagePath("privacy", "ar")).toBe("/privacy");
    expect(pagePath("privacy", "en")).toBe("/en/privacy");
    expect(pagePath("about", "en")).toBe("/en/about");
  });
});
