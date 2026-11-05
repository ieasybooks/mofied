# Native playback integration

Native media uses `expo-video` 58.0.13. Background playback, PiP, native controls, fullscreen, external playback and Now Playing notifications are disabled. Only app background/lock pauses the session; inactive/blur alone does not.

## Interruption events

The installed Expo version pauses on Android audio-focus loss but explicitly does not resume automatically on gain. Its iOS API also does not expose `AVAudioSession` interruption events to JavaScript. Inferring calls from buffering would incorrectly replace valid media after a network timeout.

`patches/expo-video@58.0.13.patch` adds a single typed `audioInterruption` event:

```ts
{
  interrupted: boolean;
  mayResume: boolean;
}
```

- Android: emit begin/end for transient audio-focus loss/gain; permanent loss suppresses automatic resumption. No phone-state permission is requested.
- iOS: forward `AVAudioSession.interruptionNotification` and its `shouldResume` option.
- The React Native adapter forwards these events to the shared session controller. Platform permission to resume does not override a manual pause, About or app backgrounding.
- Native stopped/playing callbacks do not determine interruption permission or imply autoplay denial. The explicit interruption event and the user's play intent remain authoritative.

Bun applies the patch on install. `apps/mobile/package.json` sets `expo.autolinking.buildFromSource` to `expo-video` so Expo's prebuilt native module cannot silently bypass the patch. Use an installed development build; stock Expo Go does not include this extension. Review/remove the patch when upgrading to an Expo version with equivalent upstream events.

The local Android compile verifies the Kotlin patch. iOS source compilation and actual incoming-call behavior must be checked on Apple hardware/CI. Shared-controller tests verify intent preservation, but they are not evidence that OS interruption delivery works on a physical phone.

## Buffering and recovery

`native-playback-health.ts` reconciles callbacks with the current player properties and playhead. Android can deliver `playingChange(false)` after the player has already returned to `readyToPlay` and resumed. Treating that callback as autoplay denial used to disable play intent and make the subsequent recovery pause itself.

The adapter retains intent through buffering, accepts advancing playback as recovery even without another playing callback, and samples the live playhead before applying its timeout. A ready but stopped player gets one automatic resume request per period without progress. Twenty seconds without progress triggers the existing bounded replacement/error policy. Status callbacks alone cannot reset that deadline. About, manual pauses, backgrounding and audio interruptions suspend the watchdog; resumption gets a fresh window. Disposed players and callbacks for an old media item cannot affect the next item.

The native adapter tests replay the reported callback order at 34.802 seconds with both sound preferences, then verify continued time accounting without replacement. They also cover progress-only recovery, stalled/startup timeouts, stale callbacks and interruption/pause intent. These are JavaScript adapter tests with a fake player and the real session controller. The installed Android public-stream run must still be repeated against this bundle; exports are not runtime evidence. No native dependency or patch changed in this fix.
