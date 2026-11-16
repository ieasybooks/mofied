# Releasing

Pushing a version tag releases Mofied to the App Store, Google Play and AppGallery. Each store reviews the version and publishes it once approved; nothing waits for a click. The `Release` workflow (`.github/workflows/release.yml`) builds and signs both apps, then sends each store the build, the listing texts and images from [`store/`](../store/README.md), the release notes and the reviewer notes.

## Releasing a version

1. Raise the version and both build numbers, since no store takes a build number twice:
   - `version` in `package.json` (the apps report it), such as `0.1.3`;
   - `expo.ios.buildNumber` and `expo.android.versionCode` in `apps/mobile/app.json`, such as `"4"` and `4`.
2. Write the release notes in `store/release-notes/<version>/ar.txt`, at most 500 characters. Change anything else in `store/` that should change.
3. `mise exec -- bun run release:check` must pass. Merge to `main`.
4. Tag the merge commit and push the tag: `git tag v0.1.3 && git push origin v0.1.3`.

Only a tag that is exactly `v` and a version releases, and it must match `package.json`'s version. Only tags Ali (`AliOsm`) pushes get the release secrets from the ieasybooks vault.

## What the workflow does

| Job           | Runner | What it does                                                                                                                                                                                                                                           |
| ------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Check         | Linux  | Checks the tag, version, build numbers and `store/`, then runs the typecheck and unit tests.                                                                                                                                                           |
| Build iOS     | macOS  | Generates the Xcode project, signs the App Store build with the Apple Distribution certificate in a throwaway keychain (creating or reusing an App Store provisioning profile through the App Store Connect API), and uploads it to App Store Connect. |
| App Store     | Linux  | Waits for Apple to process the build, sends the listing, screenshots and reviewer notes, and submits the version for review, released automatically once approved. A version still in review is pulled back first, so the newest one replaces it.      |
| Build Android | Linux  | Generates the Android project and builds the AAB and APK, signed with Mofied's key (`apps/mobile/plugins/with-release-signing.js`), and checks the signer.                                                                                             |
| Google Play   | Linux  | Sends the AAB to the production track with the listing, release notes and changed images. Managed Publishing is off, so Google publishes it once approved.                                                                                             |
| AppGallery    | Linux  | `scripts/release/publish-appgallery.ts`: withdraws a version still in review, uploads the APK, updates the texts and any changed images, and submits the version, released once approved.                                                              |

The store jobs are independent: if one fails, fix the cause and re-run that job from the workflow run. Re-running a store job sends the same build again, which each store refuses once it has it; push a new version instead.

## Dry runs

Any other `v*` tag is a dry run: push a throwaway one, such as `git tag v0-dry-run && git push origin v0-dry-run`, on the commit to test. Running the `Release` workflow by hand on a `v*` tag is a dry run too, unless **dry-run** is unticked. A dry run builds and signs both apps and checks everything without releasing:

- App Store Connect validates the signed IPA without taking it, and the App Store job only reads the app.
- Google Play checks the AAB and listing in an edit it never commits.
- AppGallery reports what it would withdraw, upload, change and submit, and issues an upload URL without taking the APK.

A dry run uses no build number. Delete the throwaway tag afterwards: `git push origin :v0-dry-run && git tag -d v0-dry-run`.

## Secrets

The workflow gets everything from the ieasybooks vault through [`ieasybooks/vault`](https://github.com/ieasybooks/vault); `cloudflare/vault-secrets.tf` in ieasybooks/infrastructure lists them and shares them with this workflow on `v*` tags pushed by Ali.

| Secret                                                                      | Used for                                                    |
| --------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `APPLE_API_KEY`                                                             | App Store Connect: profiles, upload, listing and submission |
| `APPLE_DISTRIBUTION_CERTIFICATE`, `APPLE_DISTRIBUTION_CERTIFICATE_PASSWORD` | Signing the iOS app                                         |
| `MOFIED_ANDROID_KEYSTORE`, `MOFIED_ANDROID_KEYSTORE_PASSWORD`               | Signing the AAB and APK                                     |
| `GOOGLE_PLAY_SERVICE_ACCOUNT`                                               | Google Play                                                 |
| `APPGALLERY_CONNECT_SERVICE_ACCOUNT`                                        | AppGallery                                                  |

## Running the steps on a Mac

fastlane runs on Ruby (pinned in `mise.toml`): `mise exec -- bundle install`. With the secrets from `mise run vault:run` in ieasybooks/infrastructure, the lanes in `fastlane/Fastfile` and `scripts/release/publish-appgallery.ts` run as they do in the workflow; pass `dry_run:true` (or `--dry-run`) to check without releasing.
