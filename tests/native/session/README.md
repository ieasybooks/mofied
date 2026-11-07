# Native fresh-session check

This opt-in XCUITest drives an installed Release build of `com.mofied.app` on an iOS simulator. It verifies new server session identities after background returns (playing and manually paused) and process relaunch, plus same-session continuity through Info. It uses four live Faqieh API requests, so do not loop it against the production rate limit.

Build/install the Release simulator app using MobileBuildMCP, then run:

```sh
xcodegen generate --spec tests/native/session/project.yml --project artifacts/fresh-sessions/qa
mobilebuildmcp simulator test --project-path "$PWD/artifacts/fresh-sessions/qa/MofiedSessionQA.xcodeproj" --scheme MofiedSessionQA --simulator-id YOUR_SIMULATOR_ID --derived-data-path "$PWD/artifacts/fresh-sessions/qa-derived"
```

The `session-…` native test identifier is an opaque plan identity used only by automation. It is not spoken or drawn in the app. Unit tests in `fresh-sessions.test.ts` cover controlled cancellation, stale responses/errors, inactive-only events, loading while backgrounded, offline recovery and disposal without calling the public API.
