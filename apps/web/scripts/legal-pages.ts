// Builds mofied.com's About, Privacy policy, Terms of use and Contact & support
// pages from @mofied/design's texts: Arabic at /about, English at /en/about,
// and so on. Each is a plain HTML page, without JavaScript or a session.
//
// It builds /app and /en/app too, the one address to share for the apps: a
// phone goes on to its store as the page loads (src/stores.ts), and anything
// else gets the page, with the three stores' badges and, on wide windows, a QR
// code of the page for the visitor's phone.
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
import { STORES, storeRedirect, type Store } from "../src/stores.ts";
import { drawQr } from "./qr.ts";

const origin = "https://mofied.com";
const locales = ["ar", "en"] as const satisfies readonly Locale[];
const other = { ar: "en", en: "ar" } as const;
// The pages' own labels, a few of which repeat @mofied/design's copy. Vite's
// configuration loads this file, so it imports only files that import nothing,
// such as pages.ts: Node would have to resolve the package index's own imports.
const labels = {
  ar: {
    name: "مفيد",
    language: "اللغة",
    languageName: "العربية",
    links: "روابط",
    app: {
      title: "تطبيق مفيد",
      lead: "مفيد على هاتفك وجهازك اللوحي: مواد قصيرة نافعة، ووقفات للقراءة والتفكر، في جلسة لها نهاية.",
      description: "حمّل تطبيق مفيد من App Store وGoogle Play وAppGallery.",
      stores: "المتاجر",
      badges: {
        appStore: "تنزيل مفيد من App Store",
        googlePlay: "تنزيل مفيد من Google Play",
        appGallery: "تنزيل مفيد من HUAWEI AppGallery",
      },
      scan: "على حاسوبك؟ امسح الرمز بكاميرا هاتفك، يأخذك إلى متجر تطبيقاته.",
      qr: "رمز QR لصفحة تطبيق مفيد",
    },
  },
  en: {
    name: "Mofied",
    language: "Language",
    languageName: "English",
    links: "Links",
    app: {
      title: "The Mofied app",
      lead: "Mofied on your phone and tablet: short, useful media and pauses to read and reflect, in a session that ends.",
      description:
        "Get the Mofied app on the App Store, Google Play and AppGallery.",
      stores: "Stores",
      badges: {
        appStore: "Download Mofied on the App Store",
        googlePlay: "Get Mofied on Google Play",
        appGallery: "Get Mofied from HUAWEI AppGallery",
      },
      scan: "On a computer? Scan the code with your phone's camera to go to its app store.",
      qr: "QR code for the Mofied app page",
    },
  },
};

/** /app, or /en/app: where the apps' badges are, and phones go on to their store. */
const appPath = (locale: Locale) =>
  locale === "ar" ? "/app" : `/${locale}/app`;

// Each store's badge in each language, at the 48px height the page shows them.
const badges: Record<Store, { file: string; width: number }> = {
  appStore: { file: "app-store", width: Math.round((48 * 119.66408) / 40) },
  googlePlay: { file: "google-play", width: Math.round((48 * 564) / 168) },
  appGallery: { file: "appgallery", width: Math.round((48 * 400) / 120) },
};
const badgeFile = (store: Store, locale: Locale) =>
  `/src/stores/${badges[store].file}-${locale}.${store === "appStore" ? "svg" : "webp"}`;

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

/** A page's HTML around its head tags and article, which Vite then builds like any other page. */
function renderDocument({
  locale,
  twinPath,
  head,
  article,
  links,
}: {
  locale: Locale;
  /** The same page in the other language. */
  twinPath: string;
  head: string[];
  article: string;
  /** The pages the footer lists. */
  links: readonly PageId[];
}) {
  const twin = other[locale];
  const twinDir = twin === "ar" ? "rtl" : "ltr";
  const { name } = labels[locale];
  return `<!doctype html>
<html lang="${locale}" dir="${locale === "ar" ? "rtl" : "ltr"}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
${head.map((line) => `    ${line}`).join("\n")}
    <link rel="icon" href="/favicon.ico" />
    <link rel="stylesheet" href="/src/legal.css" />
  </head>
  <body>
    <main>
      <header>
        <a href="/" aria-label="${escape(name)}"><img src="${mark}" alt="" /></a>
        <nav aria-label="${labels[locale].language}">
          <a href="${twinPath}" hreflang="${twin}" lang="${twin}" dir="${twinDir}">${labels[twin].languageName}</a>
        </nav>
      </header>
${article}
      <footer>
        <nav aria-label="${labels[locale].links}">${links
          .map(
            (next) =>
              `<a href="${pagePath(next, locale)}">${escape(pages[locale][next].title)}</a>`,
          )
          .join("")}</nav>
      </footer>
    </main>
  </body>
</html>
`;
}

/** One of the About, privacy, terms and support pages. */
function renderPage(id: PageId, locale: Locale) {
  const page = pages[locale][id];
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
  return renderDocument({
    locale,
    twinPath: pagePath(id, other[locale]),
    head: [
      `<meta name="description" content="${escape(plain(lead))}" />`,
      `<title>${escape(title)}</title>`,
      `<link rel="canonical" href="${origin}${pagePath(id, locale)}" />`,
      ...locales.map(
        (language) =>
          `<link rel="alternate" hreflang="${language}" href="${origin}${pagePath(id, language)}" />`,
      ),
    ],
    article: `      <article aria-labelledby="title">
        <h1 id="title">${escape(page.title)}</h1>
${page.updated ? `        <p class="date">${escape(page.updated)}</p>\n` : ""}${body}
      </article>`,
    links: pageIds.filter((next) => next !== id),
  });
}

/**
 * /app: a phone leaves for its store before the page shows, so only computers,
 * and phones whose store we can't tell, see the badges. Search engines leave it
 * out; link previews still read its title, description and image.
 */
function renderAppPage(locale: Locale) {
  const text = labels[locale].app;
  const url = `${origin}${appPath(locale)}`;
  const qr = `data:image/svg+xml;base64,${Buffer.from(drawQr(url)).toString("base64")}`;
  const share = [
    ["og:type", "website"],
    ["og:site_name", "مفيد · Mofied"],
    ["og:title", text.title],
    ["og:description", text.description],
    ["og:url", url],
    ["og:locale", locale === "ar" ? "ar_AR" : "en_US"],
    ["og:image", `${origin}/og-card.png`],
    ["og:image:type", "image/png"],
    ["og:image:width", "1200"],
    ["og:image:height", "630"],
  ].map(
    ([property, content]) =>
      `<meta property="${property}" content="${escape(content!)}" />`,
  );
  const stores = (Object.keys(STORES) as Store[])
    .map(
      (store) =>
        `<a href="${STORES[store]}" target="_blank" rel="noopener noreferrer"><img src="${badgeFile(store, locale)}" alt="${escape(text.badges[store])}" width="${badges[store].width}" height="48" /></a>`,
    )
    .join("");
  return renderDocument({
    locale,
    twinPath: appPath(other[locale]),
    head: [
      // First, so a phone leaves before the page is drawn.
      `<script>\n${storeRedirect}\n    </script>`,
      `<meta name="robots" content="noindex" />`,
      `<meta name="description" content="${escape(text.description)}" />`,
      `<title>${escape(text.title)}</title>`,
      ...share,
      `<meta name="twitter:card" content="summary_large_image" />`,
    ],
    article: `      <article aria-labelledby="title" class="app">
        <h1 id="title">${escape(text.title)}</h1>
        <p>${escape(text.lead)}</p>
        <nav class="stores" aria-label="${escape(text.stores)}">${stores}</nav>
        <figure class="qr">
          <img src="${qr}" alt="${escape(text.qr)}" width="160" height="160" />
          <figcaption>${escape(text.scan)}</figcaption>
        </figure>
      </article>`,
    links: pageIds,
  });
}

/**
 * Each page's address and file in the build, such as /privacy in privacy.html
 * and /en/privacy in en/privacy.html.
 */
const pageFiles = locales
  .flatMap((locale) => [
    ...pageIds.map((id) => ({
      path: pagePath(id, locale),
      render: () => renderPage(id, locale),
    })),
    { path: appPath(locale), render: () => renderAppPage(locale) },
  ])
  .map((page) => ({ ...page, file: `${page.path.slice(1)}.html` }));

/**
 * Builds the pages as HTML entries that exist only here, and serves them from
 * the development server. Both servers send /privacy/ to /privacy, as Workers
 * static assets do.
 */
export function legalPages(): Plugin {
  let byFile = new Map<string, (typeof pageFiles)[number]>();
  const byPath = new Map(pageFiles.map((page) => [page.path, page]));
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
      return byFile.get(id)?.render();
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
        const html = await server.transformIndexHtml(path, page.render());
        response.setHeader("Content-Type", "text/html; charset=utf-8");
        response.end(html);
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use(redirect);
    },
  };
}
