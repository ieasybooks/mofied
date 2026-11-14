# Accepted playback overlay

Accepted on 2026-11-05. This replaces the playback overlay in the earlier design boards. Branding, fonts, media framing, reminders, About, endings and session behavior stay as defined in `decisions.json` and `../product.md`.

## Native and narrow web (up to 900px)

- Info and sound: 44 × 44px circles, 12px gap, 20px from the left and safe-top + 18px from the top. Sound appears during media only; Info keeps its position on other screens.
- Remove the visible swipe chevron and text. Preserve vertical swipe, tap-to-pause/resume and native accessibility next/previous actions. Browser keyboard and wheel navigation remain available.
- One bottom stack with 20px side margins, in this order: speaker, title, elapsed/total time, progress. The speaker row has a minimum 44px touch height, a 30px portrait when supplied and 16/24px Noto Naskh UI text. The title is 28/42px Thmanyah, clamped to two lines. Links keep their Faqieh destinations.
- Time uses 13/16px Gilroy, right aligned, 4px below the title. The 2px progress line sits 10px below the time and safe-bottom + 16px above the screen edge.
- The bottom fade sizes to the stack. Its first 80px ease from transparent to black at 0.62 opacity; the rest reaches 0.68 at the bottom edge. A single-line stack is 214px plus the bottom safe inset; a two-line title adds 42px. Longer speaker names or system font scaling can expand it further.
- The top fade is safe-top + 110px tall and eases from black at 0.45 opacity to transparent. Header controls have their own dark backgrounds.
- A subtle 0/1px, 10px-radius text shadow supports readability. Contrast must pass without relying on that shadow. Decorative layers do not intercept input.

## Desktop (above 900px)

Keep the right metadata column and the icon-only sound control in the left navigation rail. The rail never changes height, so its buttons stay put when sound changes; the in-player “اضغط لتشغيل الصوت” pill explains withheld sound instead of a label under the button. Keep the small pause control, elapsed/total time, progress and keyboard hint. Remove the in-player top fade. The bottom fade is a 128px strip: black at 0.62 opacity at the edge, 0.60 at 56px above it, then eased to transparent at 128px.

## Scope and verification

The narrower fade reveals more video, while retaining readable metadata on bright frames. Cover-cropping is unchanged; this overlay cannot guarantee clearance for captions baked into arbitrary positions in a video.

Current implementation captures: [phone web](player-overlay-web-phone.png), [desktop](player-overlay-desktop.png), and [native UI in the Expo browser preview](player-overlay-native-preview.png). The preview has no device safe insets or OS chrome; it is not an installed iOS/Android screenshot.

See `../verification.md` for implementation checks and the distinction between browser previews and installed native runtime testing.
