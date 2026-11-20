// Builds mofied.com's About, Privacy policy, Terms of use and Contact & support
// pages from @mofied/design's texts: Arabic at /about, English at /en/about,
// and so on. Each is a plain HTML page, without JavaScript or a session.
//
// They're written as privacy.html and en/privacy.html, not privacy/index.html:
// Workers static assets serve /privacy from privacy.html directly, while a
// folder's index.html would answer /privacy with a redirect to /privacy/. The
// /privacy/ and /support/ the stores first linked now redirect to /privacy and
// /support.
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Connect, Plugin } from "vite";
import {
  inline,
  pageIds,
  pagePath,
  pages,
  type Locale,
  type PageId,
} from "../../../packages/design/src/pages.ts";

const origin = "https://mofied.com";
const locales = ["ar", "en"] as const satisfies readonly Locale[];
const other = { ar: "en", en: "ar" } as const;
// The pages' own labels, a few of which repeat @mofied/design's copy. Vite's
// configuration loads this file, so it imports only pages.ts, which imports
// nothing: Node would have to resolve the package index's own imports.
const labels = {
  ar: {
    name: "مفيد",
    language: "اللغة",
    languageName: "العربية",
    links: "روابط",
  },
  en: {
    name: "Mofied",
    language: "Language",
    languageName: "English",
    links: "Links",
  },
};

const mark = `data:image/svg+xml;base64,${readFileSync(
  new URL(
    "../../../packages/design/assets/icons/icon-white.svg",
    import.meta.url,
  ),
).toString("base64")}`;

const escape = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
const plain = (paragraph: string) =>
  inline(paragraph)
    .map((part) => part.text)
    .join("");
const latin = (text: string) => /^[\x20-\x7e]+$/.test(text);

function paragraph(text: string, locale: Locale) {
  return inline(text)
    .map((part) => {
      if (!("href" in part) && !("page" in part)) return escape(part.text);
      const href = "page" in part ? pagePath(part.page, locale) : part.href;
      // An address or a Latin name keeps its own direction in Arabic text.
      const dir = locale === "ar" && latin(part.text) ? ' dir="ltr"' : "";
      return `<a href="${escape(href)}"${dir}>${escape(part.text)}</a>`;
    })
    .join("");
}

/** The page's HTML, which Vite then builds like any other page. */
function renderPage(id: PageId, locale: Locale) {
  const page = pages[locale][id];
  const twin = other[locale];
  const twinDir = twin === "ar" ? "rtl" : "ltr";
  const { name } = labels[locale];
  const title = page.title.includes(name)
    ? page.title
    : `${page.title} · ${name}`;
  const lead = page.sections[0]!.paragraphs[0]!;
  const body = page.sections
    .map((section) =>
      [
        section.heading && `<h2>${escape(section.heading)}</h2>`,
        ...section.paragraphs.map(
          (text) => `<p>${paragraph(text, locale)}</p>`,
        ),
      ]
        .filter(Boolean)
        .map((line) => `        ${line}`)
        .join("\n"),
    )
    .join("\n");
  const links = pageIds
    .filter((next) => next !== id)
    .map(
      (next) =>
        `<a href="${pagePath(next, locale)}">${escape(pages[locale][next].title)}</a>`,
    )
    .join("");
  return `<!doctype html>
<html lang="${locale}" dir="${locale === "ar" ? "rtl" : "ltr"}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="${escape(plain(lead))}" />
    <title>${escape(title)}</title>
    <link rel="canonical" href="${origin}${pagePath(id, locale)}" />
${locales
  .map(
    (language) =>
      `    <link rel="alternate" hreflang="${language}" href="${origin}${pagePath(id, language)}" />`,
  )
  .join("\n")}
    <link rel="icon" href="/favicon.ico" />
    <link rel="stylesheet" href="/src/legal.css" />
  </head>
  <body>
    <main>
      <header>
        <a href="/" aria-label="${escape(name)}"><img src="${mark}" alt="" /></a>
        <nav aria-label="${labels[locale].language}">
          <a href="${pagePath(id, twin)}" hreflang="${twin}" lang="${twin}" dir="${twinDir}">${labels[twin].languageName}</a>
        </nav>
      </header>
      <article aria-labelledby="title">
        <h1 id="title">${escape(page.title)}</h1>
${page.updated ? `        <p class="date">${escape(page.updated)}</p>\n` : ""}${body}
      </article>
      <footer>
        <nav aria-label="${labels[locale].links}">${links}</nav>
      </footer>
    </main>
  </body>
</html>
`;
}

/** Each page's file in the build, such as privacy.html or en/privacy.html. */
const pageFiles = locales.flatMap((locale) =>
  pageIds.map((id) => ({
    id,
    locale,
    file: `${pagePath(id, locale).slice(1)}.html`,
  })),
);

/**
 * Builds the pages as HTML entries that exist only here, and serves them from
 * the development server. Both servers send /privacy/ to /privacy, as Workers
 * static assets do.
 */
export function legalPages(): Plugin {
  let byFile = new Map<string, (typeof pageFiles)[number]>();
  const byPath = new Map(
    pageFiles.map((page) => [pagePath(page.id, page.locale), page]),
  );
  const redirect: Connect.NextHandleFunction = (request, response, next) => {
    const path = request.url?.split("?")[0] ?? "";
    if (path.endsWith("/") && byPath.has(path.slice(0, -1))) {
      response.statusCode = 307;
      response.setHeader("Location", path.slice(0, -1));
      response.end();
      return;
    }
    next();
  };
  return {
    name: "mofied-legal-pages",
    enforce: "pre",
    config(config) {
      const root = resolve(config.root ?? process.cwd());
      byFile = new Map(pageFiles.map((page) => [join(root, page.file), page]));
      return {
        build: {
          rollupOptions: {
            input: Object.fromEntries(
              pageFiles.map((page) => [
                page.file.replace(/\.html$/, ""),
                join(root, page.file),
              ]),
            ),
          },
        },
      };
    },
    resolveId(id) {
      return byFile.has(id) ? id : undefined;
    },
    load(id) {
      const page = byFile.get(id);
      return page && renderPage(page.id, page.locale);
    },
    configureServer(server) {
      server.middlewares.use(redirect);
      server.middlewares.use(async (request, response, next) => {
        const path = request.url?.split("?")[0] ?? "";
        const page = byPath.get(path);
        if (!page || !["GET", "HEAD"].includes(request.method ?? "")) {
          next();
          return;
        }
        const html = await server.transformIndexHtml(
          path,
          renderPage(page.id, page.locale),
        );
        response.setHeader("Content-Type", "text/html; charset=utf-8");
        response.end(html);
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use(redirect);
    },
  };
}
