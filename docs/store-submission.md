# Store submission record — 7 November 2026

Version 0.1.0, build/version code 1, bundle/package `com.mofied.app`.
The owner authorized review submission to Apple, Google Play, and Huawei, with
public release controlled manually. Store review approval is not a public launch.
The owner also confirmed distribution rights for the app's fonts, media, and store
artwork. The installed app name remains مفيد.

## Apple App Store

- Listing: **مفيد: مواد نافعة**, Arabic primary language.
- App ID: `6831969465`.
- Status verified in App Store Connect: **Waiting for Review**.
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
- Managed-publishing activation was refused both before and after listing setup.
  Production remains unpublished. A closed-test Alpha release draft was created
  as a review path that cannot launch the app publicly.
- Alpha track ID: `4700063523295749019`; release draft: `1`.
- The permanent release key was imported through Google's PEPK encryption tool.
  Google displayed the same certificate fingerprint as the AppGallery APK.
- The final AAB upload started and entered processing; acceptance still needs
  to be verified in the console. First-release notes were entered.
- The owner approved IARC's terms on 7 November 2026. Acceptance in the UI and
  completion of the content-rating questionnaire remain pending.
- **Not submitted for review yet.** Tester/country setup, final bundle
  validation, and review submission remain outstanding.

## Huawei AppGallery

- Android app record created: **مفيد**, app ID `119708951`, Arabic default
  language, APK package type, mobile-phone device family.
- **Not submitted for review yet.** Listing details, signed APK, questionnaires,
  and manual-release controls remain to be completed and verified.
- A Huawei hover popup broke Chrome's native accessibility state. Its tab was
  closed without deleting the saved app record. Browser recovery is pending;
  no automatic public release was authorized.

## Build artifacts

Local artifacts are under `artifacts/store-submission/` and are not committed.
The Android signing key is stored outside the repository; never commit its
private key or password. Retain the key for future updates.

| Artifact | SHA-256 |
| --- | --- |
| iOS App Store IPA | `bb7c62b4f04eea098e4d26ea98c4fd68c0e1089c758ae6179bb5b4f0cb8dee25` |
| Android AAB | `45e989ccd2c57f343fdd3de8a06f1d8911294a86f596ed4b03531731dd01857a` |
| Android APK | `3153238f59ad5e6dd47fb5d42fb1bf1bad24b9197fa6fc52833dfd8cba706a53` |

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

These checks do not replace store review or the owner's manual public release.
