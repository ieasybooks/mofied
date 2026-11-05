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
- Unexplained ready-player pauses show a tap-to-play state instead of triggering a network replacement.

Bun applies the patch on install. `apps/mobile/package.json` sets `expo.autolinking.buildFromSource` to `expo-video` so Expo's prebuilt native module cannot silently bypass the patch. Use an installed development build; stock Expo Go does not include this extension. Review/remove the patch when upgrading to an Expo version with equivalent upstream events.

The local Android compile verifies the Kotlin patch. iOS source compilation and actual incoming-call behavior must be checked on Apple hardware/CI. Shared-controller tests verify intent preservation, but they are not evidence that OS interruption delivery works on a physical phone.
