import { STORES } from "./stores";

export const APP_STORE_URL = STORES.appStore;
export const PLAY_STORE_URL = STORES.googlePlay;

// iOS browsers and in-app browsers other than Safari. Safari shows Apple's own
// Smart App Banner (index.html), so ours stays hidden there.
const NOT_SAFARI =
  /CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|YaBrowser|DuckDuckGo|GSA\/|FBAN|FBAV|FB_IAB|Instagram|Line\/|Snapchat|musical_ly|Bytedance|TikTok|Twitter|LinkedInApp|Pinterest|WhatsApp|Telegram/i;
// Android in-app browsers may not hand intent:// links to the system.
const ANDROID_IN_APP =
  /; wv\)|FBAN|FBAV|FB_IAB|Instagram|Line\/|Snapchat|musical_ly|Bytedance|TikTok/i;

/**
 * Where "Open" goes for a mobile visitor, or null when we show no banner.
 * Every route ends in the app or its store page, never a dead link:
 * - iPhone/iPad Safari: none of ours; Apple's banner opens or installs.
 * - Other iOS browsers: the App Store page, which offers "Open" when installed.
 * - Android browsers: an intent that opens the app at the same link, or Google
 *   Play when the app is missing.
 * - Android in-app browsers: the Google Play page, which offers "Open".
 */
export function appRoute({
  userAgent,
  maxTouchPoints = 0,
  standalone = false,
  start,
}: {
  userAgent: string;
  maxTouchPoints?: number;
  /** An installed web app was chosen over the store app; leave it alone. */
  standalone?: boolean;
  start?: string;
}): string | null {
  if (standalone) return null;
  const ios =
    /iPhone|iPad|iPod/.test(userAgent) ||
    (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
  if (ios)
    return /Safari\//.test(userAgent) && !NOT_SAFARI.test(userAgent)
      ? null
      : APP_STORE_URL;
  if (!/Android/.test(userAgent)) return null;
  if (ANDROID_IN_APP.test(userAgent)) return PLAY_STORE_URL;
  const link = `mofied.com/${start ? `?start=${encodeURIComponent(start)}` : ""}`;
  return `intent://${link}#Intent;scheme=https;package=com.mofied.app;S.browser_fallback_url=${encodeURIComponent(PLAY_STORE_URL)};end`;
}
