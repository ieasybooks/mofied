# Mofied

Standalone client repository for mofied.com. Rails publishing and the session API stay in the private sibling faqieh-web-app checkout. Never copy Rails source, credentials, databases or private fixtures here.

- apps/web: React/Vite browser UI. apps/mobile: Expo native iOS/Android UI.
- packages/contracts owns the wire schema. packages/session owns session behavior.
- Rails supplies the ordered media and reminders; clients do not select or shuffle content.
- Match docs/design and docs/product.md. No homepage, accounts, comments/reactions or other social actions beyond sharing a media link, PiP, background native audio, session-repeat CTA or library attribution under titles.
- Use media in English and مادة / مواد in Arabic.
- Use exact Thmanyah title and Noto Naskh UI fonts. Preserve the supplied Mofied icon.
- Browser tab hiding must not pause. Native background/lock must pause; focus loss alone must not.
- Fixture mode is development-only. Never fall back to fixtures after an API error.
- Use mise exec -- bun run check and bun run test:e2e. Report native device verification separately from web and JS bundle checks.
- Commit titles follow Conventional Commits (fix:, feat:, chore:, docs:, ...): release-please versions and releases the apps and web from them. See docs/releasing.md.
