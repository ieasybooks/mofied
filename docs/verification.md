# Implementation verification

Updated after the Android buffering race and English timer direction fixes on 2026-11-05, on top of the accepted overlay at `e8f5036`. TypeScript, all 42 unit tests, all 8 headed browser tests, the web production build and all three Expo exports passed. The external retest at `639f9c9` confirmed the original startup/HLS fixes and reported these two remaining defects. Current native adapter tests and bundle exports are separate from installed runtime verification, which remains outstanding for the new fix.

| Check                                                              | Result                                                                                                                 |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Strict TypeScript: web, shared packages, native                    | Passed                                                                                                                 |
| Contract, session, timer-label, HTML and native media health tests | 42 passed, including 13 native adapter tests                                                                           |
| Browser integration tests                                          | 8 passed in headed Chrome under Xvfb                                                                                   |
| Web production build                                               | Passed                                                                                                                 |
| Expo production export: Android, iOS, web preview                  | Passed, including Hermes bundles; this is not a native launch test                                                     |
| Import and timer formatting with `Intl.PluralRules` unavailable    | Passed in the automated compatibility regression                                                                       |
| Earlier public R2 native-HLS browser check                         | Passed for 35 seconds in headed Linux Chrome 150, including five naturally occurring buffered `stalled` events         |
| iOS/Android native builds at `5481285`                             | Reported passed by the external tester; both installed apps then failed at startup                                     |
| External installed-app retest at `639f9c9`                         | Startup fixed on both platforms; iOS normal session completed; Android continuous playback failed on the reported race |
| Installed iOS/Android journeys after the new race fix              | Not rerun: Agent device access is disabled in this session, and this Linux host has no Xcode                           |

## Android buffering race and English timer direction

Both targeted regressions failed before the corrections. Replaying the reported Android callback order turned `shouldPlay` false at the 89ms delayed `playingChange(false)` event. The corrected adapter retains intent, reconciles live player state and advancing time, and does not turn native buffering into an autoplay prompt. The same sequence now passes with muted and unmuted intent, followed by 25 seconds of advancing playback without a replacement. Recovery without a new playing callback, genuine no-progress timeouts, a bounded resume request, long pauses, interruption permission, delayed time callbacks and cleanup are also covered. These tests use the real controller and a fake native player; they do not certify Android HLS decoding or OS event delivery.

The timer regression measured rendered text using DOM Ranges: before the fix, the English number was visually after “minutes left” despite correct DOM text. The label now uses the selected locale's direction while the badge retains its existing clock/progress layout. The regression verifies “8 minutes left” at 1280px and 375px, both while Info is open and after it closes.

Logs are in ignored `artifacts/android-race-fix/`, including the failing baseline regressions, `check.log`, `web-e2e.log` and `mobile-export.log`. The device integration returned “Agent device access is turned off for this environment”; no installed native playback run was performed or replaced with a browser preview claim.

## Accepted player overlay

The running web app and Expo browser preview were checked at 393×852, 360×800 and 320×568 with public R2 media, Arabic/English UI, single- and two-line titles, and a missing portrait. Desktop was captured at 1440×900. The phone bottom fade measures 214px for a single-line title and 256px for two lines without safe insets, matching the accepted spec. Info and sound each measure 44×44px, with a 12px gap; the English time pill clears both controls at the narrowest tested width. No horizontal overflow or page errors occurred.

The existing mobile browser test now activates sound, verifies mute state and preserved pause intent, and taps/swipes through the fade above the metadata. It confirms that the sound control disappears on reminders. The same interaction checks passed in the Expo browser preview, including About/language switching and swiping into the reminder. These preview checks do not establish native gestures or rendering on installed iOS/Android apps.

Contrast was measured on the actual rendered UI over a solid white frame, with text hidden and text shadows removed. The brightest pixel within each visible text line was used. Across the phone cases, minimum ratios were 4.85:1 for speaker text, 6.04:1 for titles and 6.34:1 for elapsed/total time. Desktop time in the new 128px fade measured 5.04:1. All checked text met its WCAG AA threshold.

The implementation captures and accepted dimensions are linked from [the overlay spec](design/player-overlay.md). Detailed layout, contrast and interaction evidence remains in ignored `artifacts/player-overlay-implementation/`; check/export logs are `artifacts/player-overlay-*.log`. Device safe-area rendering and installed runtime verification remain outstanding.

## Earlier runtime regressions

Both new regressions failed against the original implementation before the fixes were applied.

The design package no longer constructs `Intl.PluralRules` during import. The timers already round to nonnegative integers, so Arabic singular/dual/few forms use their integer cardinal rules directly: exactly 1, exactly 2, and 3–10 modulo 100. The regression imports the design package with `Intl.PluralRules` undefined and verifies Arabic/English formatting. The external installed-app retest at `639f9c9` subsequently confirmed that startup and initial playback work on both iOS and Android.

Web playback now distinguishes a stalled network fetch from stopped media. Buffered `waiting`/`stalled` events do not mark healthy playback as buffering. Advancing timeupdates restore playing status if a browser omits another `playing` event. A watchdog samples the actual playhead before deciding whether 20 seconds have elapsed without progress, and resets its recovery window across About/manual pauses. Actual no-progress failures still consume the supplied replacement.

The browser regression plays real decoded local media, injects a buffered `stalled` event, and continues for 22 seconds beyond that event. It verifies that the original media remains, the buffering indicator is absent, session time advances, and no replacement is consumed. The short test clip loops only inside the test to keep it playing beyond the watchdog deadline.

The earlier runtime-fix public-stream check used the unmodified `normal` fixture and no media interception or injected events. Chrome reported `canPlayType("application/vnd.apple.mpegurl") === "maybe"` and played the direct `.m3u8` URL. Its first real `stalled` event occurred at 3.42 seconds with `readyState === 4`; four more followed. The same `media-44445` was still playing at 35.10 seconds, the last persisted active counter was 34.16 seconds, and `usedReplacements` was empty. This verifies the native HLS browser path on Linux Chrome; it does not substitute for Safari or the reported macOS Electron environment. The event log and screenshot are under ignored `artifacts/runtime-fixes/`.

## Automated coverage

The shared tests cover advancing media time, buffering, pause, seek jumps, stale callbacks, hidden-tab delayed progress, ordered non-skippable reminders, countdown overshoot, pause-to-read, consumed reminders, About, native background intent, interruption resumption permission, the finish-current-item budget, bounded replacements, natural endings and paused restoration. Contract tests cover fixtures, identity/URL/version/expiry validation, API failures and request timeouts.

The browser tests exercise actual HTML media playback, About and privacy, manual pause preservation, reminder completion and ending, replacement media, API failure without fixtures, title clamping and swipe navigation. They also check plain-hyphen citation ranges in actual rendered left-to-right number order within Arabic text and the absence of reminder source footnotes.

The reminder UI correction pass additionally verified Arabic/English countdown and minute plurals, including dual forms and plural-rule boundaries. The compatibility regression now checks formatting without `Intl.PluralRules`. Arabic and English web/native-layout screenshots confirm the selected language comes before the trailing arrow. Native layout verification uses the Expo browser preview; platform runtime limitations below still apply.

HTML media health tests cover buffered stalls, recovery without another playing event, delayed background callbacks, actual stalled playback and startup timeouts, manual/About pause windows, seeking, and listener/watchdog cleanup.

One browser test deliberately attaches to a raw Chrome process with Playwright's default focus emulation disabled. It verifies `document.visibilityState === 'hidden'`, advancing media position, reminder countdown and subsequent media playback after a user gesture enables sound. A synthetic visibility event is not used as proof of background playback. Chrome's untouched-muted-autoplay suspension remains a browser restriction, reflected in the UI.

Browser tests use a generated local video through request interception. Screenshots of the running app use real public R2 media. Native-layout screenshots labeled “Expo browser preview” do not establish behavior on iOS/Android.

## Required device pass before launch

First repeat the Android `normal` and `missing-portrait` public HLS runs with sound enabled and muted, watching beyond the previously failing 35-second mark and through a complete session. Repeat iOS continuous playback because the adapter is shared. Cold-launch against the updated bundle and confirm app registration and Info access. Agent device access must be enabled in Settings > Integrations > Devices for a new agent session if these checks are to be repeated through the device integration. Use the Expo interruption patch, then repeat on release builds:

1. iOS and Android: stream HLS with sound, swipe both ways, verify long titles and absent portraits, complete a reminder and the final ending.
2. Open/close Info while playing and while manually paused; verify position and prior intent. Check privacy during an API outage.
3. Background and lock during media and during a reminder; verify silence, no PiP, no elapsed-time consumption, and prior-intent resumption on foreground return.
4. Open Control Center / notification drawer without leaving the app; verify no app-induced pause.
5. Take and finish a phone call during playback. Verify resumption only on the platform's permission, no replacement after 20 seconds, and no resumption if manually paused beforehand. Repeat with Bluetooth/headphone routing.
6. Disconnect network, restore it, and exercise finite recovery/retry. Relaunch an in-progress session and check paused restoration; an ended session must not resurrect.
7. Verify VoiceOver/TalkBack, font scaling, small devices/tablets, and actual Safari/iOS browser autoplay and tab policies.

CI contains web/shared checks plus separate Android and unsigned iOS simulator build jobs. The first GitHub run could not start any jobs: GitHub reported “recent account payments have failed or your spending limit needs to be increased.” This is an account runner block, not a test result. Resolve it in Billing & plans and rerun the workflow. The iOS compilation job has therefore not run.

Build success does not replace the physical interruption and audio-routing pass.
