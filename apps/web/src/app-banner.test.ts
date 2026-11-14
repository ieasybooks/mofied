import { describe, expect, it } from "vitest";
import { APP_STORE_URL, PLAY_STORE_URL, appRoute } from "./app-banner";

const ua = {
  iphoneSafari:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 19_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.1 Mobile/15E148 Safari/604.1",
  ipadDesktopSafari:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.1 Safari/605.1.15",
  iphoneChrome:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 19_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/142.0.7444.46 Mobile/15E148 Safari/604.1",
  iphoneInstagram:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 19_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 400.0.0.0.0",
  iphoneWebView:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 19_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
  androidChrome:
    "Mozilla/5.0 (Linux; Android 13; SM-N980F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36",
  samsung:
    "Mozilla/5.0 (Linux; Android 13; SM-N980F) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/29.0 Chrome/136.0.0.0 Mobile Safari/537.36",
  androidFirefox:
    "Mozilla/5.0 (Android 13; Mobile; rv:145.0) Gecko/145.0 Firefox/145.0",
  androidWebView:
    "Mozilla/5.0 (Linux; Android 13; SM-N980F; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/142.0.0.0 Mobile Safari/537.36",
  androidFacebook:
    "Mozilla/5.0 (Linux; Android 13; SM-N980F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/500.0.0.0;]",
  macSafari:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.1 Safari/605.1.15",
  windowsChrome:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
};
const intent = (link: string) =>
  `intent://${link}#Intent;scheme=https;package=com.mofied.app;S.browser_fallback_url=${encodeURIComponent(PLAY_STORE_URL)};end`;

describe("open-in-app banner routes", () => {
  it("leaves iOS Safari to Apple's banner, including iPad desktop mode", () => {
    expect(appRoute({ userAgent: ua.iphoneSafari })).toBeNull();
    expect(
      appRoute({ userAgent: ua.ipadDesktopSafari, maxTouchPoints: 5 }),
    ).toBeNull();
  });
  it("sends other iOS browsers and in-app browsers to the App Store page", () => {
    for (const userAgent of [
      ua.iphoneChrome,
      ua.iphoneInstagram,
      ua.iphoneWebView,
    ])
      expect(appRoute({ userAgent })).toBe(APP_STORE_URL);
  });
  it("opens the app at the same link from Android browsers, or Google Play", () => {
    for (const userAgent of [ua.androidChrome, ua.samsung, ua.androidFirefox])
      expect(appRoute({ userAgent })).toBe(intent("mofied.com/"));
    expect(appRoute({ userAgent: ua.androidChrome, start: "4321" })).toBe(
      intent("mofied.com/?start=4321"),
    );
  });
  it("sends Android in-app browsers to the Google Play page", () => {
    for (const userAgent of [ua.androidWebView, ua.androidFacebook])
      expect(appRoute({ userAgent, start: "4321" })).toBe(PLAY_STORE_URL);
  });
  it("shows nothing on desktop or in an installed web app", () => {
    for (const userAgent of [ua.macSafari, ua.windowsChrome])
      expect(appRoute({ userAgent })).toBeNull();
    expect(appRoute({ userAgent: ua.macSafari, maxTouchPoints: 0 })).toBeNull();
    expect(
      appRoute({ userAgent: ua.androidChrome, standalone: true }),
    ).toBeNull();
    expect(
      appRoute({ userAgent: ua.iphoneChrome, standalone: true }),
    ).toBeNull();
  });
});
