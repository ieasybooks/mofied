# Cloudflare web deployment

The web release uses Workers Static Assets. `wrangler.jsonc` identifies the `mofied-web` Worker in the ieasybooks account and uploads `apps/web/dist`. There is no application server or Worker handler. The browser calls the existing Faqieh API and media hosts directly.

## Ownership

- This repository owns the Worker, built assets, cache headers and release commands.
- [ieasybooks/infrastructure](https://github.com/ieasybooks/infrastructure) owns the purchased `mofied.com` zone, DNS, HTTPS/DNSSEC settings, the Workers custom domain, `www` redirect and automatic Cloudflare Web Analytics.
- Keep `routes` out of `wrangler.jsonc`. The pinned Wrangler deploy path leaves custom domains alone when no routes are configured. Do not add a Terraform Worker script resource for this app: it would compete with app releases.
- `workers.dev` and version preview URLs are disabled. Faqieh allows `https://mofied.com` and `https://www.mofied.com`; arbitrary preview origins are not allowed. A future staging domain needs an explicit API CORS decision.

## Local validation

Run from the repository root with the versions pinned in `mise.toml` and `package.json`:

```sh
mise exec -- bun install --frozen-lockfile
mise exec -- bun run check
HEADED=1 mise exec -- bun run test:e2e
mise exec -- bun run deploy:web:check
mise exec -- bun run test:cloudflare
```

The final two commands need no Cloudflare credentials and do not publish anything. The dry run validates the upload configuration. The Cloudflare tests run the production build through local Wrangler/workerd, checking HTTP routing, cache headers, MIME types, playback/restoration and API failure/retry. API responses and media are intercepted for deterministic tests; they do not establish live Cloudflare routing, TLS or analytics injection. The client CI job runs both commands.

For an interactive local check, `bun run preview:cloudflare` serves the release assets at `http://127.0.0.1:8787`. The real Faqieh API rejects that localhost origin; use the automated intercepted tests here, or `bun run dev` for the existing live API development proxy.

## First release after PR review

1. Merge the app and infrastructure PRs. Install with the frozen lockfile and run the checks above at the release commit.
2. Authenticate Wrangler with the ieasybooks Cloudflare account (`bunx wrangler login`), or provide `CLOUDFLARE_API_TOKEN` through the deployment environment. A scoped token needs Workers Scripts Write for that account. The account ID in the configuration is an identifier, not a credential; no token belongs in the repository or frontend environment.
3. Run `mise exec -- bun run deploy:web`. This builds with the explicit production session endpoint, then creates/uploads `mofied-web`. It has no public hostname until the next step. Record the deployed version ID from Wrangler.
4. In `ieasybooks/infrastructure`, follow its full plan/review/apply workflow. It imports the existing zone and attaches `mofied.com` to `mofied-web`, which must already exist. Workers provisions the apex DNS record and certificate. Do not recreate the zone or add a competing apex A/CNAME record.
5. Perform the live checks below. Later releases deploy the web from the `Release` workflow (see below) without reapplying Terraform unless infrastructure changes.

## Releases

Pushing a `web-v<version>` tag, such as `web-v0.1.3`, deploys the web: the `Release web` workflow (`.github/workflows/web.yml`) checks that the tag matches `package.json`'s version, runs the typecheck and unit tests, then `bun run deploy:web` with the ieasybooks vault's `CLOUDFLARE_WORKERS_DEPLOY_TOKEN` as `CLOUDFLARE_API_TOKEN`. `scripts/release/check-live-web.sh` then checks that mofied.com serves the new build's assets, the privacy and support pages, and the app-link files. The apps release from `v<version>` tags and share the version (see [releasing](releasing.md)); a web-only fix needs only the web tag. Any other `web-v*` tag, such as `web-v0-dry-run`, runs `bun run deploy:web:check` instead and deploys nothing. Merging to `main` deploys nothing.

Deploying by hand still works, with `bun run deploy:web` (signed in with `bunx wrangler login`), followed by `scripts/release/check-live-web.sh`.

`build:web:release` pins `VITE_SESSION_API_URL` to `https://faqieh.com/api/v1/mofied/session?locale=ar`, overriding a developer's local endpoint setting. Native builds and app behavior are unaffected.

## Serving and analytics

The app's screens all use `/`; Info subpages are component state, not separate URLs. Standalone, bilingual `/privacy/` and `/support/` pages serve store-review and support links without loading the player, requesting a session, or requiring JavaScript. Share links are `/?start=<mediaId>` on the same page. `/.well-known/apple-app-site-association` (served as JSON) and `/.well-known/assetlinks.json` let the iOS and Android apps open `https://mofied.com/` links; they claim only `/`, so `/privacy/` and `/support/` stay on the web. Apple and Google fetch these without redirects, so they must stay on the apex. Unknown paths and missing assets return 404. A blanket SPA fallback would return HTML for stale JavaScript URLs and could cache it under the immutable asset rule.

The release build generates one-year immutable cache rules for the exact fingerprinted asset paths in that build. A wildcard rule would also cache missing-file 404 responses for a year. HTML and unversioned icons retain Workers' default `public, max-age=0, must-revalidate` policy. The zone respects those headers. API responses remain on Faqieh with `Cache-Control: no-store`; this deployment does not proxy or cache them.

Terraform enables Web Analytics with the same `auto_install = true` zone setup used by the other ieasybooks sites. Cloudflare injects its beacon at the edge on the production domain. The app contains no duplicate analytics snippet or SDK. Do not add `Cache-Control: no-transform` to HTML, which would prevent automatic injection. Product copy and features are unchanged.

## Installation and sharing

`/manifest.webmanifest` gives manual browser installation the Arabic name مفيد,
standalone display, a stable `/` app identity and launch URL, and dedicated normal
and maskable icons. The Apple touch icon and web-app metadata support iOS home
screen installation. Automatic install banners are suppressed; there is no
in-app installation prompt or install button. Users can install through their
browser's menu.

This does not add offline playback or a service worker. Sessions and media still
require the network, and no additional API, media, or stale app-shell cache is
introduced. Browser installation does not affect native store builds.

The initial HTML contains canonical, Open Graph, and Twitter Card metadata, so
link previews do not need to run JavaScript or fetch a session. `/og-card.png` is
the 1200×630 PNG share image. It and the install icons use the supplied Mofied
artwork and fonts; regenerate them with
`mise exec -- node scripts/generate-web-artwork.mjs`. These stable public asset
URLs use the default revalidation policy rather than immutable caching.

## Live checks and rollback

After the first infrastructure apply and certificate activation:

- Verify `https://mofied.com/` loads, HTTP redirects to HTTPS, and `https://www.mofied.com/?utm_source=release` redirects to the apex preserving the query. Confirm DNSSEC resolves successfully.
- Verify HTML revalidates, fingerprinted assets cache immutably, and a missing JavaScript asset returns 404.
- Verify both `/.well-known/` files return 200 JSON without redirects. Check Apple's CDN copy with `curl https://app-site-association.cdn-apple.com/a/v1/mofied.com` and Android verification with `adb shell pm verify-app-links --re-verify com.mofied.app` then `adb shell pm get-app-links com.mofied.app` on an installed store build.
- Verify one real session request succeeds with the expected CORS origin, real HLS manifests/segments decode, and a paused reload restores without another session request. Exercise Info, reminders, navigation and the ending in Chromium and Safari.
- Inspect production HTML for one Cloudflare beacon and check its request/collection in the analytics dashboard. Local Wrangler does not emulate zone analytics injection.

For an app rollback, use `bunx wrangler deployments list` to identify the previous good version, then `bunx wrangler rollback <version-id>`. Recheck playback and headers. This changes the deployed app version while Terraform retains the custom domain and zone configuration. There is no earlier app version to roll back to on the first release.
