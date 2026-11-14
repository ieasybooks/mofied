# Product decisions

This is the behavior baseline for the initial implementation. The approved design reference is `design/decisions.json`; later explicit user decisions take precedence.

- Open into the first media. No homepage, accounts, catalog, comments, reactions or creator actions.
- Use the supplied monochrome Mofied icon unchanged. Thmanyah for titles; Noto Naskh Arabic UI for interface text; Kitab for Quran text; Gilroy for Latin/time labels.
- Desktop Info is icon-only. No “من مكتبة فقيه” line beneath titles. Keep media and speaker links to their actual Faqieh pages.
- Clamp titles to three lines on desktop and two on narrow web/native. Keep the full title in the contract and link directly to Faqieh; no extra details sheet.
- Desktop has a slim previous/next/sound rail, small pause control and keyboard navigation. Native has swipe navigation, tap-to-pause, one sound button, time/progress and Info.
- Media pages follow vertical dragging and settle into the next/previous server item. A short drag returns to the same player and position. Only the active page owns playback; adjacent previews are silent. Timing is suspended during movement without changing play intent. Every item the session lands on (next, previous, automatic advance or a replacement) starts playing: a pause belongs only to the item it was made on. The app has no paused state the viewer did not choose. Buttons, keyboard, wheel and accessibility navigation use the same page transition. Reduced-motion settings remove the settling animation.
- Narrow web keeps semantic previous/next controls available to assistive technology and reveals them on keyboard focus. Native exposes activation and localized next/previous accessibility actions. Web arrow navigation works after focusing media controls, while dialogs, editing fields and reminder reading regions keep their own keys. Modified wheel gestures do not navigate.
- On native/narrow web, sound sits beside Info (44px targets, 12px gap) during media only. Remove the visible swipe hint while keeping gestures and accessibility navigation. Place speaker/title, time and progress in one bottom stack with 20px side margins and safe-area clearance. Its fade follows the content height. Desktop retains its icon-only sound rail, whose buttons never move when sound changes, and uses a 128px bottom fade without an in-player top fade. See [the accepted overlay spec](design/player-overlay.md).
- Rails orders all media and reminders, including text and duration. The client does not choose a cadence, shuffle the catalog, or download the catalog.
- A pending reminder cannot be skipped. Pause-to-read stops its countdown. A consumed reminder does not repeat when navigating backward then forward.
- Reminder screens show the citation without Quran/hadith text-source footnotes. Numeric citation ranges use a plain hyphen with spaces and keep their order in RTL text. Timer labels use Arabic singular/dual/plural forms and English singular/plural forms.
- Reminder text scrolls independently of the always-reachable countdown and pause-to-read controls. Reading screens adapt independently of the video's portrait frame, including long content and enlarged text.
- The language row places the selected language before the trailing arrow in the current UI reading direction.
- About contains app information, privacy, Contact, language and version. There is no Sources & Licenses screen. Contact credits the EasyBooks initiative and uses the public Telegram, YouTube, X, Facebook, GitHub organization and email destinations from Faqieh’s footer; it does not link to the private Mofied repository.
- Info subpages slide forward/back according to the UI reading direction. The outgoing page remains visible during the transition, and inactive controls are excluded from interaction/accessibility. Android Back returns from a detail page before dismissing Info.
- Finite ending with reflection and Info. No restart, new-session or replay action. About at the ending has no “continue watching” button.

## Playback and timing

| Situation                                          | Behavior                                                                                            |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Media advances                                     | Count actual advancing playback time                                                                |
| Loading, buffering, autoplay blocked, manual pause | Do not consume session time                                                                         |
| Moving to another item                             | The destination plays, even when the previous item was paused                                       |
| Reminder visible/running                           | Count elapsed time up to its duration                                                               |
| About open                                         | Pause media/reminder; retain position and prior play intent                                         |
| About closes                                       | Resume only if intent was playing before opening                                                    |
| Browser tab hidden                                 | No app-induced pause; media and reminder transitions continue while browser scheduling permits      |
| Native background or phone locked                  | Pause media/reminder and session accounting; no PiP/background audio                                |
| Native foreground return                           | Continue the same session; resume prior play intent; manual pause remains paused                    |
| Control Center or notification drawer              | Do not pause merely because focus becomes inactive/blurred                                          |
| Audio interruption                                 | Pause accounting, preserve user intent; resume when the platform reports that resumption is allowed |
| Timer budget reached                               | Finish the current item, then end; navigation/failure does not start another item                   |
| All planned items consumed                         | End immediately, even if budget remains                                                             |

Browser autoplay is subject to browser policy. Web tries to play with sound first. If the browser refuses sound, the media plays muted and a small white “اضغط لتشغيل الصوت” pill appears at the top of the player, as on Faqieh's Shorts. Any tap on the media, swipe, navigation key or the pill itself restores sound and hides it; the tap that restores sound does not also pause. The sound button also restores it rather than muting again. Reminders and the ending are silent: they hide the pill, and sound stays withheld until a gesture on the next media. If the browser refuses even muted playback, the existing tap-to-start prompt starts it with sound. Native apps always start with sound. Chrome can suspend untouched muted autoplay after tab hiding; the UI reflects an externally blocked player and attempts to resume on return. The continuous hidden-tab test enables sound with a user gesture first. A frozen/discarded tab or sleeping device cannot be made to run on schedule by JavaScript. Delayed reminder callbacks consume only that reminder's remaining duration, never time for media that has not played.

Web title/speaker links open a separate tab. Native links open the system browser; returning continues the same session.
Native link-opening failures show localized feedback. The time badge describes the current item as finishing after the budget is exhausted.

## Session lifetime and failure handling

Each web page load or refresh requests a new session from Faqieh with HTTP caching disabled. Returning through browser back/forward cache also requests a fresh plan. Merely hiding a tab does not reset or pause its session.

Each native app launch requests a new session. Moving to another app, opening a link or locking the phone pauses the session; returning continues the same session where it was, however long the app was away. Only a relaunch (the viewer closed the app, or the OS ended it) starts a new one. A plan that arrives while the app is in the background waits, paused, for its return. `inactive`/blur alone (Control Center, notification drawer) changes nothing. Info and language changes retain the current in-memory session.

Sessions do not expire.

Neither client saves plans, playheads, counted time, reminders, replacements or sound preferences, and neither uses device storage. The shared controller has no serialization/restoration API. Normal media/image caching and next-item preloading still operate within the current session.

An API error remains an error and offers retry; it never silently substitutes a fixture. Info/privacy stay accessible before a session loads. Requests time out after 15 seconds.

A media error first consumes one server-supplied replacement, preserving the following reminder slot. Without a spare, the controller advances within the existing plan until the consecutive-failure cap or last item, then shows retry. Twenty seconds without playback progress triggers recovery while playback is intended. OS interruptions and explicit pauses do not run that watchdog. Native buffering callbacks preserve play intent; they do not imply browser-style autoplay denial.
The failure streak resets only after accepted positive playback time, not a ready/playing callback alone. Time accounting reconciles cumulative playhead and clock totals within uninterrupted playback, resetting at pause, buffering, seek and item boundaries.

## Before public launch

Contact uses the initiative’s public social channels and easybooksdev@gmail.com. The in-app privacy copy describes the fresh-session behavior and external media requests; publish a canonical privacy URL reflecting the actual API/CDN logging and any future analytics. No authentication is needed for Info or privacy.

Language switching changes UI labels locally. Media, reminder and ending text remain in the language supplied by the plan. The default production plan is Arabic; the API also supports English via the endpoint locale. Changing UI language does not replace or reorder a running session. A persistent language preference remains separate future work.
