// The apps' pages in the three stores, and the script that sends a phone on to
// its store from mofied.com/app, the one address to share for the apps. The
// app banner (app-banner.ts) uses the same pages. This file imports nothing, so
// that apps/web's Vite configuration, which builds /app, can load it on its own.

export const STORES = {
  appStore: "https://apps.apple.com/app/id6831969465",
  googlePlay: "https://play.google.com/store/apps/details?id=com.mofied.app",
  appGallery: "https://appgallery.huawei.com/app/C119708951",
} as const;
export type Store = keyof typeof STORES;

/**
 * The store for a browser's user agent and touch points, or null for the page.
 * It's source text, since it runs inline in /app's head, before anything else.
 * - iPhone, iPad and iPod: the App Store. iPad Safari presents itself as a Mac,
 *   and gives itself away by its touch points.
 * - HarmonyOS NEXT (OpenHarmony) says Android, but runs no Android apps: the page.
 * - Huawei's browser, or an app's browser on a Huawei phone: AppGallery. Chrome
 *   hides the phone's maker, so a Huawei phone in Chrome gets Google Play.
 * - Other Android phones and tablets: Google Play.
 * - Anything else, such as a computer: the page.
 */
export const STORE_OF_DEVICE = `function (ua, touchPoints) {
  if (/OpenHarmony/i.test(ua)) return null;
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && touchPoints > 1)) return "appStore";
  if (!/Android/.test(ua)) return null;
  return /huawei|hmscore/i.test(ua) ? "appGallery" : "googlePlay";
}`;

/**
 * Sends a phone to its store in place of the page, so Back leads to wherever
 * the visitor came from. Any other browser stays and gets the page.
 */
export const storeRedirect = `(function () {
  var store = (${STORE_OF_DEVICE})(navigator.userAgent, navigator.maxTouchPoints || 0);
  var stores = ${JSON.stringify(STORES)};
  if (store) location.replace(stores[store]);
})();`;
