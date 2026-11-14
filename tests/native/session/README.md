# Native session lifetime check

This opt-in XCUITest drives an installed Release build of `com.mofied.app` on an iOS simulator. It verifies that one server session continues across background returns (playing and manually paused) and through Info, with the media clock confirming that the native player itself resumes or stays paused, and that a process relaunch requests a new one. It uses two live Faqieh API requests, so do not loop it against the production rate limit.

Build and install the Release simulator app, then run:

```sh
xcodegen generate --spec tests/native/session/project.yml --project artifacts/sessions/qa
xcodebuild test -project artifacts/sessions/qa/MofiedSessionQA.xcodeproj -scheme MofiedSessionQA -destination "id=YOUR_SIMULATOR_ID" -derivedDataPath artifacts/sessions/qa-derived
```

The `session-…` native test identifier is an opaque plan identity used only by automation. It is not spoken or drawn in the app. Unit tests in `session-lifetime.test.ts` cover background and inactive transitions, plans that arrive while the app is away, load failures and disposal without calling the public API.
