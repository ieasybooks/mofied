# 0.1.2 (3) — prepared, not submitted

Version **0.1.2 (3)** (iOS build 3, Android version code 3) adds sharing and
mofied.com app links, keeps a session across app switches and plays every item
the viewer lands on. Nothing has been uploaded or submitted.

Before archiving:

1. Deploy Faqieh with faqieh-web-app#531 (`start=` support, continuous verses, no `expiresAt`).
2. Deploy the web (`bun run deploy:web`) right after, so `/.well-known/` serves both association files; run the live checks in [web deployment](web-deployment.md). The web on `main` and the 0.1.1 apps require `expiresAt`, so they cannot load sessions once #531 is live; 0.1.1 stays broken until 0.1.2 replaces it.
3. Enable **Associated Domains** on the `com.mofied.app` App ID (or let Xcode automatic signing add it) so the `applinks:mofied.com` entitlement is in the distribution profile.

Release notes:

- Arabic: «شارك أي مادة برابط يفتحها في مفيد مباشرة، وتفتح روابط mofied.com التطبيق. تستمر جلستك عند الانتقال إلى تطبيق آخر والعودة، وتعمل كل مادة تنتقل إليها تلقائيًا، وتظهر آيات التذكير متصلة.»
- English: “Share any media with a link that opens it in Mofied, and mofied.com links now open the app. Your session continues when you switch apps and come back, every media you move to plays automatically, and verse reminders read as one passage.”

Reviewer notes replace the 0.1.1 lifecycle sentences: “Backgrounding or locking the app pauses the current session; returning continues it. A new session starts on each launch. The share button (beside Info) opens the system share sheet with a https://mofied.com/?start=ID link; opening such a link starts a session from that media.”

---

# Fresh-session update — 8 November 2026

Version **0.1.1 (2)** removes saved-session restoration. Native app openings,
including returns from the background, request a fresh Faqieh plan. The updated
listing descriptions and reviewer instructions explain that viewing progress is
no longer saved. Existing artwork, rights declarations and release controls remain
in place.

Current update status:

| Store             | 0.1.1 update status                                              | Release control                                                |
| ----------------- | ---------------------------------------------------------------- | -------------------------------------------------------------- |
| Apple             | **Waiting for Review**, submitted 8 November at 10:23 Asia/Amman | Manual release                                                 |
| Google Play       | **Review requested**; automated quick checks running             | Managed Publishing enabled                                     |
| Huawei AppGallery | **Production Submitted / Reviewing**, verified 8 November        | 1 January 2027, 00:00 Asia/Amman / 31 December 2026, 21:00 UTC |

The owner-approved background AppleScript connection to signed-in Chrome recovered
console control without interrupting other work. Apple and Huawei's previous
review submissions were withdrawn so the new build and corrected metadata could
replace them. No public release action was taken.

- Apple app `6831969465`, version **0.1.1 (2)**, build ID
  `c08fbe0a-baf9-4ffd-bb78-2ac989fe0037`.
  [New review submission](https://appstoreconnect.apple.com/apps/6831969465/distribution/reviewsubmissions/details/a0f7ad00-e5df-44ba-b953-98980e512cac):
  `a0f7ad00-e5df-44ba-b953-98980e512cac`. The submitted version form confirms
  **Manually release this version** and the new fresh-session description/notes.
- Google Play app `4975812569745588942`: submitted three changes at approximately
  **10:34 Asia/Amman**. The [publishing overview](https://play.google.com/console/u/1/developers/8873333972257518553/app/4975812569745588942/publishing)
  places **production 0.1.1 (2)**, **owner-only Alpha 0.1.1 (2)**, and the corrected
  Arabic full description under **Changes in review**. Production and Alpha each
  use release `2` on their existing tracks. Google's automated quick checks were
  still running at verification; the console says the changes proceed to review
  when those checks pass. No successful check result or approval is claimed yet.
  **Managed Publishing is enabled**. The prior 17 approved changes remain held;
  no Publish action was taken. Tester lists and country availability were retained.
- Huawei app `119708951`, production version ID `2078592166849957440`,
  **0.1.1 (2)**. The accepted APK upload is dated 8 November at 10:24:46
  Asia/Amman. The read-only submitted form confirms **Use testing version: No**,
  the same 199 territories excluding mainland China, and the exact January 1
  schedule above. The separate owner-restricted 0.1.0 test version is unchanged.

Updated store text and console verification records are under ignored
`artifacts/fresh-sessions/listing/` and `artifacts/fresh-sessions/browser/`.
The previous submission record below is historical and is superseded by this
update where noted.

Apple accepted the 0.1.1 upload with nonblocking missing-dSYM warnings for the
precompiled React, ReactNativeDependencies and Hermes frameworks. Framework-level
crash symbolication may be limited; upload and review submission succeeded.
Release build evidence and UI checks are under `artifacts/fresh-sessions/`; see
[verification.md](verification.md) for the completed local validation and deployed
web behavior.

| Artifact          | SHA-256                                                            |
| ----------------- | ------------------------------------------------------------------ |
| iOS App Store IPA | `099ab4b10c11be7785f7751e61441aba33a2365f704461ab51595830255604ce` |
| Android AAB       | `7640c3910aa7115fa0404e3ee0634a351d5154312f918f0cee3044e395ef4408` |
| Android APK       | `161c5accd3110c1999ca5251e12bc7f3a713904be3e43e9884ffd81166dae570` |

---

# Store submission record — 7 November 2026

Version 0.1.0, build/version code 1, bundle/package `com.mofied.app`.
The owner authorized review submission to Apple, Google Play, and Huawei, initially
with public release controlled manually. On 7 November, the owner subsequently
authorized AppGallery production submission with public release scheduled for
1 January 2027. Apple and Google retain their manual release controls.
The owner also confirmed distribution rights for the app's fonts, media, and store
artwork. The installed app name remains مفيد.

Apple and Google console verification: 7 November 2026, approximately 20:07
Asia/Amman. AppGallery production submission verified at approximately 20:29.

| Store             | Verified status                       | Public release control                                              |
| ----------------- | ------------------------------------- | ------------------------------------------------------------------- |
| Apple             | Waiting for Review                    | Manually release this version                                       |
| Google Play       | Approved; 17 changes ready to publish | Managed Publishing enabled; nothing published                       |
| Huawei AppGallery | Production Submitted / Reviewing      | Scheduled for 1 January 2027, 00:00 Asia/Amman, subject to approval |

AppGallery's production form offers immediate or scheduled release. The owner
explicitly chose the scheduled option after the initial restricted test submission.
The saved production timestamp is **2027-01-01 00:00 Asia/Amman**, displayed by
Huawei alongside **2026-12-31 21:00 UTC**. Production approval is still pending.

## Apple App Store

- Listing: **مفيد: مواد نافعة**, Arabic primary language.
- App ID: `6831969465`.
- [Submission](https://appstoreconnect.apple.com/apps/6831969465/distribution/reviewsubmissions/details/f05f444b-1fc3-4409-a50c-153ab1a2efff): **Waiting for Review**.
- Submitted: 7 November 2026 at 16:03 Asia/Amman.
- Submission ID: `f05f444b-1fc3-4409-a50c-153ab1a2efff`.
- Release mode: **Manually release this version**.
- Build: 0.1.0 (1); no reviewer login needed.
- Free; Education / Reference; calculated global rating 13+ with regional ratings.
- iPhone and iPad screenshots: five approved editorial images per device family.
- Apple Silicon Mac and Vision Pro distribution disabled for this initial mobile release.
- 174 countries/regions selected; mainland China excluded pending its local registration requirements.

The privacy label declares Product Interaction, Other Diagnostic Data, and Other
Data Types for app functionality, linked to the user, with no tracking. This
conservatively covers operational request metadata and IP-address-bearing logs;
it does not imply a native analytics SDK, advertising, or a user account.

## Google Play

- App ID: `4975812569745588942`; listing name مفيد; free; Arabic.
- App record created using the owner's expressly approved policy/export declarations.
- Arabic store listing saved with the icon, feature graphic, and five approved
  screenshots in story order for phones, 7-inch tablets, and 10-inch tablets.
  The composed screenshot artwork and feature graphic are disclosed as
  AI-assisted; the supplied app icon is not.
- Education category, support email, website, privacy policy, no-login access,
  no-ads, non-government, no-financial-features, and no-health-features
  declarations saved. Intended audience: ages 13 and older.
- Data safety declares app interactions, diagnostics, and device or other
  identifiers, including service-request metadata. Collection is required and
  not exclusively ephemeral, with encrypted transport and no third-party
  sharing under the service-provider exception. Purposes are functionality and
  security for requests/identifiers, and diagnostics for troubleshooting.
  No remote data-deletion mechanism is claimed; local data can be cleared.
- [Publishing overview](https://play.google.com/console/u/1/developers/8873333972257518553/app/4975812569745588942/publishing):
  **17 changes ready to publish**, including the production release. The console
  confirmed approval, and **Managed Publishing is enabled**. No Publish action
  was taken; the owner controls the public launch.
- Managed Publishing became available after configuration and Alpha setup were
  completed. It was enabled before the production submission.
- Production track ID: `4697664311770654621`; release: `1`; version 0.1.0 (1).
  Availability: 177 countries/regions plus the rest-of-world setting.
- Closed-test Alpha track ID: `4700063523295749019`; release: `1`; Jordan only.
  The same approved batch contains this track and the **Mofied owner review**
  tester list, with one owner account. Managed Publishing holds both tracks.
- The permanent release key was imported through Google's PEPK encryption tool.
  Google displayed the same certificate fingerprint as the AppGallery APK.
- The final AAB was accepted. Production release validation showed ready for
  release, with no errors or warnings. Arabic first-release notes were saved.
- The owner-approved IARC terms were accepted and the questionnaire completed.
  Calculated ratings include ESRB Everyone 10+, PEGI 3, USK 6, Brazil all ages,
  and generic 3+. The advertising-ID declaration is **No**.
- Review submission and approval were verified on 7 November 2026.

## Huawei AppGallery

- Android app record created: **مفيد**, app ID `119708951`, Arabic default
  language, APK package type, phone and tablet compatibility.
- [Production review version](https://developer.huawei.com/consumer/en/service/josp/agc/index.html#/myApp/119708951/v2078592166849957440):
  **Submitted / Reviewing**, verified on 7 November 2026 at approximately 20:29
  Asia/Amman. Version ID: `2078592166849957440`; app version 0.1.0 (1).
- Production **Use testing version: No**. Release time: **Specified time,
  2027-01-01 00:00 Asia/Amman (2026-12-31 21:00 UTC)**. The read-only submitted
  form confirms both settings. This is the owner's authorized scheduled public
  release, subject to Huawei approval.
- Production availability: **199 countries/regions**, excluding mainland China.
  Automatic addition of new countries/regions is disabled.
- The production draft reused the accepted signed APK and saved listing assets.
  Its separate privacy fields, reviewer notes, and age-rating questionnaire were
  completed and saved before submission. The calculated rating remains 16+,
  with Brazil A16.
- [Restricted review version](https://developer.huawei.com/consumer/en/service/josp/agc/index.html#/myApp/119708951/v2078660010698624576):
  **Submitted / Reviewing (open testing)**, verified on 7 November 2026.
  Version ID: `2078660010698624576`; app version 0.1.0 (1).
- The final signed APK was accepted and attached: `mofied-0.1.0-1.apk`,
  package `com.mofied.app`, 74.26 MB; upload recorded at 20:04:07 Asia/Amman.
- Arabic listing, supplied icon, five approved phone screenshots in story order,
  and Education / Learning category saved. Free; no purchases or reviewer login.
- Privacy policy and data-subject-right URLs point to the live Mofied privacy
  and support pages. Privacy tags declare app run logs, app usage information,
  and IP address for functionality, third-party service providers, and
  cross-border transfer. Generative AI service: not involved.
- The content questionnaire calculated **16+** (Brazil A16). The calculated
  rating was retained; educational spoken references were disclosed.
- The separate restricted test has testing enabled and **Skip manual review for
  internal testing off**. Only Jordan is selected, with automatic addition of
  new countries disabled. Huawei states this test is available only to invited users.
- Tester list **Mofied owner review** contains one valid owner account and zero
  invalid accounts. **Automatic invitations are off**; no invitation was sent.
- Test period: 8 November 2026 at 00:00 through 8 December 2026 at 23:59,
  as displayed in the browser's Asia/Amman timezone. Invitation expiry: 7 days.
- The test version becomes eligible for restricted distribution after approval
  within that period. Its settings do not control the separate production schedule.

Chrome was restarted with the owner's explicit approval to recover stale
accessibility state and a disabled file picker. Saved store data survived;
the final APK upload completed before review submission.

## Build artifacts

Local artifacts are under `artifacts/store-submission/` and are not committed.
The Android signing key is stored outside the repository; never commit its
private key or password. Retain the key for future updates.

| Artifact          | SHA-256                                                            |
| ----------------- | ------------------------------------------------------------------ |
| iOS App Store IPA | `bb7c62b4f04eea098e4d26ea98c4fd68c0e1089c758ae6179bb5b4f0cb8dee25` |
| Android AAB       | `45e989ccd2c57f343fdd3de8a06f1d8911294a86f596ed4b03531731dd01857a` |
| Android APK       | `3153238f59ad5e6dd47fb5d42fb1bf1bad24b9197fa6fc52833dfd8cba706a53` |

Android signing certificate SHA-256:
`2cf5f229e935c4ba6ad9d43854a18bbb4a41238eabaacd40d1ea491ad2e9ab37`.

The Android release contains all four supported ABIs, targets API 36, verifies
with the permanent release certificate, and passes 16 KB ZIP alignment.
Unused Expo storage, overlay, and vibration permissions are explicitly blocked.
The final APK requests internet, network-state, and wake-lock permissions plus
the generated non-exported-receiver permission.

The iOS distribution archive and IPA exported successfully and Apple processed
the uploaded build. Xcode reported missing debug-symbol files for the prebuilt
React, ReactNativeDependencies, and Hermes frameworks. These warnings did not
prevent upload or review submission; framework-level crash symbolication may be
limited until matching symbols are supplied.

## Website and local validation

- Standalone bilingual [privacy](https://mofied.com/privacy/) and
  [support](https://mofied.com/support/) pages are live and return HTTP 200.
- Cloudflare Worker version: `a690189e-0cb8-444f-8919-3bcffb1f239c`.
- The deployment added only the two pages and their stylesheet; existing app
  assets were already uploaded. In-app wording and features are unchanged.
- Both TypeScript checks, 115 unit tests, and production web build passed.
- Browser regression suite: 87 passed; the opt-in live-API case then passed
  separately, including real API/CORS, HLS playback, and paused restoration.
- Cloudflare integration: six passed, including policy/support access with
  JavaScript disabled, responsive layouts, and absence of session requests.
- Android native release AAB/APK compilation and iOS archive/export passed.

These checks do not replace store review. Public distribution follows the release
controls recorded above.
