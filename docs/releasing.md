# Releasing

[release-please](https://github.com/googleapis/release-please) versions and releases Mofied from its commit messages. The web and the apps have separate versions, so a change ships only where it lands:

| Component                               | Folder                                                       | Tag              | Ships                                                                                                 |
| --------------------------------------- | ------------------------------------------------------------ | ---------------- | ----------------------------------------------------------------------------------------------------- |
| apps                                    | `apps/mobile`, with the store listing in `apps/mobile/store` | `v0.1.3`         | The iOS and Android apps to the App Store, Google Play and AppGallery (`Release apps`, `release.yml`) |
| web                                     | `apps/web`                                                   | `web-v0.1.3`     | mofied.com (`Release web`, `web.yml`); see [web deployment](web-deployment.md)                        |
| contracts, design, fixtures and session | `packages/*`                                                 | `session-v0.2.0` | Nothing themselves: their release raises the web and the apps that use them                           |

Each component's version is its `package.json`'s, which the apps and the web show. `release-please-config.json` sets the components up and `.release-please-manifest.json` holds their released versions. The iOS build number and the Android version code follow from the apps' version (`apps/mobile/build-number.js`: 1.2.3 builds as 1002003), so a release never needs one raised by hand.

## Commit messages

Commit titles follow [Conventional Commits](https://www.conventionalcommits.org/), and they decide the versions. With rebase merges every commit title counts; with squash merges, the pull request's title.

- `fix:` raises the patch version (0.1.3 → 0.1.4), and `feat:` the minor one (0.1.3 → 0.2.0). Before 1.0, a breaking change (`feat!:`, or a `BREAKING CHANGE:` footer) raises the minor version too.
- `chore:`, `docs:`, `test:`, `ci:`, `build:`, `refactor:` and `style:` release nothing.
- A commit counts for each component whose folder it changes. Changing a shared package releases that package, then the web and the apps, since both use every package.

A scope (`fix(store): …`) only labels the changelog entry.

So everything that changes what ships lives in a component's folder: the apps' native patch in `apps/mobile/patches`, the web's Wrangler configuration, build and deploy commands in `apps/web`. The root holds tooling: the pinned tools, tests, CI and release scripts. A `fix:` that changes only the root releases nothing, and the **Commits** check on pull requests (`.github/workflows/commits.yml`, `scripts/release/release-routing.ts`) fails on one: every releasing commit, and a releasing title across the pull request's files, must change a component. Give such a change a type that releases nothing, or move what ships into its component.

A change to `bun.lock` alone, such as a transitive dependency update, ships with the next release of each component. To ship one now, change the component's own `package.json` too (`bun add` the dependency there).

## Releasing

1. Merge commits to `main`. After each push, the **Release please** workflow (`.github/workflows/release-please.yml`) opens or updates the release pull request, **chore: release main**. It holds each raised component's new version and its `CHANGELOG.md`.
2. When it raises the apps, write that version's store release notes in `apps/mobile/store/release-notes/<version>/ar.txt` (at most 500 characters), and anything else in `apps/mobile/store/` that should change, in an ordinary pull request (`docs: …`, which releases nothing). The release pull request's **Release check** status fails until `main` has them. `mise exec -- bun run release:check` checks the same on your Mac, once `apps/mobile/package.json` has the new version.
3. Ali (`AliOsm`) squash-merges the release pull request. release-please tags each raised component and creates its GitHub release. In the same run, the workflow runs every check (`check.yml`: the unit, browser and Cloudflare tests and both native builds) on the commit it tagged, marks the commit with a **Checks** status once they pass, and then releases the apps with `release.yml` and deploys the web with `web.yml`. Each release job checks out exactly that commit, never the tag by name, and first checks that the tag still points at it.

On other pushes to `main`, the same run checks the pushed commit and marks it, and ships nothing.

GitHub's checks on the release pull request wait for someone to approve them, since GitHub Actions opened it. They're not needed: the merge is checked on `main` before anything ships, and its **Release please** run keeps `bun.lock` in step with the new versions and sets the **Release check** status.

Only Ali's merge ships, because the vault serves the release secrets only when he pushed to `main`. If someone else merges the release pull request, the tags, GitHub releases and checks still run, but nothing ships. Ali then runs **Release apps** (with **dry-run** unticked) on the `v` tag and **Release web** on the `web-v` tag from the Actions tab.

Pushing a version tag by hand releases too, as before: `v<version>` for the apps and `web-v<version>` for the web. The tag must match the component's version on that commit, and main's checks must have passed on that commit (its **Checks** status), so tag a commit from `main`.

## When a release fails

A re-run keeps the identity of whoever started the run, so it gets the release secrets only for a run Ali started.

| What failed                             | What to do                                                                                                                                                                                                                                                                                     |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The checks on the release commit        | If it was a flaky check, **Re-run failed jobs** in that run: it re-runs the checks, then the release jobs. If the commit is broken, fix it with a `fix:` commit and release the next version. The tag and GitHub release of the version that didn't ship stay; note that in its release notes. |
| A store or web job                      | Fix the cause and **Re-run failed jobs** in the run that failed. The table below says what each job does again.                                                                                                                                                                                |
| Nothing shipped: someone else merged    | Run **Release apps** (dry-run unticked) on the `v` tag and **Release web** on the `web-v` tag.                                                                                                                                                                                                 |
| Re-running the whole Release please run | Ships nothing: release-please has already created the release, so it finds nothing new.                                                                                                                                                                                                        |

What re-running each release job does:

| Job           | On a re-run                                                                                                                                                                                                                                                             |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Build iOS     | Builds and uploads the IPA again. App Store Connect refuses a build number it already has, so once an upload went through, a failure after it means releasing the next version. The IPA, its dSYMs and `release.json` are kept for 14 days as the run's `ios` artifact. |
| App Store     | Reuses the uploaded build. If this version and build is already in review, it stops there without submitting again.                                                                                                                                                     |
| Build Android | Builds the AAB and APK again; nothing reaches a store.                                                                                                                                                                                                                  |
| Google Play   | Uploads the AAB again, in a new edit. That works when the failed run's edit wasn't committed; once Google has the version code, it refuses it, and the next version is the way out.                                                                                     |
| AppGallery    | Uploads and binds the APK again. While a version is in review it stops before changing anything: cancel that review in AppGallery Connect, then re-run.                                                                                                                 |
| Web           | Builds and deploys the same commit again, which is safe.                                                                                                                                                                                                                |

## What the apps workflow does

| Job           | Runner | What it does                                                                                                                                                                                                                                                                                                                |
| ------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Check         | Linux  | Checks that the tag points at the commit being released (and, for a tag pushed by hand, that main's checks passed on it), checks the version and `apps/mobile/store/` with the version's release notes, then runs the typecheck and unit tests.                                                                             |
| Build iOS     | macOS  | Generates the Xcode project, signs the App Store build with the Apple Distribution certificate in a throwaway keychain (creating or reusing an App Store provisioning profile through the App Store Connect API), and uploads it to App Store Connect, leaving the App Store version to the next job.                       |
| App Store     | Linux  | Waits for Apple to process the build, pulls an older version still waiting for review or in review back out (giving up, without submitting, if Apple hasn't let it go after 15 minutes), then sends the listing, screenshots and reviewer notes and submits the version for review, released automatically once approved.   |
| Build Android | Linux  | Generates the Android project and builds the AAB and APK for `armeabi-v7a`, `arm64-v8a` and `x86_64` (no phone runs 32-bit `x86`), signed with Mofied's key (`apps/mobile/plugins/with-release-signing.js`), and checks the signer. Gradle's downloads come from the cache the checks save on `main`.                       |
| Google Play   | Linux  | Sends the AAB to the production track with the listing, release notes and changed images. Managed Publishing is off, so Google publishes it once approved.                                                                                                                                                                  |
| AppGallery    | Linux  | `scripts/release/publish-appgallery.ts`: uploads the APK, updates the texts and any changed images, and submits the version, released once approved. While a version is still in review it stops before changing anything: the Publishing API can't cancel a review, so cancel it in AppGallery Connect and re-run the job. |

The store jobs are independent: one failing doesn't stop the others.

## Dry runs

Any other `v*` tag is a dry run of the apps: push a throwaway one, such as `git tag v0-dry-run && git push origin v0-dry-run`, on the commit to test. Running the `Release apps` workflow by hand on a `v*` tag is a dry run too, unless **dry-run** is unticked. A dry run builds and signs both apps and checks everything without releasing:

- App Store Connect validates the signed IPA without taking it, and the App Store job only reads the app, saying which version it would pull out of review.
- Google Play checks the AAB and listing in an edit it never commits.
- AppGallery reports what it would upload, change and submit, or that a version in review would stop the release, and issues an upload URL without taking the APK.

A dry run uses no build number and needs no **Checks** status. Delete the throwaway tag afterwards: `git push origin :v0-dry-run && git tag -d v0-dry-run`. For the web, any other `web-v*` tag (`web-v0-dry-run`), or running `Release web` by hand on anything but a web version tag, builds the web and has Wrangler check the upload without deploying.

## Secrets

The workflows get everything from the ieasybooks vault through [`ieasybooks/vault`](https://github.com/ieasybooks/vault). `cloudflare/vault-secrets.tf` in ieasybooks/infrastructure lists them and shares them only with runs Ali started:

- the store and signing secrets with `release.yml`, on `v*` tags and as called by `release-please.yml` on `main`;
- the web's deploy token with `web.yml`, on `web-v*` tags and as called by `release-please.yml` on `main`.

So each release workflow gets only its own secrets, even when `release-please.yml` calls both.

| Secret                                                                      | Used for                                                                          |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `APPLE_API_KEY`                                                             | App Store Connect: profiles, upload, listing and submission                       |
| `APPLE_DISTRIBUTION_CERTIFICATE`, `APPLE_DISTRIBUTION_CERTIFICATE_PASSWORD` | Signing the iOS app                                                               |
| `MOFIED_ANDROID_KEYSTORE`, `MOFIED_ANDROID_KEYSTORE_PASSWORD`               | Signing the AAB and APK                                                           |
| `GOOGLE_PLAY_SERVICE_ACCOUNT`                                               | Google Play                                                                       |
| `APPGALLERY_CONNECT_SERVICE_ACCOUNT`                                        | AppGallery                                                                        |
| `MOFIED_WEB_DEPLOY_TOKEN`                                                   | Deploying mofied.com from `web.yml`: it can edit `mofied-web` and no other Worker |

To check those rules, run **Release please** by hand on `main` with **access-check** ticked (`gh workflow run release-please.yml --ref main -f access-check=true`). It releases nothing: `release.yml`'s and `web.yml`'s jobs each ask the vault for their own secret, which must be served, and for the other's, which must be refused (`scripts/release/expect-vault-refusal.sh`). Run it after changing the vault's rules.

## Running the steps on a Mac

fastlane runs on Ruby (pinned in `mise.toml`): `mise exec -- bundle install`. With the secrets from `mise run vault:run` in ieasybooks/infrastructure, the lanes in `fastlane/Fastfile` and `scripts/release/publish-appgallery.ts` run as they do in the workflow; pass `dry_run:true` (or `--dry-run`) to check without releasing. `mise exec -- bun run test:fastlane` tests the App Store submit lane's review logic (`fastlane/lib/review_replacement.rb`) without fastlane or Apple.
