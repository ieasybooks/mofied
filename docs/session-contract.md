# Session API contract · version 1

The client requests one small, complete session plan over HTTPS. The URL is configured at build time; no Rails route is assumed or added by this repository. The initial provider uses `GET`, `Accept: application/json`, no cookies, and a 15-second timeout.

The authoritative runtime validator is `packages/contracts/src/index.ts`. Run `bun run contract:generate` to regenerate `session.schema.json` and `session.example.json`.

## Response

| Field                           | Meaning                                                       |
| ------------------------------- | ------------------------------------------------------------- |
| `schemaVersion`                 | Exactly `1`                                                   |
| `id`                            | Opaque session identifier; not a user identity                |
| `locale`                        | Language of plan content, `ar` or `en`                        |
| `expiresAt`                     | ISO UTC expiry, or `null`; expired plans cannot start/restore |
| `policy.maxActiveMs`            | Active playback + running reminder budget in milliseconds     |
| `policy.limitBehavior`          | `finish-current-item`                                         |
| `policy.maxConsecutiveFailures` | Maximum consecutive media failures, 1–10                      |
| `items`                         | Ordered `media` / `reminder` union; 1–250 items               |
| `replacements`                  | 0–25 reserve media, consumed in supplied order on failures    |
| `ending`                        | Final title and reflection body supplied by Rails             |

Each item's `id` is unique across the plan and reserve list. Repeated catalog media can use distinct item IDs; `mediaId` identifies the source catalog record. IDs and speaker IDs are strings. Use milliseconds consistently.

Media items contain `title`, `pageUrl`, nullable `posterUrl`, positive `durationMs`, `playback.url`, `playback.mimeType`, and speaker `id`, `name`, `pageUrl`, nullable `imageUrl`. MIME types are `application/vnd.apple.mpegurl` and `video/mp4`. Browser playback uses actual loaded duration when available; native progress labels initially use the supplied duration.

Reminder items contain positive `durationMs` (up to five minutes) and `content.kind` (`quran` or `text`), `body`, `citation`, `source`. Text is plain text, never HTML. Preserve Quran text and its diacritics exactly. Rails chooses where the reminder appears; the client neither calculates a position nor sends timing guesses back to Rails.

The client rejects unsafe schemes, non-Faqieh media/speaker destination pages, duplicate item IDs, invalid versions and expired plans. URL schemes and cross-field/expiry checks are runtime refinements; JSON Schema alone does not express all of them.

## Server responsibilities for the next phase

- Select the session from the large catalog with indexed server-side queries and caching. Never send the full catalog to a client.
- Return complete, stable, HTTPS media, poster and portrait URLs. Signed URLs, if used, must stay usable for the plan's remaining lifetime and intended local restore window.
- Select ordered reminder text/durations and reserve media. An empty catalog is an API error, not an empty successful plan under v1.
- Allow the deployed web origin via CORS. R2 manifests, segments and images must be reachable independently of Rails cookies.
- Return an error response for unavailable/rate-limited service. No secret API key can be hidden in these public clients; apply rate limits and abuse protection at the server/edge.
- Treat this client's timer as product behavior, not an anti-abuse or access-control boundary. Anyone can call a public viewing API or modify client state.

## Boundary behavior

The budget is a maximum, not a requirement to fill time: consuming all items ends the session. Replacements are used at the failed media's slot and do not move the reminder that follows it. Budget exhaustion prevents starting a previous, replacement or next item, but does not cut the current item off mid-playback.

The clients store only the current small plan for local continuity. No account, user profile, analytics transport, media uploads, private Rails source or database fixtures are required.
