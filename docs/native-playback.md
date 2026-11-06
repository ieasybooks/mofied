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

`use-session-lifecycle.ts` subscribes through `watchSessionInterruptions` for the entire session, including reminders with no VideoPlayer. It subscribes before reading cached native state, covering an interruption that began before the session was mounted. Cleanup removes the module listener. `NativeMedia` does not own this subscription.

- Android retains its focus request during transient loss so disposing the last player or pausing a muted player cannot discard the eventual gain callback. New players cannot reacquire focus while that transient interruption is held. Gain clears the interruption and reconciles focus. Permanent loss clears interruption with `mayResume:false`, requiring explicit user resumption. Module teardown clears the observer/state and abandons focus. No phone-state permission is requested.
- iOS forwards `AVAudioSession.interruptionNotification` through the module and caches the `shouldResume` option independently of player lifetime.
- Native interruption begin pauses all players, including muted video. The JavaScript adapter also aligns actual playback with `shouldPlay`.
- Permission to resume never overrides manual pause, About or app backgrounding. Native stopped/playing callbacks cannot grant interruption permission or imply browser autoplay denial.

Bun applies the patch on install. `apps/mobile/package.json` sets `expo.autolinking.buildFromSource` to `expo-video` so a prebuilt module cannot bypass it. Rebuild/install a development client after changing the patch; stock Expo Go and JavaScript exports cannot validate this extension. Review/remove the patch when upgrading to an Expo release with equivalent upstream functionality.

Fresh Android and iOS source builds passed on 2026-11-06. Installed Android OS focus and iOS native-notification checks passed across media/reminder transitions, including muted playback. See [verification](verification.md) for precise evidence and the remaining physical-call/audio-route checks.

## Buffering and recovery

`native-playback-health.ts` reconciles callbacks with current player properties and playhead. Android can deliver `playingChange(false)` after returning to `readyToPlay` and resuming. That callback does not remove play intent.

Advancing playback restores playing state even without another playing callback. The watchdog samples the live playhead before deciding whether to replace media. A ready but stopped player gets one automatic resume request per period without progress. Twenty seconds without progress triggers bounded replacement/error behavior. Status callbacks cannot reset that deadline or the controller's consecutive-failure streak; the streak resets after accepted positive playback accounting.

About, manual pauses, backgrounding and interruptions suspend the watchdog; resumption gets a fresh window. Disposed players and old-item callbacks cannot affect the next item. Adapter tests use fake players and the real session controller, including the reported Android buffering race, six consecutive ready-but-stalled players and interruption/pause intent. They complement installed playback tests rather than substituting for native decoding or OS delivery.
