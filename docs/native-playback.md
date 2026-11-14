# Native playback integration

Native media uses `expo-video` 58.0.13. Background playback, PiP, native controls, fullscreen, external playback and Now Playing notifications are disabled. Only app background/lock pauses the session; inactive/blur alone does not.

## Session-lifetime interruption source

The pinned Expo API does not expose the complete interruption lifecycle to JavaScript. Inferring calls from buffering would incorrectly replace valid media after a network timeout.

`patches/expo-video@58.0.13.patch` adds `audioInterruption` to the **ExpoVideo native module**, plus `getAudioInterruption()` returning the latest state:

```ts
{
  interrupted: boolean;
  mayResume: boolean;
}
```

`use-session-lifecycle.ts` subscribes through `watchSessionInterruptions` for the entire session, including reminders with no VideoPlayer. `NativeMedia` does not own this subscription.

- Android exposes `setAudioSessionActive(active, generation)` on the main queue. A foreground session acquires a `DO_NOT_MIX` request only when it intends to run and About is closed, including a running reminder with no player. Once acquired, About and manual pause retain that request; background, ending and disposal release it. A paused restoration/foreground return or a session arriving behind startup About does not acquire focus until eligible. A terminal media error also defers new acquisition until explicit Retry, including after foreground return or closing About. The controller exposes `retryRequired` independently of the display status so background/interruption cannot hide that condition; the native error overlay uses it to keep Retry reachable while paused. Acquisition uses user intent and retry eligibility, not `shouldPlay`, because permission is initially gated. The ordinary player focus manager cannot abandon or change this session request.
- Android requests pause-on-duck callbacks with `setWillPauseWhenDucked(true)` and accepts delayed focus gain. Initial acquisition and delayed gain block playback and reminder accounting. Denial/permanent loss require explicit retry; transient loss waits for OS gain without reacquiring. The native `play`/`replay` entry points also check focus permission before starting the player. Android 7 uses the legacy focus API; Android 8+ uses `AudioFocusRequest`.
- Android events carry `focusGeneration`, identifying their ownership request. JavaScript ignores callbacks queued before backgrounding or reacquisition. The native owner separately ignores callbacks from abandoned AudioFocusRequests. No phone-state permission is requested.
- Android gives each Expo AppContext its own audio-focus manager. Destruction removes that specific owner and immediately invalidates its listener. Cleanup runs directly when already on main, or through the main Looper's Handler otherwise, independently of the AppContext coroutine scope Expo cancels. Old cleanup, player disposal and callbacks cannot modify a newer context's ownership.
- iOS forwards `AVAudioSession.interruptionNotification` and caches the `shouldResume` option independently of player lifetime. The synchronous getter and listener access use `AudioInterruptionState`'s lock. State and listener are copied under the lock; callbacks run after unlocking. The JavaScript subscriber attaches before reconciling the cached snapshot. iOS can deliver interruption-begin while backgrounded without a matching end on return. When foreground intent becomes eligible again (return, explicit resume, closing About or Retry), `resumeAudioSession()` attempts exclusive playback-session activation on the main queue. Only successful native activation publishes resumed permission; denial keeps the session interrupted. A new interruption while already eligible does not trigger reacquisition, and paused restoration, About, background and terminal error defer the attempt.
- Native interruption begin pauses all players, including muted video. The JavaScript adapter also aligns actual playback with `shouldPlay`.
- Permission to resume never overrides manual pause, About or app backgrounding. Native stopped/playing callbacks cannot grant interruption permission or imply browser autoplay denial.

Bun applies the patch on install. `apps/mobile/package.json` sets `expo.autolinking.buildFromSource` to `expo-video` so a prebuilt module cannot bypass it. Rebuild/install a development client after changing the patch; stock Expo Go and JavaScript exports cannot validate this extension. Review/remove the patch when upgrading to an Expo release with equivalent upstream functionality.

Fresh Android and iOS source builds passed on 2026-11-06, including the second review's changes. Installed Android OS focus and iOS native-notification checks passed. See [verification](verification.md) for precise evidence and the remaining physical-call/audio-route checks.

## Repeating the native boundary checks

On macOS, `mise exec -- bun run test:native-cache` compiles the installed patched Swift cache with Thread Sanitizer. It runs 200,000 concurrent updates, snapshot reads and listener changes, including a callback that reads the cache again. The iOS CI job runs this check too.

After generating the Android project, `mise exec -- bun run test:android-lifecycle` runs seven focus regressions against the installed patched Kotlin sources, plus a storage teardown regression against the installed Java source. They invoke the production module-destruction entry point and cancel the associated context scope before draining the main Looper. Granted, transient and delayed requests are tested on both main/background destruction paths, as is an old owner's pending cleanup overlapping a new context. The tests use Robolectric and mocked context/OS responses; they establish native cleanup and isolation, not OS focus delivery. Test-only Gradle dependencies are injected by `tests/native/android/lifecycle.gradle` and never enter the shipped app.

For Android, prebuild/compile/install the development client first. With Java and the Android SDK available, build the separate OS focus requester:

```sh
mise exec -- bash scripts/build-android-focus-probe.sh
adb install -r artifacts/android-focus-probe/probe.apk
adb shell am broadcast -n com.mofied.qa.focus/.FocusReceiver -a request --ei gain 2
adb shell am broadcast -n com.mofied.qa.focus/.FocusReceiver -a release
```

The build script uses SDK platform 37.0/build-tools 37.0.0 and the generated Expo debug keystore. The helper targets API 34 so its background receiver can request focus while Mofied remains visible. It is test-only and is not included in Mofied's builds. Uninstall an older helper first if it was signed with a different development key.

Use gain `2` for transient loss and `3` for `AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK`. Verify actual playhead and counted time stop, then resume only when user intent permits. Repeat after entering a reminder normally, with a reminder-first plan, and with manual pause/About already active. Use `adb shell dumpsys audio` to verify the OS focus stack and `PAUSES_ON_DUCKABLE_LOSS`, rather than directly emitting JavaScript events.

For acquisition checks, request gain `1` with `--ez tone true`. The helper plays a quiet looping AudioTrack and pauses on focus loss. The `status` action reports its play state, playback head and last focus callback. Paused restoration and paused foreground return must leave that track advancing without a loss callback; explicit resume should acquire focus and pause it. The `release` action stops the track and abandons focus. Inspect the current **Audio Focus stack entries** in `dumpsys audio`, not its historical events log. Uninstall the helper after testing.

For context teardown, start a reminder, record Mofied's PID and OS request, then reload the React context while keeping the process alive. Hold the new bundle response long enough to inspect cleanup before the replacement context starts. The old request must disappear, and the restored session must remain paused without reacquiring. Explicit resume in the new context must acquire normally. Repeat during a transient interruption, release the other requester, and verify the old callback cannot resume the new session. Killing the app process does not validate this boundary.

For denial, record `adb shell cmd appops get com.mofied.app TAKE_AUDIO_FOCUS`, temporarily set that operation to `ignore`, and launch/resume the app. Playback and counting must remain stopped. Restore the recorded mode, verify playback still waits for explicit retry, then retry. Always restore the original mode in cleanup. For delayed gain, an emulator GSM call can hold the actual telephony focus lock: keep Mofied foreground while the call is active, request playback, then cancel the simulated call. These are OS checks on an emulator, not physical telephony/audio-route certification.

## Buffering and recovery

`native-playback-health.ts` reconciles callbacks with current player properties and playhead. Android can deliver `playingChange(false)` after returning to `readyToPlay` and resuming. That callback does not remove play intent.

Advancing playback restores playing state even without another playing callback. The watchdog samples the live playhead before deciding whether to replace media. A ready but stopped player gets one automatic resume request per period without progress. Twenty seconds without progress triggers bounded replacement/error behavior. Status callbacks cannot reset that deadline or the controller's consecutive-failure streak; the streak resets after accepted positive playback accounting.

About, manual pauses, backgrounding and interruptions suspend the watchdog; resumption gets a fresh window. Disposed players and old-item callbacks cannot affect the next item. Adapter tests use fake players and the real session controller, including the reported Android buffering race, six consecutive ready-but-stalled players and interruption/pause intent. They complement installed playback tests rather than substituting for native decoding or OS delivery.
