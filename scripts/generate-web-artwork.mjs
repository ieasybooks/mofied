// Regenerate committed install icons and the social card from supplied branding.
// Run: mise exec -- node scripts/generate-web-artwork.mjs
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const source = new URL("../packages/design/assets/", import.meta.url);
const output = new URL("../apps/web/public/", import.meta.url);
const dataUrl = async (path, type) =>
  `data:${type};base64,${(await readFile(new URL(path, source))).toString("base64")}`;
const [icon, mark, titleFont, bodyFont, latinFont] = await Promise.all([
  dataUrl("icons/app-icon-flat-dark.svg", "image/svg+xml"),
  dataUrl("icons/icon-white.svg", "image/svg+xml"),
  dataUrl("fonts/ThmanyahSerifDisplay-Medium.woff2", "font/woff2"),
  dataUrl("fonts/NotoNaskhArabicUI.woff2", "font/woff2"),
  dataUrl("fonts/Gilroy-Medium.woff2", "font/woff2"),
]);

const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  });
  await mkdir(new URL("icons/", output), { recursive: true });
  for (const [file, size, scale] of [
    ["icon-192.png", 192, 1],
    ["icon-512.png", 512, 1],
    ["apple-touch-icon.png", 180, 1],
    // Keep every pixel of the unchanged mark inside the 80% maskable safe circle.
    ["icon-maskable-512.png", 512, 0.9],
  ]) {
    const png = await page.evaluate(
      async ({ icon, size, scale }) => {
        const img = new Image();
        img.src = icon;
        await img.decode();
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext("2d", { alpha: false });
        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, size, size);
        const inset = (size * (1 - scale)) / 2;
        ctx.drawImage(img, inset, inset, size * scale, size * scale);
        return canvas.toDataURL("image/png").split(",")[1];
      },
      { icon, size, scale },
    );
    await writeFile(
      new URL(`icons/${file}`, output),
      Buffer.from(png, "base64"),
    );
  }

  await page.setContent(`<!doctype html>
    <html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>
      @font-face { font-family: Thmanyah; src: url("${titleFont}"); font-weight: 500; }
      @font-face { font-family: NotoNaskhUI; src: url("${bodyFont}"); font-weight: 400 700; }
      @font-face { font-family: Gilroy; src: url("${latinFont}"); font-weight: 500; }
      * { box-sizing: border-box; }
      html, body { width: 1200px; height: 630px; margin: 0; background: #0a0a0a; }
      body { color: #f5f5f5; -webkit-font-smoothing: antialiased; font-synthesis: none; }
      main { position: relative; width: 100%; height: 100%; padding: 72px 88px; }
      .mark { position: absolute; width: 260px; height: 260px; right: 90px; top: 160px; }
      .rule { position: absolute; right: 418px; top: 143px; height: 292px; width: 1px; background: #343434; }
      .copy { position: absolute; right: 480px; left: 88px; top: 130px; }
      h1 { font: 500 136px/1.25 Thmanyah; margin: 0 0 24px; }
      p { font: 400 35px/1.65 NotoNaskhUI; margin: 0; color: #c6c6c6; }
      footer { position: absolute; bottom: 62px; left: 88px; font: 500 25px/1 Gilroy; color: #999; direction: ltr; }
    </style></head><body><main>
      <img class="mark" src="${mark}" alt="شعار مفيد">
      <div class="rule"></div>
      <div class="copy"><h1>مفيد</h1><p>مواد نافعة، وجلسات محدودة،<br>ولحظات للتفكر.</p></div>
      <footer>mofied.com</footer>
    </main></body></html>`);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((img) => img.decode()));
  });
  await page.screenshot({
    path: fileURLToPath(new URL("og-card.png", output)),
  });
  console.log("Generated four install icons and the 1200×630 social card.");
} finally {
  await browser.close();
}
