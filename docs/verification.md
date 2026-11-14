# Implementation verification

## Fresh sessions on every opening — 2026-11-08

Removed saved-session serialization/restoration and all progress reads/writes.
Each web page load/refresh and native cold launch or background return requests a
new Faqieh plan with HTTP caching disabled. A bfcache return also starts fresh;
ordinary browser tab hiding and native inactive-only events keep the current
session. Backgrounding cancels pending native requests and immediately stops the
old controller. Info, language changes and manual pause retain the foreground
session. Legacy production/development storage keys are deleted on upgrade;
normal media/image caches and next-short preloads are unchanged. Privacy/support
copy and the product/contract documentation now describe this behavior.

Executed verification:

- Both TypeScript checks, **125 unit tests in ten files**, a frozen Bun install,
  the production web build and all three Expo JavaScript/assets exports passed.
- **92 headed Chromium regressions** passed, with the opt-in live API case run
  separately and passing. The five new fresh-session cases also passed in WebKit
  and Firefox. **Eight Cloudflare checks** passed. Coverage includes
  legacy-key deletion without progress reads/writes, new API calls on refresh,
  fresh sessions after endings, failed-request Retry without old-session fallback,
  unavailable browser storage, Info continuity and cached-page return.
- The live API check decoded real HLS and verified two successful API requests,
  different server session IDs on refresh, production CORS and `no-store` headers.
- Signed Android APK/AAB 0.1.1 (2) and an iOS distribution archive/IPA compiled.
  Android signing matches the existing release key, the four ABI variants are
  present, and 16 KB alignment passes. The existing **eight Android native
  lifecycle tests** also passed.
- On the Android API 36.1 emulator, 0.1.0 first reproduced paused restoration of
  the same media at 0:09. Installing the signed 0.1.1 APK over it loaded different
  content and played. Paused foreground return, playing foreground return and
  process relaunch each loaded fresh content from the beginning with a new
  20-minute budget. Info/Privacy retained the paused playhead. These were actual
  Release-app interactions against production. Direct app-storage inspection was
  unavailable on this non-rootable emulator; no disk-level deletion assertion is
  claimed.
- An opt-in XCUITest on iPhone 18 Pro / iOS 27.0 simulator exercised four openings
  against the production API: cold start, paused background return, playing
  background return and terminated relaunch. It verified different plan identities
  and playing intent on reopening, plus the same identity and pause through Info.
  The first attempt encountered the app's session-load error; a subsequent cold
  launch and the complete journey passed. Its precise upstream/network cause was
  not established, so this is not a claim that the production service never fails.

Deployed implementation commit `d11bc87` as Cloudflare version
`9412e65e-03f1-4063-8ba7-688ffc748b17`. The production JavaScript and both updated
legal/support pages match the local release byte-for-byte. Live Chromium and an
iPhone-configured WebKit context each decoded real media, preserved manual pause
through Info, and received different session IDs from two API calls across a
refresh. Both browsers also removed valid legacy session keys seeded before
loading the app. No uncaught page errors occurred in those completed journeys.

Some live WebKit attempts timed out waiting for the session API; the app displayed
its load error instead of restoring old content. Separate default-cache and
`no-store` request probes both succeeded, and a subsequent full journey passed.
The machine's IPv6 connection to Faqieh also failed while IPv4 succeeded. These
observations do not establish the precise cause of the intermittent timeouts.
Wrangler's first authentication refresh failed on the network; the normal deploy
succeeded on retry with Node's IPv4-first DNS order. No TLS verification or other
security protection was disabled.

The 0.1.1 (2) store update was submitted through signed-in Chrome on 8 November.
Apple confirms Waiting for Review with manual release. Huawei confirms production
Submitted / Reviewing with the owner-approved January 1, 2027 schedule. Google
confirms Changes in review with Managed Publishing enabled; its automatic quick
checks were still running. These console checks establish submission settings,
not store approval. See [store-submission.md](store-submission.md) for identifiers
and artifact hashes.

Evidence is under ignored `artifacts/fresh-sessions/`; repeatable cases are in
`fresh-sessions.test.ts`, `tests/fresh-sessions.spec.ts` and
`tests/native/session/`. These are local builds, browser tests and emulator/simulator
checks, not new physical-device or hosted-CI results. Earlier restoration results
below describe historical releases and are superseded by this change.

## Manual web installation and social previews — 2026-11-07

Added a web app manifest with the Arabic name مفيد, stable app identity, standalone
launch, regular and maskable icons, and iOS home-screen metadata. Automatic
installation prompts are suppressed; installation remains available through the
browser menu. No service worker, offline playback, or additional session/media
cache was introduced. The 1200×630 Open Graph/Twitter card uses the supplied icon
and Arabic fonts; preview metadata is present in the initial HTML.

Executed verification:

- Both TypeScript checks, **115 unit tests**, the release build, and Wrangler's
  deployment dry run passed.
- **87 headed browser regressions** and **eight Cloudflare checks** passed.
  The Cloudflare checks include Chromium's manifest/installability validation,
  suppression of automatic prompts, JavaScript-free social metadata, and actual
  decoding of every icon and the share image at their declared dimensions.
- An iPhone-configured WebKit check loaded the Arabic home-screen name and
  180×180 Apple icon. Pixel inspection confirmed the maskable icon is fully opaque
  and its complete mark fits inside the required safe circle.
- Deployed code commit `771ba9c` as Cloudflare version
  `70c085c7-faf5-4337-b70c-ceb15cc2f664`. All six new public assets match the
  committed files byte-for-byte, return the correct MIME types, and revalidate.
  Requests using Facebook and Twitter crawler user agents received the static
  preview metadata with HTTP 200.
- Live Chromium and iPhone-configured WebKit both passed image decoding, prompt
  suppression, real playback, and paused restoration with exactly one session
  API request and no uncaught page errors. Chromium reported no installability
  errors on the production origin.

The first live playback attempt timed out while Faqieh returned a Cloudflare
525 SSL handshake error. Subsequent ordinary requests returned 200 and both live
journeys passed without an app change or a browser DNS override. This is an
observed upstream interruption, not a claim that its underlying cause was fixed.
Evidence is under ignored `artifacts/pwa-og/`. These are browser checks, not a
new physical-device home-screen installation or native app build.

## Swipes starting on title and speaker links — 2026-11-07

Reproduced the reported web failure before the fix: the pager accepted pointer gestures only from `.media-tap`, excluding the title, speaker name and portrait in `.metadata`. Those areas now share vertical paging. Stationary link taps retain browser navigation; only stationary taps on the video toggle playback. Pointer capture stays on the originating anchor, and dragging, cancellation or a second touch suppresses the resulting click. A fresh pointer or keyboard action clears that guard. Firefox's keyboard-generated click can have `detail=1`, so keyboard activation is reconciled explicitly.

Metadata permits horizontal/pinch browser gestures while the pager handles vertical swipes. Browser link/image dragging and text selection no longer take over a vertical swipe. The app's wording, link destinations and presentation are unchanged.

Executed verification:

- Both TypeScript checks, **115 unit tests in nine files**, the release web build, production fixture-marker exclusion and Wrangler's deployment dry run passed.
- The full headed Chromium suite passed **88 tests**, including all 14 new gesture regressions, actual hidden-tab playback, preloading/posters, recovery, reminders, Info, restoration and the opt-in real API/CORS/playback check.
- Focused headed Firefox and WebKit suites each passed **34 tests** covering link gestures, paging, HLS recovery, audible playback/preloading and real API restoration. Each skips the Chromium-CDP-only touch case; that case passes in Chromium, and Safari touch is independently exercised below. The final matrix has **156 passing browser checks**, excluding those two skips.
- All **four Cloudflare local-hosting checks** passed, covering cache/MIME headers, missing-file 404s, production playback/restoration and API error/retry behavior.
- **One new XCTest passed on iPhone 18 Pro / iOS 27.0 simulator Safari**, with zero failures or skips. Real touch swipes from title and speaker advanced while preserving sound and one video element. A cancelled partial title drag preserved the item, playhead and manual pause; stationary title/speaker taps reached Faqieh.

The gesture tests cover phone/desktop geometry, drag-following motion, one-item advancement, backwards/boundary behavior, cancelled/horizontal gestures, two-finger cancellation, taps after cancellation, keyboard/modified link activation, control activation and required reminders. The new-window test uses an unmocked local destination: Firefox's automation can strand a Shift-click window's first request when request interception is enabled, which also reproduced with a plain anchor outside Mofied.

Post-deployment verification for code commit `0bd7516` (Cloudflare version `1a672322-b671-4702-b72f-f405c75719fa`, asset `/assets/index-Bs9P5RF1.js`):

- Live Chromium and WebKit each traversed **13 server items including a required reminder**. All 12 media swipes began on the title, speaker name or portrait (four from each), advanced once and opened no accidental tabs. Playback retained sound and the same video element; upcoming media requests were observed.
- Each journey cancelled a partial title drag while manually paused, then opened the correct title and speaker destinations with normal taps. Both retained pause/playhead through Info/Privacy and reload, restored without a second session API request, and resumed with sound. No uncaught page errors occurred.
- The deployed JavaScript matches the local release byte-for-byte by SHA-256. Asset caching, missing-file 404, real API CORS and analytics 204 responses passed.

Evidence is under ignored `artifacts/link-swipes/`; the repeatable browser suite is `tests/link-swipes.spec.ts` and the Safari touch regression is in `tests/native/web/`. This is a web-client correction. The iPhone run tests the browser on a simulator; no new physical-device, Expo native-app build or hosted-CI result is claimed.

## Reusable web preloads and quiet transitions — 2026-11-07

Reproduced loading notices even after the next stream's speculative downloads had completed. Native HLS could not consume the in-memory warmup; the CDN's `max-age=0, must-revalidate` policy required browser validation requests. Separately, cancelled/failed warmups remembered the target URL and did not restart. Immediate loading notices exposed even short source/decoder handoffs.

The web client now uses hls.js on supported MediaSource/ManagedMediaSource browsers, including modern iPhones, so the active player can consume warmed playlists, initialization data and opening segments directly. The same video element retains audible-playback permission. Native HLS remains available when streaming APIs are unavailable or the lazy engine cannot load. The first rendition matches the preload; normal adaptive quality continues afterward. CDN/browser cache policy is unchanged, preserving replacement of published media at existing URLs. The hls.js chunk remains lazy but is now downloaded for supported iPhone HLS playback as well; MP4 does not require it.

Warmups retain completed resources through manual pause, Info and buffering, resume unfinished downloads, and retry transient failures/timeouts with a bounded backoff. Connectivity restoration can restart an exhausted warmup while respecting pause, data-saving and expiry. Handoff transfers pending requests to the active player without aborting or repeating them. Cancellation is checked again after asynchronous reader cleanup so an old response cannot overwrite a newer cache entry. Limits remain one upcoming item, 2 MiB total, at most three playlists/two opening segments, a 1 MiB MP4 range and an eight-second speculative deadline. Partial MP4 files never become playable blobs.

Posters/last frames cover ordinary handoffs. The existing loading text appears only after 750 ms of continuous waiting, with a fresh timer for each source/pause/stall. Real prolonged waits still report their state. A WebKit reload probe also found outgoing XHR cancellation triggering HLS retries before `pagehide`; HLS downloads now stop in `beforeunload`, with complete release on `pagehide` and reconstruction on cached-page return. Hidden-tab playback remains unchanged. The early listener can affect Firefox's back/forward-cache eligibility; normal saved-session restoration remains covered.

Heavy verification exposed a separate Chromium ordering race: a paused restoration's final frame could arrive before `seeking` became false, leaving the poster waiting indefinitely for another frame. The presentation observer now reconciles that matching, already-presented frame when seek readiness catches up. A deterministic real-decoding regression fails before the correction and passes afterward.

Executed verification:

- Both TypeScript checks, **115 unit tests across nine files**, the production web build, and the three Expo JavaScript/assets exports passed. No native app source changed.
- The full headed Chromium suite passed **74 tests**, including the genuinely hidden-tab journey and opt-in real API/playback/restoration test. The focused Firefox and WebKit suites each passed **41 tests** (156 browser checks in this final matrix).
- New regressions cover completed/in-flight handoff under production cache headers, abort/resume, stale-response rejection, bounded bytes/retries/timeouts, online recovery, changed data-saving policy, pause/Info, delayed notices, first-frame delays, native-support detection, page navigation and paused-frame ordering. No page-error filtering was added. The live WebKit restoration reproduction also passed five consecutive checks after the early navigation cleanup.
- All **four Cloudflare local-hosting checks** and Wrangler's deployment dry run passed. Development/test fixture markers are absent from production JavaScript.
- **Three XCTest cases passed on iPhone 18 Pro / iOS 27.0 simulator Safari**, with zero skips: controlled ManagedMediaSource playback under production cache headers, real production streams, and native HLS fallback. Three controlled and four real prepared audible transitions had no loading notices, no duplicated opening requests and no autoplay rejection. Native fallback playback/sound passed; its cache behavior remains browser-controlled. The cold initial real stream did show a legitimate loading wait.

Post-deployment verification for code commit `63b8aa6` (Cloudflare version `14e11891-1bb0-40a3-bdd9-c09f451e2142`, asset `/assets/index-99Vpi-M4.js`):

- Live Chromium and WebKit each passed **six prepared audible swipes** with zero loading notices, zero repeated opening-file requests and the same video element. Measured first frames were 112–126 ms on this connection; this is observed local-network performance, not a latency guarantee.
- Separate live journeys each traversed **13 server items including a required reminder**, then passed Info/Privacy, manual pause, audible resume and saved-position restoration with exactly one session API request. Deployed asset identity/caching, missing-asset 404, API CORS and analytics 204 responses passed. Neither journey had an uncaught page error.
- A physical iPhone Chrome follow-up was attempted. The QA host compiled, but Xcode reported the iPhone locked and could not launch automation. That attempt was cancelled; **no physical-device pass is claimed for this revision**.

The repeatable simulator harness and instructions are in `tests/native/web/` and `scripts/ios-web-preload-server.ts`. Local logs, traces and before/after reproductions are under ignored `artifacts/preload-research/`. The frame-order and reader-cleanup regressions were both verified failing before their fixes. Expo exports are not native builds; this change makes no new Android/iOS native-app compilation or hosted-CI claim. Slow/offline connections, immediate swipes before warmup completion, and native-HLS-only browsers can still require visible loading.

## Posters during web loading — 2026-11-07

Reproduced the gray incoming page with the next media response held. The web player now uses an explicit image cover instead of relying on the browser's native `video.poster` behavior. It retains that cover until `requestVideoFrameCallback` reports a presented frame; older engines use decoded-frame readiness followed by a paint opportunity. Metadata, playing status and network completion alone cannot remove the cover. The existing video element stays mounted, preserving audible-playback permission.

Each source load has its own presentation identity. A targeted history reproduction caught an intermediate implementation reusing readiness when returning to the last presented item before its successor produced a frame; the corrected implementation and regression pass. Cancelled callbacks cannot reveal another source. Later buffering retains the last video frame instead of bringing back the poster. Missing or failed poster images use the existing placeholder without failing playback.

The next media poster is warmed and decoded before navigation, one image ahead, with low request priority. Manual pause, Info, terminal errors, expiry and reduced-data connections suppress that speculative image loading. Current-item images still load normally. Actual image availability and network speed remain external limits; a missing or unreachable image cannot be displayed.

Executed verification:

- Both TypeScript checks, **100 unit tests in eight files**, and the production web build passed.
- The full headed Chromium suite passed **56 tests**, including genuine hidden-tab playback. The separate opt-in live API test ran in the cross-browser set below.
- **72 checks passed across Chromium, Firefox and WebKit**: all 11 new poster cases, the nine audible-playback/preloading cases, three HLS recovery cases and the real API/playback/restoration integration in each engine. The poster cases include delayed media, actual HLS starvation/recovery, held compositor callbacks, rapid navigation, backward history, manual pause/Info, failed images, retry, saved seeks, reduced-data behavior and the older-browser fallback.
- All **four Cloudflare local-hosting checks** passed, including asset caching, missing-file 404s, playback/restoration and API error/retry behavior.
- XCTest on the **iPhone 18 Pro / iOS 27.0 simulator** drove native Safari HLS with controlled fixture segments and public poster images. While the second short's segments were withheld, its image remained visible at zero playback progress. Releasing the segments produced a native frame and removed the cover. Subsequent swiping retained sound and the same video identity. The verified trace contains no sample where the cover was removed before a frame callback. A screenshot and recording preserve the controlled loading state.
- After deploying `96a7552`, **live Chromium and WebKit checks** held an incoming production stream and verified that its real poster had preloaded, stayed visible while the video waited at zero, and disappeared once playback advanced. Sound and video identity were preserved. Separate live journeys each traversed 13 server items including a required reminder, then passed Info/manual-pause preservation and paused restoration without another API request. Both verified the deployed asset, CORS, cache/404 behavior and analytics responses without uncaught page errors.

Evidence is under ignored `artifacts/poster-loading/`, including `live-result.json` and `live-journeys-result.json`. The successful simulator result is `ios-verified.json`; `ios-verified-trace.json` filters the unique final page run and excludes the old Safari page restored during setup. No new native-app build, physical-phone check or hosted-CI result is claimed for this web change.

## Audible web paging and next-media loading — 2026-11-07

The web player now keeps one video element through media changes, reminders and the ending. Sound and resume controls synchronize the element directly inside the user gesture. Source listeners and HLS engines are still cleaned up at item boundaries; queued old-source events and rejected play promises cannot advance or block the new item. Metadata and portraits reset independently of the video. Reading regions retain their existing identity-based reset behavior.

Next-media loading follows a read-only controller lookup, including replacements already made in session history. It never plays a second element, completes a reminder or changes accounting. It warms one next item: up to three playlists, an initialization segment and two opening HLS segments, within a 2 MiB response-body budget and eight-second deadline. MP4 uses a range of at most 1 MiB. Large/unsupported responses, offline failures and cancellation are nonfatal. Pausing, About and buffering cancel in-flight speculation; reduced-data connections and expired/ended sessions do not start it. hls.js consumes warmed bytes directly. Native HLS uses the browser cache; its revalidation and adaptive-quality decisions can still require requests. Complete small MP4 files are reused as blobs; partial files are never treated as complete media.

Executed local checks:

- Both TypeScript checks and **100 unit tests in eight files** passed. New cases cover bounds, cancellation, rendition selection, speculative failures, read-only session lookup and saved-position reconciliation.
- The full headed Chromium suite passed **45 tests**, including real hidden-tab playback. Its separate opt-in live test was subsequently run in all three engines below.
- **39 headed checks passed across Chromium, Firefox and WebKit**: nine playback regressions, three real HLS decoding/recovery cases and the real Faqieh API/CORS/playback/restoration integration in each engine. The audible regressions model per-element gesture permission while retaining real media decoding; they are not presented as physical iOS evidence.
- All **four Cloudflare local-hosting checks** passed, along with the production build and Wrangler deployment dry run. Initial JavaScript remains separate from the lazy hls.js fallback.
- XCTest drove Safari on the **iPhone 18 Pro / iOS 27.0 simulator** with different public HLS sources, six audible swipes and a required reminder. The verified per-page trace records seven played item identities, one video identity and zero `NotAllowedError` rejections. A separate controlled media relay preserved production cache headers and observed conditional 304 responses for warmed resources. Native HLS cache behavior remains browser-controlled.
- After deploying `a51c73b` to Cloudflare, **live Chromium and WebKit journeys** each traversed 13 real server items, including a required reminder. Both observed next-media requests during current playback, unmuted progress on the same video element, Info/Privacy pause preservation and paused reload restoration with only one session API request. The live asset hash, immutable caching, missing-asset 404, API CORS and analytics 204 responses passed; neither journey produced an uncaught page error.
- **Physical iPhone 16 Plus / iOS 26.2 / Chrome:** the old deployed version reproduced the reported autoplay prompt after the first sound-enabled swipe. Against the new deployment, XCTest passed six real swipes, asserted a different media title each time, verified sound stayed enabled and sampled advancing playheads on all seven media items. No swipe required another play tap. The page was paused at completion. This run used the production site and media without injecting JavaScript or changing browser autoplay policy.

Evidence is under ignored `artifacts/web-playback/`, including browser logs, XCTest results, `ios-verified-trace.json`, `live-result.json` and the successful physical result `iphone-chrome-production.json`. The final simulator run used a unique URL and checked each destination title; earlier exploratory runs included Safari's speculative page loads and are not the final evidence. Physical test setup required retrying an Xcode connection failure and excluding continuous animations from XCTest's idle wait. A preliminary six-second sample caught a clip still loading; the final test allows bounded network startup, then requires actual progress. Native HLS preloading does not guarantee zero startup delay. This change does not claim new native Android/iOS app builds or physical interruption/accessibility checks. Hosted CI remains deferred as previously agreed.

## Branded startup — 2026-11-07

The reported top-edge loading/download text matches the Metro development bundle banner. The installed Android Release package has no `DEBUGGABLE` flag and runs with Metro stopped. I did not reproduce that banner in Release. A cold-start recording did reproduce a white native launch screen before the dark React loading surface.

Added the Expo splash-screen plugin with the existing white Mofied mark on `#0A0A0A` for Android and iOS. The native splash remains through font setup, then fades into a matching mark and circular session loader without moving the mark or imposing a minimum wait. Errors replace the loader with Retry; Info remains available during session loading and errors. Web now renders the same branded loader in the initial HTML, before JavaScript, fonts or the API response, and preserves its geometry when React takes over. Its spinner respects reduced motion. The actual playback progress line is unchanged.

| Local check                                                      | Result                                                                                                                                                                                                                                                                                                |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frozen Bun install, TypeScript, unit tests, web production build | Passed; **89 unit tests in 7 files**                                                                                                                                                                                                                                                                  |
| Headed Chromium suite                                            | **36 passed**, including hidden-tab playback and three new startup regressions; the opt-in live integration test is skipped in this command                                                                                                                                                           |
| Startup browser regressions                                      | Development and production HTML show the mark/circular loader while JavaScript is withheld; the mark does not move when React takes over; Privacy and its pause survive API acceptance; error/retry and reduced motion pass                                                                           |
| Live browser smoke check                                         | Production API and HLS playback loaded through the local development proxy without page errors                                                                                                                                                                                                        |
| Expo Android/iOS/web exports                                     | All passed; JavaScript/assets checks                                                                                                                                                                                                                                                                  |
| Native Release compilation                                       | Android and iOS source builds passed with the new splash-screen module                                                                                                                                                                                                                                |
| Physical Android                                                 | Reinstalled the Release APK on the Samsung Galaxy Note20 / Android 13 without clearing its session. Cold launch has a dark splash, no white flash or download banner, and restores paused at the saved position. Playback, Info/Privacy, manual pause, warm return and another process restart passed |
| Android emulator                                                 | Fresh launch offline replaced loading with the connection error. Info/Privacy remained usable; enabling connectivity alone did not retry. Explicit Retry showed the branded circular loader and reached real API media playback                                                                       |
| iOS simulator                                                    | iPhone 18 Pro / iOS 27.0 Release cold-start recording shows dark native artwork, matching circular loader and paused restoration. The XCTest production journey passed playback, cancelled/committed paging, bilingual Info, background return and process restoration                                |

Local logs, recordings and UI evidence are under ignored `artifacts/startup/`. No physical iPhone run, hosted CI or new telephony/audio-route/spoken-screen-reader result is claimed for this startup change. Android emulator connectivity was restored, and the physical Android app was left installed and paused. Native launch presentation was checked in embedded Release apps rather than Expo Go or a Metro loading session.

## Paging, Info slides and production API — 2026-11-07

Implemented drag-following vertical pages on web/iOS/Android, with a bounded first-page drag, cancellable short gestures, distance/flick settlement, and one silent adjacent preview. Only the settled page owns a media player. Buttons, wheel, keyboard and native accessibility actions share the same navigation coordinator. Server order, required reminders, consumed-reminder history and finite endings remain authoritative. Movement suspends playback/accounting without changing manual play intent. About, backgrounding and interruptions cancel pending manual navigation; reduced motion settles immediately.

Info detail pages now slide in/out in the UI reading direction. Outgoing content survives the transition, inactive content cannot receive input or accessibility focus, and web focus returns to the selected menu row. Native details scroll within the sheet; Android Back returns to the menu first. A browser regression caught the hidden detail page crossing the menu on an Arabic/English switch; its offscreen position now changes without an animation.

All clients now default to `https://faqieh.com/api/v1/mofied/session?locale=ar`. The Vite development proxy reaches the same HTTPS service without adding localhost to production CORS. Explicit development mocks remain available; mock and production restoration use different storage keys. Configured API errors still do not become fixture playback. No private Rails code/data or live response payloads were added to this repository.

### Additional defect found during live native verification

A restored iOS HLS player reported zero during loading before its asynchronous seek reached the saved position. The UI briefly changed from the saved 9-second position to zero, and the health sampler could persist that premature value. It eventually sought correctly, so this was an initialization race rather than a permanently failed seek. The adapter now preserves the saved position and blocks early playback until the native playhead confirms the initial seek. It also covers a source already ready when listeners attach. Three regressions cover delayed loading/seek completion, early resume intent and disposal; the old sampler fails the first two. The rebuilt iOS and Android production journeys pass restoration afterward.

### Executed local checks

| Check                               | Result                                                                                                                                                                                                                                                                |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mise exec -- bun run check`        | Both TypeScript checks, **89 unit tests in 7 files**, production web build passed                                                                                                                                                                                     |
| Headed Chromium browser suite       | **33 passed**; the separate opt-in live test is skipped in this command. Includes the genuinely hidden-tab journey, HLS decoding/recovery, original review regressions and 8 new motion cases                                                                         |
| Live production browser integration | Passed with local production app assets under `https://mofied.com`; real API request/CORS, HLS manifests/segments and decoded video, followed by paused restoration with exactly one session request. The hosted Mofied frontend itself was not deployed by this task |
| Live API language/origin checks     | Arabic and English responses validated; HTTP 200, exact allowed-origin CORS and `Cache-Control: no-store`                                                                                                                                                             |
| Generated schema/example            | Unchanged after regeneration                                                                                                                                                                                                                                          |
| Production fixture exclusion        | Development endpoint/fixture markers absent from web JavaScript; default production endpoint present                                                                                                                                                                  |
| Expo Android/iOS/web exports        | All passed; these are JavaScript/assets checks                                                                                                                                                                                                                        |
| Android native compilation          | Debug and Release source builds passed, including patched native dependencies. Release APK installed on Samsung Galaxy Note20, Android 13/API 33, arm64. Local APK uses the development signing key, not store signing                                                |
| iOS native compilation              | Debug and Release source builds passed on iPhone 18 Pro simulator, iOS 27.0. Release embeds the bundle; no physical iPhone result is claimed for this revision                                                                                                        |
| Android lifecycle command           | Passed: seven focus-owner tests and the storage scheduling test, through the installed patched dependencies                                                                                                                                                           |
| Swift interruption cache stress     | Passed under Thread Sanitizer: 200,000 concurrent operations                                                                                                                                                                                                          |

The web bundle is approximately 362 kB / 111 kB gzip plus the existing conditional 578 kB / 180 kB gzip hls.js chunk. The known chunk-size warning and upstream native deprecation warnings remain nonblocking.

### Native journeys and recordings

Both platforms passed the deterministic fixture journey: actual HLS playback, manual pause, partial-drag cancellation with preserved position, forward paging into a required reminder, attempted skip rejection, pause-to-read through Info, countdown completion, previous/next history without replaying a consumed reminder, ending and saved-state removal. XCTest drove the simulator; Android UI automation drove the physical phone.

Both final embedded Release apps then passed the live production journey with Metro stopped: playback, cancelled/committed paging, Arabic/English Privacy slides, manual pause through Info, background return, and process termination/restoration at the saved position while paused. No mock plan was seeded into production storage. All three Info subpages also passed navigation checks on web, Android and the iOS simulator; Android hardware Back returned to the menu before dismissing the sheet and preserved manual pause. The first iOS live probe crossed a naturally ending short; the probe was corrected to allow server-selected item lengths. The restoration failure above was investigated separately and fixed rather than waived.

Local evidence and videos are under ignored `artifacts/paging/`: `web-experience.mp4`, `android-experience.mp4`, `ios-experience.mp4`, browser/native logs, XCTest result bundles and fixture-journey evidence. Recordings show the actual client surfaces with production content. Native source builds are distinguished from exports above. Test-generated mock state was removed; the installed Android app is left self-contained and paused.

Remaining release checks are still explicit: hosted CI execution, physical calls/audio routes, spoken VoiceOver/TalkBack journeys, Safari, long-duration URL/expiry soak, store packaging and final asset/privacy publication. Those are not implied by these local passes. This revision does not claim an exhaustive test of every server item, network condition or device.

## Physical iPhone pass — 2026-11-06

Tested on an iPhone 16 Plus running iOS 26.2, with an Arabic system locale and a 430×932-point display. Built, signed and installed a native Debug app with the patched ExpoVideo compiled from source. The embedded development bundle used the repository's public mock HLS media and valid generated reminder plans. XCTest drove the physical device after UI Automation was enabled. No production API, hosted CI, physical call or audio-route result is claimed.

### Defect found and corrected

**Foreground return could strand playback.** Two physical reproductions stopped permanently around 24–32 seconds after Home → return, despite preserved playing intent. An app-scoped native observer recorded `AVAudioSessionInterruptionTypeKey = 1` (begin), reason `0`, while the application was backgrounded. No matching end arrived. The interruption cache therefore kept playback permission blocked.

The iOS bridge now requests native reactivation when foreground activity becomes eligible again, including explicit resume, closing About and Retry. The main-queue native method requests an exclusive playback audio session and publishes permission only after activation succeeds. A fresh interruption while already foreground does not trigger reacquisition. Manual pause, startup/restored pause, About, background and terminal errors defer the request. Five new controller/bridge cases fail without the correction and pass with it; denied activation leaves reminder time stationary. These denial cases are deterministic boundary tests, not a physical telephone-call claim.

The rebuilt app passed the original foreground-return assertions and the complete media journey: playback, About/Privacy, language changes, mute/unmute with manual pause, background return, process termination/restoration at the saved position, a required reminder, and backward/forward history without replaying that reminder.

| Physical iPhone check                       | Result                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Native build, installation and HLS playback | Passed with the custom Expo native code; both normal mock streams decoded                                                                                                                                                                                                                                              |
| Controls, About and restoration             | Passed the complete media journey, including manual pause through language/mute changes, saved-position restoration, required reminder and consumed-reminder history                                                                                                                                                   |
| Reminder background and pause               | Background samples held at 114,605.9 ms remaining; return resumed the countdown. A later manual pause held at 108,276.7 ms through background/return and Privacy                                                                                                                                                       |
| Consecutive long reminders                  | Current reading position survived About and language changes; the next item started at the top. Locale badge reflow shifts the bottom position by a few points, without resetting the reading position                                                                                                                 |
| Largest system text                         | Passed at the device accessibility service's maximum Dynamic Type setting. The approximately 38,696-point reminder body scrolled to its citation with controls visible. The next reminder reset correctly, and the long ending's first and final lines remained reachable                                              |
| Ending and storage removal                  | Generated reading sessions reached the ending and removed the saved development session                                                                                                                                                                                                                                |
| External links                              | Media and speaker links opened the corresponding screens in the installed Faqieh app via universal links. Mofied paused while away and resumed after returning                                                                                                                                                         |
| Paused foreground and About                 | A paused video remained stationary across Home/return. Playing intent resumed after returning behind Privacy and closing About; manually paused intent remained paused through the same sequence                                                                                                                       |
| Network failure and explicit recovery       | Verified an active iOS 100% packet-loss profile. After forcing a fresh load by terminating/relaunching and resuming, the one supplied spare was consumed and the terminal retry screen held active time at 14,001.6 ms. Clearing the profile did not autoplay; explicit Retry decoded the spare and resumed accounting |
| Natural full fixture                        | Passed without gestures or seeking: first video → 20-second reminder → second video → ending. No replacements were used and saved state was removed. Across uninterrupted sample spans of approximately 163.5 and 143.8 seconds, playhead and active-time deltas matched; reminder accounting matched the countdown    |

Local validation after the correction passed: frozen Bun installation, both TypeScript checks, **72 unit tests**, all **25 headed browser tests**, the web production build, Expo Android/iOS/web exports, the physical iPhone source build and the Swift cache's **200,000-operation Thread Sanitizer** check. The five new interruption cases are included in the unit-test total. Exports validate JavaScript/assets; the signed iPhone build separately compiled the modified Swift code.

The embedded Debug bundle showed `Cannot create devtools websocket connections in embedded environments`; temporary logging identified this as the development warning banner and was removed before the final source build. Local XCTest results, screenshots, app-scoped logs, interruption evidence and state samples are under ignored `artifacts/physical-ios/`. The table records completed reruns; exploratory harness runs are retained there too. The network-loss result uses a maintained, verified OS profile and a fresh load; an already buffered clip also completed under that profile, so buffered playback was not treated as a failure.

The original Dynamic Type setting was restored and all induced device conditions were verified inactive. Mofied was not installed before this pass, so a clean reinstall of the same verified app artifact removed all generated plans and temporary diagnostic storage/preferences. Fresh-install playback and manual-pause assertions passed. The disposable XCTest app was uninstalled, test/debugger processes stopped, and the local Xcode environment file restored. Mofied remains installed with the normal development mock paused.

Physical calls, headphone/Bluetooth changes, secure lock/unlock, spoken VoiceOver, broader Safari testing, production API integration and hosted CI remain deferred. Accessibility queries and enlarged-text checks do not substitute for a spoken screen-reader journey.

## Physical Android pass — 2026-11-06

Tested on a Samsung Galaxy Note20 (SM-N980F), Android 13/API 33, with an Arabic system locale, a 1080×2400 display and arm64 native code. Installed the existing debug APK containing the native patches from `b6fd655`; Metro served the current JavaScript over USB. The repository's public development fixtures and valid generated reminder plans were used. The first checks ran offline; the online checks below followed after connecting the phone to Wi-Fi. No production API or hosted CI result is claimed.

### Defects found and corrected on the phone

- **RTL system layout:** Android mirrored rows and alignment that the app already chooses explicitly. Arabic paragraphs and metadata aligned left, English rows were reversed, and `0:00 / 2:26` rendered as `2:26 / 0:00`. The app and modal roots now establish an LTR layout base while their children retain explicit UI/content directions. Physical screenshots verified Arabic/English alignment, speaker-row order and elapsed/total time. This correction was committed in `8230974`.
- **Interrupted media control:** During a transient interruption, the native button advertised Play even though activating it changed playing intent to manual pause. Its icon, accessibility label and activation action now follow user intent. Physical checks verified Pause during the interruption, Play after activation, and continued manual pause after focus returned.
- **Terminal retry screen acquiring focus:** After a real Wi-Fi failure exhausted recovery, returning to Mofied's error screen acquired focus and paused the separate QA AudioTrack without playing anything. The controller now exposes `retryRequired` independently of the display status, which can be masked by backgrounding or interruption. Android acquisition excludes that state until explicit Retry. Four controller/bridge regressions failed before the fix and pass afterward. On the phone, the other AudioTrack kept advancing through foreground return, Privacy/About and Wi-Fi reconnection; only explicit Retry acquired focus and started HLS playback. A related paused-restoration probe showed that a native source error could hide Retry behind the paused display status. The native error overlay now uses the same independent flag: Retry remains accessible while manual pause and other audio are preserved. A fifth regression covers failure during interruption followed by background/foreground release and reacquisition.

No native dependency changes were needed for these corrections.

| Physical check                    | Result                                                                                                                                                                                                                                                                                                                  |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Installation and decoded playback | Passed with the patched native APK and USB-served development bundle; both normal public HLS streams decoded and advanced                                                                                                                                                                                               |
| Startup Privacy                   | With fixture loading held, the Privacy page and its dialog survived acceptance. Video and accounting remained at zero, and another app's AudioTrack continued. Closing About acquired focus and started video                                                                                                           |
| Media interruption delivery       | Real transient and MAY_DUCK requests from a separate QA package stopped playhead/accounting while Mofied remained foreground. Permitted gain resumed playback. Unmuted transient/ducking and muted ducking passed                                                                                                       |
| Reminder interruption delivery    | Reminder-first sessions and a new interruption after disposing the preceding media player both paused countdown/accounting and resumed after permitted gain                                                                                                                                                             |
| Manual intent                     | Pausing during an interruption survived focus return. Privacy, About, UI-language changes and unmuting did not override manual pause                                                                                                                                                                                    |
| Restoration and acquisition       | Force-stop/relaunch restored the actual video position paused. The other AudioTrack kept advancing through paused restoration and paused foreground return; explicit Resume acquired focus and paused that track                                                                                                        |
| Initial focus denial              | Temporarily denying `TAKE_AUDIO_FOCUS` kept a reminder at 120,000 ms with zero active time. Restoring the original mode and explicitly resuming allowed progress. This is OS denial, not a telephony-locked/delayed-gain round trip                                                                                     |
| In-process context teardown       | Granted and transient reminder focus disappeared while the replacement bundle was held. The PID stayed unchanged, native context destruction was logged, restoration stayed paused, and explicit Resume acquired a new request. No database transaction failures occurred                                               |
| Background, lock and return       | Running reminders and decoded video stopped counting and released focus in the background and with the keyguard showing. Foreground return resumed playing intent. Video also resumed after normal secure unlocking                                                                                                     |
| Navigation and required reminder  | Swipe entered the required reminder; further swipe could not skip it. After completion, second-media playback and backward/forward history worked without repeating the consumed reminder                                                                                                                               |
| Wi-Fi loss and recovery           | Confirmed no active default network after disabling Wi-Fi. Buffered video continued legitimately, then the supplied replacement was consumed once and the terminal retry screen stopped accounting. Reconnecting alone did not retry or acquire new focus; explicit Retry played the replacement and resumed accounting |
| External links                    | Media title and speaker opened their expected public URLs in the system browser. Switching away paused playhead/accounting and released focus; returning to Mofied resumed playing intent                                                                                                                               |
| Reading continuity                | A long reminder retained its scrolled position through About and UI-language changes; the next consecutive reminder began at the top                                                                                                                                                                                    |
| Enlarged text and ending          | At system font scale 2.0, reminder citation and ending final line were reachable while countdown/Resume remained usable. Completing the generated reminder-only plan removed saved state and released focus                                                                                                             |
| Natural full fixture              | Passed without gestures or seeking: first video → 20-second reminder → second video → ending. No replacements were used. Saved state was removed and focus released. Across uninterrupted sample spans of about 158 and 132 seconds, playhead and active-time deltas matched                                            |

The Samsung audio service exposes live owners under `MultiFocusStack`, after a blank line beneath the usual focus-stack heading. Ownership checks read that section and exclude historical focus events. App-scoped logs contained no fatal exceptions, JavaScript runtime errors or SQLite transaction failures. Local screenshots, state samples, app-scoped logs and test scripts are under ignored `artifacts/physical-android/`. These measurements verify state transitions and accounting, not battery use, thermal behavior or precise performance benchmarks.

After the final source changes, both TypeScript checks, all **67 unit tests**, all **25 headed browser tests** (including actual hidden-tab playback), the web production build and Expo Android/iOS/web exports passed. The exports validate JavaScript/assets; this pass used the previously compiled native baseline and did not recompile unchanged native sources. The five new retry-focus cases are included in the unit-test total.

Actual calls, headphone/Bluetooth route changes and a spoken TalkBack journey remain pending. Android OS-focus requests and accessibility-tree checks do not replace those checks. Physical iOS results are recorded above. Production API integration and hosted CI remain deferred. The original font scale and audio-focus AppOp were restored, generated saved sessions were removed, the disposable focus requester was uninstalled, test browser tabs were closed, and test servers/USB forwarding were stopped. Mofied remains installed. The phone was left connected to Wi-Fi and locked; temporary credential files were removed.

## Third review follow-up

Addressed the two Android findings against `730d0f2` on 2026-11-06. This pass uses the documented development fixtures and valid generated mock plans. Physical devices, hosted CI and production API integration are deferred; no hosted result is claimed. Local evidence is under ignored `artifacts/round3/`.

| Finding                                              | Correction and validation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R3-1: acquiring focus while waiting for the user     | Separate acquisition eligibility from retaining an existing request. Paused restoration, paused foreground return and startup About defer acquisition; explicit eligible resume still waits for native permission. Four new controller/bridge tests fail against the previous policy and pass with the correction. On installed Android, a separate app's real AudioTrack kept advancing through paused restoration and paused foreground return without a focus-loss callback. Explicit resume acquired focus and paused that track. A delayed startup fixture also loaded behind the open native Privacy page with media/counting at zero and the other audio still advancing; closing About then acquired focus. |
| R3-2: teardown cleanup cancelled with its Expo scope | Each AppContext owns its manager; destruction removes and invalidates that owner. Main-thread cleanup uses the main Looper independently of Expo's coroutine scope. Seven native regressions cover granted/transient/delayed states, both destruction threads and old cleanup/callbacks overlapping a new context. Restoring cancellable-scope cleanup makes all seven fail; the corrected source passes.                                                                                                                                                                                                                                                                                                           |

Repeated installed reload testing also exposed an AsyncStorage teardown race: synchronous database close overlapped an active save, produced `SQLITE_BUSY`/transaction errors, and discarded the saved session. A separate small Android dependency patch serializes database work across contexts and queues close after in-flight operations. A native regression blocks a save, invalidates its module and starts a second context's save; the original implementation fails and the fix passes. (0.1.2 removed AsyncStorage, this patch and its regression with the last saved-session cleanup.)

| Local check                                              | Result                                                                                                                                 |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Frozen Bun install and native patches                    | Passed; installed patched native files match the compiled/tested sources                                                               |
| Both TypeScript checks, unit tests, web production build | Passed; 62 unit tests across six files                                                                                                 |
| Headed Chromium integration                              | All 25 passed, including actual hidden-tab playback                                                                                    |
| Expo Android/iOS/web exports                             | Passed; JavaScript/assets checks                                                                                                       |
| Android native source build                              | Passed; installed on the Android 16/API 36.1 emulator                                                                                  |
| iOS native source build and launch                       | Passed on iPhone 18 Pro/iOS 27.0 simulator; media advanced, and manual pause remained intact through About                             |
| Native Android lifecycle regressions                     | Eight passed: seven focus tests and one storage test against installed native code using Robolectric and mocked OS/database boundaries |
| Swift interruption cache                                 | 200,000 concurrent operations passed under Thread Sanitizer                                                                            |

Installed Android reload checks passed for reminders with both granted and transient focus. Native logs confirmed AppContext destruction while PID `25179` stayed alive. With the new bundle held, Mofied's old request disappeared from the OS focus stack. The replacement context preserved the saved reminder, stayed paused without focus, and acquired/released focus normally after explicit resume/backgrounding. Releasing the other requester did not resume the new context. Both reloads completed without database transaction failures or fatal exceptions. Delayed-state teardown is covered by the deterministic native tests rather than an emulator telephony claim.

The [native integration document](native-playback.md) describes the new local test command and the separate OS audio requester. The deterministic native tests complement emulator verification; they do not establish physical telephony or audio-route behavior. The production service and the release checks documented below remain separate work.

## Second review follow-up

Addressed the second review of `fe58ef7` on 2026-11-06. The architecture and server-defined ordering are retained. The API remains undeployed, so these checks use development fixture media and generated valid mock plans. Local evidence is under ignored `artifacts/round2/`.

| Check                                                       | Result                                                                                         |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Frozen Bun installation                                     | Passed                                                                                         |
| Root/mobile TypeScript, unit tests and web production build | Passed; 58 unit tests across six files                                                         |
| Headed Chromium integration                                 | All 25 tests passed, including a genuinely hidden tab                                          |
| Expo Android/iOS/web production exports                     | Passed; JavaScript and assets, separate from native compilation                                |
| Android and iOS native source builds                        | Passed and installed on Android 16/API 36.1 and iPhone 18 Pro/iOS 27.0 simulators              |
| Swift interruption-cache concurrency                        | 200,000 concurrent operations passed under Thread Sanitizer using the installed patched source |
| Contract regeneration and production fixture exclusion      | Passed; contract files unchanged and test markers absent from production JavaScript            |

### Findings and evidence

| Finding                                        | Correction and validation                                                                                                                                                                                                                                                                                                                                                                                |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R2-1: consecutive reminders retain scroll      | Both clients key the reminder by item identity. The browser regression scrolls A, opens/closes About, switches UI language and lets B start at zero. Removing just the key reproduces B at `scrollTop=2993`. Installed Android visibly resets to B's heading/opening text. Installed iOS keeps `contentOffset.y=2908.67` across About, then resets to `0` for B.                                         |
| R2-2: ending clips on short desktop            | Web ending uses a responsive reading frame with keyboard-reachable overflow. Regressions verify the title and final body line at 1440×600 with normal and doubled text sizes. Both regressions fail against the previous layout.                                                                                                                                                                         |
| R2-3: new Android interruption during reminder | Native focus ownership follows the foreground session, including no-player screens. Real OS transient requests freeze the countdown after normal media-to-reminder entry and on a reminder-first plan; release resumes it. The held reminder samples were respectively 18,948.63 ms and 11,936.46 ms.                                                                                                    |
| R2-4: automatic ducking bypasses pause handler | The session request explicitly sets pause-on-duck. An actual OS `MAY_DUCK` request froze video at 51,800 ms and counted time at 51,346 ms, then allowed progress on release. A separate manual-pause case stayed stopped after release. The OS focus stack confirms the pause-on-duck flag.                                                                                                              |
| R2-5: iOS interruption cache race              | Cache snapshot and listener access now share a small lock; delivery occurs after unlocking. The Thread Sanitizer stress check passes. An installed native notification check also freezes/resumes a reminder without a player. This fixes a source-level race; no production crash was established.                                                                                                      |
| English web ending is RTL                      | Ending language/direction derive from plan locale. The English-plan browser regression passes while UI language remains Arabic.                                                                                                                                                                                                                                                                          |
| Startup About/Privacy loses its page           | Both clients keep one About instance at the app root. The delayed-response browser regression retains Privacy, keyboard focus and paused playback through session acceptance. Native About also preserves the active reminder's scroll position.                                                                                                                                                         |
| Fractional reminder progress exceeds maximum   | Both clients round seconds consistently for `now` and `max`, and expose localized countdown text. A valid 1,500 ms reminder passes the browser range regression.                                                                                                                                                                                                                                         |
| English native media metadata is RTL           | Speaker row, name and title direction/alignment follow plan locale; content language is exposed on iOS. Installed iOS English metadata was visually checked, including punctuation and left alignment.                                                                                                                                                                                                   |
| Initial Android focus denial/delay             | Initial playback/countdown waits for native permission. The native play entry points reject playback without focus. Actual OS denial via the app's audio-focus operation holds unmuted playback/counting at zero. Restoring permission does not autoplay; explicit retry successfully starts playback. Unit regressions cover delayed gain, pause/About intent, background/end release and stale events. |

The six added browser scenarios were checked against the previous behavior before accepting their fixes. The native checks use the installed source builds; the TypeScript fakes establish controller/bridge ordering, not Android event delivery. The [native integration document](native-playback.md) includes commands for the OS requester and sanitizer checks.

The checked-in Android requester was separately built, installed and verified to acquire/release real OS focus. Test helpers were removed afterward and the original audio-focus AppOp was restored. A complete unmuted telephony-lock/delayed-gain round trip was not established reliably on the emulator; delayed gain has controller/bridge regression coverage, while the OS denial, transient and ducking results above are independently verified.

### Release dependencies

The production endpoint is still unavailable. Deployed CORS, manifest/segment delivery, signed URL lifetime across restoration, expiry and real error responses still require the deployed service. No production API fallback or private Rails data was introduced.

Hosted Actions had an account billing/spending-limit block on run `42187570241`, before any steps executed. Repository code cannot repair that account setting. Successful hosted jobs remain required for a release candidate. Physical calls, Bluetooth/headphone routes, full spoken VoiceOver/TalkBack journeys, broader Safari behavior, asset rights and final privacy/support destinations remain the release work described below.

## First review follow-up

Reviewed and corrected the feedback against `7496f9e` on 2026-11-06. All eight reported defects were confirmed; the client fixes and regression tests are included in this follow-up. The production session API is still unavailable, so verification uses the documented development plans, their public HLS media, and generated browser fixtures. This is not production-launch approval.

## Checks on this change

| Check                                                             | Result                                                                                |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Frozen Bun installation                                           | Passed with `mise exec -- bun install --frozen-lockfile`                              |
| Strict TypeScript, shared/native unit tests, web production build | Passed with `mise exec -- bun run check`; 53 tests                                    |
| Browser integration                                               | All 19 tests passed in headed Chromium on macOS, including the actual hidden-tab test |
| Expo production exports                                           | Android, iOS and web passed; these are JavaScript/assets exports                      |
| Contract generation                                               | Generated schema and example unchanged                                                |
| Production fixture exclusion                                      | Test endpoint and development fixture markers absent from the production web bundles  |
| iOS native compilation                                            | Fresh source build and installed launch passed on iPhone 18 Pro simulator, iOS 27.0   |
| Android native compilation                                        | Fresh source build and installed launch passed on the Android 16 / API 36.1 emulator  |
| Hosted GitHub Actions                                             | Account runner block, described below; no successful hosted signal                    |

Native builds include the modified Expo native sources. Stock Expo Go was not used. Logs, screenshots, baseline failures and native state snapshots are retained locally under ignored `artifacts/review-follow-up/`.

## Eight findings, individually verified

| Review finding                                                                | Confirmation and correction                                                                                                                                                                                                                                                                                  | Validation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.1 Interruption can strand a reminder; muted playback can continue uncounted | Confirmed player-lifetime subscription and muted pause gap. The native Expo module now owns the event and caches interruption state independently of players. A session-lifetime subscriber handles it. Android retains transient focus requests until gain, and all players pause, including muted players. | Seven subscription/controller regressions cover navigation/end into a reminder, no player, denied resume, manual/About/background intent, initial reconciliation and disposal. Muted native-adapter regression passed. Actual Android OS focus loss → navigation → reminder → focus gain resumed the countdown and subsequent media. iOS native AVAudioSession notification injection passed the equivalent transition.                                                                        |
| 2.2 Native media surface absent from iOS accessibility tree                   | Confirmed missing `accessible`. Exposed a button with native activation and localized next/previous actions; only available navigation actions are offered. Added `onAccessibilityTap` for iOS activation.                                                                                                   | Installed iOS accessibility snapshot exposes the button. UIKit accessibility activation started real HLS playback; custom Next entered the reminder, and Previous returned to the earlier media after reminder completion. Android native accessibility activation and localized Next/Previous actions also passed through UiAutomation, advancing real playback and preserving the required reminder. These are native accessibility API checks, not a complete physical screen-reader audit. |
| 2.3 Reminder overlap/clipping                                                 | Confirmed with shipped Quran text in a short desktop viewport and long valid text on a phone. Reading body now has a bounded scroll region; controls occupy a separate region. Reading screens no longer inherit the video aspect ratio. Native uses a ScrollView and a separate footer.                     | Browser regressions pass at 1440×600 and 390×844, including enlarged text. Keyboard scrolling reaches the citation while pause/resume stays in the viewport. Interactive screenshots confirm the result. Installed native large-text checks are described below.                                                                                                                                                                                                                               |
| 2.4 Query strings discard restoration                                         | Confirmed against a production build with an HTTPS mock API. Restoration now ignores unrelated query parameters. Only recognized development fixture/test parameters bypass it when no API is configured.                                                                                                    | Production regression retains the same session, paused position and API request count for `/`, tracking parameters, arbitrary parameters, and production URLs containing fixture/test names. The original condition fails this regression.                                                                                                                                                                                                                                                     |
| 2.5 Failure cap resets on ready/playing alone                                 | Confirmed with the actual native adapter and six ready-but-stalled fake players. Reset now requires accepted positive playback time.                                                                                                                                                                         | Adapter/controller regression stops at the configured third consecutive failure; baseline attempted all six with zero counted playback.                                                                                                                                                                                                                                                                                                                                                        |
| 2.6 Arrows fail after clicking controls                                       | Confirmed focused player/button/link exclusions. Arrows now navigate from media controls; Space keeps ordinary activation. Dialogs, editing fields, reading regions and modified keys are excluded.                                                                                                          | Browser regression clicks the player, activates it with Space, navigates with ArrowDown, focuses a speaker link and returns with ArrowUp.                                                                                                                                                                                                                                                                                                                                                      |
| 2.7 Ctrl+wheel navigates                                                      | Confirmed missing modifier handling. Ctrl/Meta/Alt/Shift wheel events are ignored, and wheel navigation applies only to media.                                                                                                                                                                               | Regression verifies each modifier preserves the current item, followed by successful ordinary wheel navigation.                                                                                                                                                                                                                                                                                                                                                                                |
| 2.8 Narrow web loses accessible navigation                                    | Confirmed `display:none` removed the rail from accessibility. Previous/next remain semantic buttons and become visible on keyboard focus.                                                                                                                                                                    | At 390×844 the buttons are available by role, enter the viewport on focus, and navigate in both directions through Enter activation.                                                                                                                                                                                                                                                                                                                                                           |

## Secondary feedback

- **Architecture and scope (sections 3–4):** retained the shared controller, server ordering, finite ending, and existing product scope. Extracted native session lifecycle/persistence, Reminder and Ending components. About remains a separate function in App; no rewrite was needed.
- **Diagnostics (section 5):** configuration, network, HTTP, malformed JSON, invalid plan, expiry, timeout and cancellation have distinct internal categories. Logs contain category/status, not payloads or signed URLs. Contract tests verify categories and sanitized diagnostics; configured failures still never fall back to fixtures.
- **HLS startup cost (section 6):** dynamically import hls.js only for fallback playback. Main production JavaScript fell from approximately 928 KB / 289 KB gzip to 352 KB / 109 KB gzip. The separate fallback is approximately 578 KB / 180 KB gzip and still produces Vite's nonblocking chunk-size warning. This measures bundle transfer size, not first-frame performance on a physical modest phone.
- **Timer jitter (section 6):** account cumulative playhead/wall totals within uninterrupted playback rather than permanently discarding each sample's discrepancy. The reported synthetic 60-second trace counted 57.6 seconds before the fix and now counts 60. Existing pause, buffering, seek, delayed-callback and budget tests remain passing. Physical-device drift has not been benchmarked.
- **HLS test gap (section 7):** added a small generated MPEG-TS HLS fixture. Real decoded hls.js playback, fatal manifest retries/replacement and transient segment failure/recovery pass. This also exposed and fixed initial manifest retry: `startLoad()` cannot reload a failed initial manifest; those failures now use bounded `loadSource()` retries.
- **Startup language metadata (section 8):** moved document language/direction to the app-level locale owner. The browser test switches language while the API fails and verifies `html.lang`/`dir` immediately.
- **Native link errors (section 8):** failed `Linking.openURL()` calls show localized feedback. On installed Android, temporarily removing the mail handler produced the localized error alert; the handler was restored. No message was sent.
- **Version (section 8):** the root package version feeds both About screens and the Expo app configuration; duplicated display/configuration literals were removed.
- **Language boundaries (section 8):** web media metadata and reminder content direction follow plan locale; native reminders also follow plan locale, and Quran remains Arabic. UI language still changes labels locally. Persistent preference and server-localized plan selection remain explicitly deferred to API integration.
- **Budget copy (section 8):** after the budget is consumed, the header says the current media/reminder is finishing, while preserving the existing finish-current-item rule.
- **Assets/public URLs (section 8):** independent-app font rights, canonical privacy/support destinations and store packaging remain owner/release work. No rights or public destinations were invented.

## Installed native evidence and limits

Both newly compiled apps launched, streamed the development fixture's public HLS URLs, progressed through the ordered reminder and second media, reached the finite ending and removed their saved session. Stored development plans were also used to exercise paused restoration and long reading content without adding production test hooks.

Android interruption checks used a separate disposable QA application requesting real AudioManager transient focus. The reminder stayed at 20,000 ms while focus was held and no VideoPlayer existed, then resumed after release. A muted video remained at 130,210 ms during interruption and resumed to completion after release. No replacement was consumed.

iOS interruption checks posted AVAudioSession interruption notifications through the native notification center using the debugger. A reminder stayed at 12,515.6 ms until end/shouldResume; subsequent media played. A separate muted-video check held the playhead at 81,010.3 ms and counted time at 80,968.5 ms across samples, then navigated through the accessible Next action to a still-paused reminder. End/shouldResume resumed it and advanced to the second media. This exercises the native bridge and component lifetime; it does not simulate the telephony stack or establish physical-call/Bluetooth behavior.

The largest iOS accessibility text size exposed a clipped compact time badge. Its height now grows with its contents, its width can shrink, and its secondary status text has a bounded scale. Reminder body/footer text retains system scaling. At the largest iOS size and Android font scale 2.0, the long valid reminder scrolled to its citation while countdown and resume stayed visible. Screenshots were inspected, and system text sizes were restored afterward.

TalkBack was enabled temporarily and the media control received accessibility focus; its action menu was inspected. A complete gesture-driven TalkBack journey was not established because the CLI instrumentation and TalkBack competed for input. Navigation was verified through Android's native accessibility actions with the instrumentation isolated. VoiceOver's native activation/custom-action callbacks were exercised on iOS; a full spoken screen-reader audit remains open.

A Safari smoke check on the iOS simulator played public HLS with muted autoplay, opened/closed About, and reached the ending after a navigation gesture. This was a native Safari check; hidden-tab and physical-device autoplay policies still require the broader release pass.

## Remaining release checks

1. Deploy the Rails endpoint, then verify deployed-origin API/media CORS, signed URL lifetime across restoration, error responses and privacy wording. Mocked API tests cannot establish these production properties. Server selection, publishing, caching, rate limiting and hosting security remain outside this client repository.
2. Restore hosted CI execution. Run `42108477008` failed before any job steps. GitHub's check annotation says: “The job was not started because recent account payments have failed or your spending limit needs to be increased. Please check the 'Billing & plans' section in your settings”. Local passing builds do not resolve account billing.
3. Repeat release-build interruption and route changes on physical iOS/Android phones: incoming calls, denied resumption, manual pause, Bluetooth/headphone transitions, lock/background, network loss and recovery. Emulator OS focus and injected iOS notifications are narrower evidence.
4. Complete the physical VoiceOver/TalkBack audit and Safari/iOS browser autoplay/tab-policy checks, including small phones and tablets. Native accessibility action checks and Chromium integration tests do not replace these.
5. Confirm the font redistribution rights and public privacy/support URLs in [asset provenance](asset-provenance.md), then finish store packaging. This review did not perform a dependency-vulnerability or production hosting-security audit.

## Existing regression coverage retained

Tests continue to cover ordered non-skippable reminders, pause-to-read, consumed reminders, countdown overshoot, About and manual intent, backgrounding, denied interruption resumption, finish-current-item budgets, finite replacement use, paused restoration and ended-state removal. The Android delayed `playingChange(false)` buffering race and the English timer's rendered number-first order remain covered.

The headed hidden-tab test uses a separate Chrome process with focus emulation disabled, confirms the document is actually hidden, and verifies media advancement plus reminder-to-media transition after sound activation. A synthetic visibility event is not used as evidence. Browser/OS suspension policies still apply, as documented in [product decisions](product.md).
