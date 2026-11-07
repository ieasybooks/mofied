# iPhone web preload regression

This runs the real web client in Safari on an iOS simulator. It checks ManagedMediaSource, audible swipes on one video element, reuse of warmed HLS resources under the production revalidation headers, absence of loading notices during prepared transitions, Info pause/resume, and native HLS fallback when the streaming APIs are unavailable. The link-gesture case swipes from the title and speaker, cancels a partial drag while paused, and verifies that stationary title/speaker taps still navigate.

Requirements: Xcode, XcodeGen, MobileBuildMCP, Bun and installed workspace dependencies. From the repository root:

```sh
mise exec -- bun run dev
# In another terminal:
mise exec -- bun scripts/ios-web-preload-server.ts
# In a third terminal:
mkdir -p artifacts/preload-research/ios-qa
xcodegen generate --spec tests/native/web/project.yml --project artifacts/preload-research/ios-qa
mobilebuildmcp simulator list --enabled true
mobilebuildmcp simulator test \
  --project-path "$PWD/artifacts/preload-research/ios-qa/MofiedWebQA.xcodeproj" \
  --scheme MofiedWebQA --simulator-id YOUR_SIMULATOR_ID \
  --derived-data-path "$PWD/artifacts/preload-research/ios-build" \
  --extra-args CODE_SIGNING_ALLOWED=NO
```

The harness listens only on loopback port 8789 and forwards app assets to Vite on 5173. HTTPS fixture URLs are mapped to local controlled media; fetch/XHR instrumentation records requests and does not change autoplay permission. Each test has a unique trace ID. Results are in the MobileBuildMCP result bundle and `artifacts/preload-research/ios-trace.jsonl`.

The native-fallback test deliberately disables MediaSource APIs in its page before the app loads. Only the ManagedMediaSource test asserts direct byte reuse; native fallback still relies on the browser HTTP cache. This is an iPhone browser check, separate from the Expo app and physical-device testing.

To also run the opt-in production-media journey, add `--json '{"testRunnerEnv":{"MOFIED_LIVE_API":"1"}}'` to the simulator test command. It obtains one anonymous production plan and loads its real CDN media, then checks four audible prepared transitions for opening-resource reuse and loading notices. It leaves the page paused. Without this flag, the live case is skipped; the controlled and native-fallback cases still run.
