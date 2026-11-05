# Initial implementation verification

Local checks on 2026-11-05. This report distinguishes application tests, native compilation and OS/device behavior.

| Check                                                        | Result                                                                           |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| Strict TypeScript: web, shared packages, native              | Passed                                                                           |
| Contract + session-controller tests                          | 16 passed                                                                        |
| Browser integration tests                                    | 6 passed in headed Chrome under Xvfb                                             |
| Web production build                                         | Passed                                                                           |
| Expo production export: Android, iOS, web preview            | Passed, including Hermes bundles                                                 |
| Android debug APK, including source-built patched expo-video | Passed                                                                           |
| Production fixture exclusion                                 | No fixture catalog markers or R2 fixture URLs in web JS or native Hermes exports |
| Real public R2 HLS playback                                  | Observed advancing in web and Expo browser preview                               |
| Android installed-app lifecycle                              | Pending; software emulator available, installation/runtime checks in progress    |
| iOS native compilation/runtime                               | Not locally verified; this Linux host has no Xcode                               |

## Automated coverage

The shared tests cover advancing media time, buffering, pause, seek jumps, stale callbacks, hidden-tab delayed progress, ordered non-skippable reminders, countdown overshoot, pause-to-read, consumed reminders, About, native background intent, interruption resumption permission, the finish-current-item budget, bounded replacements, natural endings and paused restoration. Contract tests cover fixtures, identity/URL/version/expiry validation, API failures and request timeouts.

The browser tests exercise actual HTML media playback, About and privacy, manual pause preservation, reminder completion and ending, replacement media, API failure without fixtures, title clamping and swipe navigation.

One browser test deliberately attaches to a raw Chrome process with Playwright's default focus emulation disabled. It verifies `document.visibilityState === 'hidden'`, advancing media position, reminder countdown and subsequent media playback after a user gesture enables sound. A synthetic visibility event is not used as proof of background playback. Chrome's untouched-muted-autoplay suspension remains a browser restriction, reflected in the UI.

Browser tests use a generated local video through request interception. Screenshots of the running app use real public R2 media. Native-layout screenshots labeled “Expo browser preview” do not establish behavior on iOS/Android.

## Required device pass before launch

Use installed development builds with the Expo interruption patch, then repeat on release builds:

1. iOS and Android: stream HLS with sound, swipe both ways, verify long titles and absent portraits, complete a reminder and the final ending.
2. Open/close Info while playing and while manually paused; verify position and prior intent. Check privacy during an API outage.
3. Background and lock during media and during a reminder; verify silence, no PiP, no elapsed-time consumption, and prior-intent resumption on foreground return.
4. Open Control Center / notification drawer without leaving the app; verify no app-induced pause.
5. Take and finish a phone call during playback. Verify resumption only on the platform's permission, no replacement after 20 seconds, and no resumption if manually paused beforehand. Repeat with Bluetooth/headphone routing.
6. Disconnect network, restore it, and exercise finite recovery/retry. Relaunch an in-progress session and check paused restoration; an ended session must not resurrect.
7. Verify VoiceOver/TalkBack, font scaling, small devices/tablets, and actual Safari/iOS browser autoplay and tab policies.

CI contains web/shared checks plus separate Android and unsigned iOS simulator build jobs. Build success does not replace the physical interruption and audio-routing pass.
