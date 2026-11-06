import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { media, plan, serveMp4, position } from "./fixtures";

async function forceFallback(page: Page) {
  await page.addInitScript(() => {
    const original = HTMLMediaElement.prototype.canPlayType;
    HTMLMediaElement.prototype.canPlayType = function (type) {
      return /mpegurl/i.test(type) ? "" : original.call(this, type);
    };
  });
}

for (const fault of ["none", "manifest", "segment"] as const) {
  test(`real hls.js playback and recovery with ${fault} errors`, async ({
    page,
  }) => {
    test.setTimeout(45_000);
    await forceFallback(page);
    const session = plan(20_000);
    session.items[0] = {
      ...media("hls"),
      playback: {
        url: "https://hls.example.test/index.m3u8",
        mimeType: "application/vnd.apple.mpegurl",
      },
    };
    session.replacements = [media("spare")];
    await serveMp4(page);
    await page.route("**/__test/session", (route) =>
      route.fulfill({ json: session }),
    );
    let manifests = 0;
    let segments = 0;
    let segmentFailures = 0;
    await page.route("https://hls.example.test/**", (route) => {
      const name = new URL(route.request().url()).pathname.slice(1);
      const manifest = name.endsWith(".m3u8");
      if (manifest) manifests++;
      else segments++;
      if (manifest && fault === "manifest")
        return route.fulfill({
          status: 404,
          body: "",
          headers: { "access-control-allow-origin": "*" },
        });
      if (!manifest && fault === "segment" && segmentFailures++ === 0)
        return route.fulfill({
          status: 503,
          body: "",
          headers: { "access-control-allow-origin": "*" },
        });
      return route.fulfill({
        body: readFileSync(new URL(`./assets/hls/${name}`, import.meta.url)),
        contentType: manifest ? "application/vnd.apple.mpegurl" : "video/mp2t",
        headers: { "access-control-allow-origin": "*" },
      });
    });
    await page.goto("/?test-session=1");
    const expectedItem = fault === "manifest" ? "spare" : "hls";
    await expect(page.locator("main")).toHaveAttribute(
      "data-item-id",
      expectedItem,
      { timeout: 30_000 },
    );
    await expect(page.locator("main")).toHaveAttribute(
      "data-status",
      "playing",
      { timeout: 30_000 },
    );
    await expect.poll(() => position(page)).toBeGreaterThan(0.5);
    if (fault === "manifest") {
      // Three terminal manifest failures exercise the app's two bounded retries.
      expect(manifests).toBeGreaterThanOrEqual(3);
      await page
        .getByRole("button", { name: "المادة التالية", exact: true })
        .click();
      await expect(page.locator("main")).toHaveAttribute(
        "data-item-id",
        "reminder",
      );
    } else {
      expect(manifests).toBeGreaterThan(0);
      expect(segments).toBeGreaterThan(0);
      expect(await page.locator("video").getAttribute("src")).toMatch(/^blob:/);
      if (fault === "segment") expect(segmentFailures).toBeGreaterThan(1);
    }
  });
}
