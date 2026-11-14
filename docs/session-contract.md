# Session API contract · version 1

The client requests one small, complete session plan over HTTPS. A share link adds `start=<mediaId>` (a positive decimal id) to the request; Rails opens the plan with that media when it is eligible and otherwise returns an ordinary plan. The default endpoint is `https://faqieh.com/api/v1/mofied/session?locale=ar`; build-time overrides remain available for staging or English plans (`locale=en`). The initial provider uses `GET`, `Accept: application/json`, no cookies, `cache: no-store`, and a 15-second timeout.

The authoritative runtime validator is `packages/contracts/src/index.ts`. Run `bun run contract:generate` to regenerate `session.schema.json` and `session.example.json`.

## Response

| Field                           | Meaning                                                    |
| ------------------------------- | ---------------------------------------------------------- |
| `schemaVersion`                 | Exactly `1`                                                |
| `id`                            | Opaque session identifier; not a user identity             |
| `locale`                        | Language of plan content, `ar` or `en`                     |
| `policy.maxActiveMs`            | Active playback + running reminder budget in milliseconds  |
| `policy.limitBehavior`          | `finish-current-item`                                      |
| `policy.maxConsecutiveFailures` | Maximum consecutive media failures, 1–10                   |
| `items`                         | Ordered `media` / `reminder` union; 1–250 items            |
| `replacements`                  | 0–25 reserve media, consumed in supplied order on failures |
| `ending`                        | Final title and reflection body supplied by Rails          |

Each item's `id` is unique across the plan and reserve list. Repeated catalog media can use distinct item IDs; `mediaId` identifies the source catalog record. IDs and speaker IDs are strings. Use milliseconds consistently.

Media items contain `title`, `pageUrl`, nullable `posterUrl`, positive `durationMs`, `playback.url`, `playback.mimeType`, and speaker `id`, `name`, `pageUrl`, nullable `imageUrl`. MIME types are `application/vnd.apple.mpegurl` and `video/mp4`. Browser playback uses actual loaded duration when available; native progress labels initially use the supplied duration.

Reminder items contain positive `durationMs` (up to five minutes) and `content.kind` (`quran` or `text`), `body`, `citation`, `source`. Text is plain text, never HTML. Preserve Quran text and its diacritics exactly. Rails chooses where the reminder appears; the client neither calculates a position nor sends timing guesses back to Rails.

The client rejects unsafe schemes, non-Faqieh media/speaker destination pages, duplicate item IDs, and invalid versions. URL schemes and cross-field checks are runtime refinements; JSON Schema alone does not express all of them.

## Deployed integration

The endpoint returns the v1 plan directly, without an envelope or authentication. Production web CORS allows `https://mofied.com` and `https://www.mofied.com`; native clients call it directly. The local Vite server proxies `/__mofied/session` to that same HTTPS endpoint with certificate verification enabled.

The deployed service applies a 10-session-request/IP/minute limit, returns `Cache-Control: no-store`, and uses HTTP 429/503 with `Retry-After: 60` for throttling/unavailability. The current server policy supplies a 20-minute budget. Plans do not expire: production images and HLS URLs are durable public R2 URLs. These are server policy values, not client assumptions. Keep live tests opt-in to avoid consuming rate limits.

## Server responsibilities

- Select the session from the large catalog with indexed server-side queries and caching. Never send the full catalog to a client.
- Return complete, stable, HTTPS media, poster and portrait URLs. Signed URLs, if used, must stay usable for as long as a viewer keeps a session open.
- Select ordered reminder text/durations and reserve media. An empty catalog is an API error, not an empty successful plan under v1.
- Allow the deployed web origin via CORS. R2 manifests, segments and images must be reachable independently of Rails cookies.
- Return an error response for unavailable/rate-limited service. No secret API key can be hidden in these public clients; apply rate limits and abuse protection at the server/edge.
- Treat this client's timer as product behavior, not an anti-abuse or access-control boundary. Anyone can call a public viewing API or modify client state.

## Boundary behavior

The budget is a maximum, not a requirement to fill time: consuming all items ends the session. Replacements are used at the failed media's slot and do not move the reminder that follows it. Budget exhaustion prevents starting a previous, replacement or next item, but does not cut the current item off mid-playback.

The clients hold the current plan only in memory. Each page load/refresh or native app launch requests a new plan; native background returns continue the current one. Nothing is restored from device storage. No account, user profile, analytics transport, media uploads, private Rails source or database fixtures are required.
