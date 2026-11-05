# Product decisions

This is the behavior baseline for the initial implementation. The approved design reference is `design/decisions.json`; later explicit user decisions take precedence.

- Open into the first media. No homepage, accounts, catalog, comments, reactions or creator actions.
- Use the supplied monochrome Mofied icon unchanged. Thmanyah for titles; Noto Naskh Arabic UI for interface text; Kitab for Quran text; Gilroy for Latin/time labels.
- Desktop Info is icon-only. No “من مكتبة فقيه” line beneath titles. Keep media and speaker links to their actual Faqieh pages.
- Clamp titles to three lines on desktop and two on narrow web/native. Keep the full title in the contract and link directly to Faqieh; no extra details sheet.
- Desktop has a slim previous/next/sound rail, small pause control and keyboard navigation. Native has swipe navigation, tap-to-pause, one sound button, time/progress and Info.
- Rails orders all media and reminders, including text and duration. The client does not choose a cadence, shuffle the catalog, or download the catalog.
- A pending reminder cannot be skipped. Pause-to-read stops its countdown. A consumed reminder does not repeat when navigating backward then forward.
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

## Persistence and failure handling

Web uses tab-scoped `sessionStorage`; native uses local AsyncStorage. Both save the plan, position, counted time, completed reminders and replacement consumption. Development and production state are separate. A restored in-progress session opens paused. Invalid/expired state is discarded; ended sessions are removed. This is local continuity, not cross-device identity or a server-enforced daily limit.

An API error remains an error and offers retry; it never silently substitutes a fixture. Info/privacy stay accessible before a session loads. Requests time out after 15 seconds.

A media error first consumes one server-supplied replacement, preserving the following reminder slot. Without a spare, the controller advances within the existing plan until the consecutive-failure cap or last item, then shows retry. Buffering has a 20-second watchdog while playback is intended. OS interruptions and explicit pauses do not run that watchdog.

## Before public launch

The support row currently links to this private development repository. Replace it with a public support contact. The in-app privacy copy describes the implemented local persistence and external media requests; publish a canonical privacy URL reflecting the actual API/CDN logging and any future analytics. Sources/licenses need the final release notices. No authentication is needed for Info or privacy.

Language switching changes UI labels locally. The sample media, reminder and ending text remain the language supplied by the plan. Server-localized plans and persistent language preference can be connected with the API integration.
