# Product decisions

This is the behavior baseline for the initial implementation. The approved design reference is `design/decisions.json`; later explicit user decisions take precedence.

- Open into the first media. No homepage, accounts, catalog, comments, reactions or creator actions.
- Use the supplied monochrome Mofied icon unchanged. Thmanyah for titles; Noto Naskh Arabic UI for interface text; Kitab for Quran text; Gilroy for Latin/time labels.
- Desktop Info is icon-only. No “من مكتبة فقيه” line beneath titles. Keep media and speaker links to their actual Faqieh pages.
- Clamp titles to three lines on desktop and two on narrow web/native. Keep the full title in the contract and link directly to Faqieh; no extra details sheet.
- Desktop has a slim previous/next/sound rail, small pause control and keyboard navigation. Native has swipe navigation, tap-to-pause, one sound button, time/progress and Info.
- Narrow web keeps semantic previous/next controls available to assistive technology and reveals them on keyboard focus. Native exposes activation and localized next/previous accessibility actions. Web arrow navigation works after focusing media controls, while dialogs, editing fields and reminder reading regions keep their own keys. Modified wheel gestures do not navigate.
- On native/narrow web, sound sits beside Info (44px targets, 12px gap) during media only. Remove the visible swipe hint while keeping gestures and accessibility navigation. Place speaker/title, time and progress in one bottom stack with 20px side margins and safe-area clearance. Its fade follows the content height. Desktop retains its labelled sound rail and uses a 128px bottom fade without an in-player top fade. See [the accepted overlay spec](design/player-overlay.md).
- Rails orders all media and reminders, including text and duration. The client does not choose a cadence, shuffle the catalog, or download the catalog.
- A pending reminder cannot be skipped. Pause-to-read stops its countdown. A consumed reminder does not repeat when navigating backward then forward.
- Reminder screens show the citation without Quran/hadith text-source footnotes. Numeric citation ranges use a plain hyphen with spaces and keep their order in RTL text. Timer labels use Arabic singular/dual/plural forms and English singular/plural forms.
- Reminder text scrolls independently of the always-reachable countdown and pause-to-read controls. Reading screens adapt independently of the video's portrait frame, including long content and enlarged text.
- The language row places the selected language before the trailing arrow in the current UI reading direction.
- About contains app information, privacy, Contact, language and version. There is no Sources & Licenses screen. Contact credits the EasyBooks initiative and uses the public Telegram, YouTube, X, Facebook, GitHub organization and email destinations from Faqieh’s footer; it does not link to the private Mofied repository.
- Finite ending with reflection and Info. No restart, new-session or replay action. About at the ending has no “continue watching” button.

## Playback and timing

| Situation                                          | Behavior                                                                                            |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Media advances                                     | Count actual advancing playback time                                                                |
| Loading, buffering, autoplay blocked, manual pause | Do not consume session time                                                                         |
| Reminder visible/running                           | Count elapsed time up to its duration                                                               |
| About open                                         | Pause media/reminder; retain position and prior play intent                                         |
| About closes                                       | Resume only if intent was playing before opening                                                    |
| Browser tab hidden                                 | No app-induced pause; media and reminder transitions continue while browser scheduling permits      |
| Native background or phone locked                  | Pause media/reminder and session accounting; no PiP/background audio                                |
| Native foreground return                           | Resume prior play intent; manual pause remains paused                                               |
| Control Center or notification drawer              | Do not pause merely because focus becomes inactive/blurred                                          |
| Audio interruption                                 | Pause accounting, preserve user intent; resume when the platform reports that resumption is allowed |
| Timer budget reached                               | Finish the current item, then end; navigation/failure does not start another item                   |
| All planned items consumed                         | End immediately, even if budget remains                                                             |

Browser autoplay is subject to browser policy. Web starts muted and offers the approved sound control. Chrome can suspend untouched muted autoplay after tab hiding; the UI reflects an externally blocked player and attempts to resume on return. The continuous hidden-tab test enables sound with a user gesture first. A frozen/discarded tab or sleeping device cannot be made to run on schedule by JavaScript. Delayed reminder callbacks consume only that reminder's remaining duration, never time for media that has not played.

Web title/speaker links open a separate tab. Native links open the system browser; the resulting native background transition pauses playback.
Native link-opening failures show localized feedback. The time badge describes the current item as finishing after the budget is exhausted.

## Persistence and failure handling

Web uses tab-scoped `sessionStorage`; native uses local AsyncStorage. Both save the plan, position, counted time, completed reminders and replacement consumption. Development and production state are separate. A restored in-progress session opens paused. Invalid/expired state is discarded; ended sessions are removed. This is local continuity, not cross-device identity or a server-enforced daily limit.
Tracking and other query parameters do not bypass restoration. Only recognized development fixture/test parameters start a fresh fixture when no API is configured.

An API error remains an error and offers retry; it never silently substitutes a fixture. Info/privacy stay accessible before a session loads. Requests time out after 15 seconds.

A media error first consumes one server-supplied replacement, preserving the following reminder slot. Without a spare, the controller advances within the existing plan until the consecutive-failure cap or last item, then shows retry. Twenty seconds without playback progress triggers recovery while playback is intended. OS interruptions and explicit pauses do not run that watchdog. Native buffering callbacks preserve play intent; they do not imply browser-style autoplay denial.
The failure streak resets only after accepted positive playback time, not a ready/playing callback alone. Time accounting reconciles cumulative playhead and clock totals within uninterrupted playback, resetting at pause, buffering, seek and item boundaries.

## Before public launch

Contact uses the initiative’s public social channels and easybooksdev@gmail.com. The in-app privacy copy describes the implemented local persistence and external media requests; publish a canonical privacy URL reflecting the actual API/CDN logging and any future analytics. No authentication is needed for Info or privacy.

Language switching changes UI labels locally. The sample media, reminder and ending text remain the language supplied by the plan. Server-localized plans and persistent language preference can be connected with the API integration.
