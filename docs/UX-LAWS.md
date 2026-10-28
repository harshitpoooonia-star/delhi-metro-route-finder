# UX laws in NextStop

How each of the 20 laws in "UX Laws Guidelines: Do's and Don'ts" (2026-10-28) shows up in the web
app. File references point at `web/`.

| # | Law | Where it is applied |
|---|---|---|
| 1 | Aesthetic-Usability | One type face, one ground, colour only on the route. Every flow was tested by task (find, ride, save, share, recover from a typo), not by looks. |
| 2 | Hick's Law | Home shows at most four popular routes and four recent ones. Two route options, not a list. One primary action per screen. |
| 3 | Fitts's Law | Main actions are 48px, everything else at least 40px. On phones the tabs sit at the bottom and the ride-mode "next stop" button is full width and sticky above them, in the thumb zone. Swap sits next to the fields it swaps. |
| 4 | Jakob's Law | From / To with a swap button, a bottom tab bar on phones, a share sheet, "/" for search: the patterns of Google Maps and Uber. |
| 5 | Miller's Law | The route is chunked into legs; intermediate stations are folded ("14 stations in between"). Ride mode shows only the next stop and three after it. |
| 6 | Doherty Threshold | Routing is synchronous and takes milliseconds. Fields are disabled with "Loading stations..." until the engine is ready, so a tap never goes nowhere. |
| 7 | Proximity | Label sits 6px above its field; fields 8px apart; panels 16px apart. Save and Share sit beside Start trip. |
| 8 | Similarity | Every line is a pill in its own colour with its name in it, everywhere. Every button is a pill; only the primary is filled. |
| 9 | Common Region | Cards for search, result and lists; the line change sits in its own tinted box inside the strip. |
| 10 | Visual Hierarchy | Trip time (32px) is the largest figure; then the arrival clock; then changes, stops and fare in smaller grey. Three working sizes. |
| 11 | Progressive Disclosure | Intermediate stations behind a disclosure; the stop-by-stop view only when the rider asks for it with Start trip. |
| 12 | Recognition over Recall | Recent stations on focus, saved trips on the home screen, suggestions with line chips, labels that never vanish (placeholders are examples only). |
| 13 | Von Restorff | The line change is the only box in the strip with a split two-colour marker; in ride mode it becomes a dark full-width callout. |
| 14 | Peak-End | The worst moment (the change) gets the strongest guidance; the trip ends on an arrival screen with real duration and a one-tap trip back. |
| 15 | Goal-Gradient | Ride mode shows a true progress bar, "N stops to go" and "about N min left", counting down. |
| 16 | Serial Position | Plan first and Saved last in the tab bar; Start trip first in the action row; the destination is the last line of the strip. |
| 17 | Tesler's Law | The app carries the complexity: alias resolution, fuzzy matching, the arrival clock, direction of travel, walkway interchanges. |
| 18 | Postel's Law | Accepts "cp", "sec 18", "Kashmiri Gate", "hauz khaas", stray dots and "station" suffixes; always shows the clean station name back. |
| 19 | Occam's Razor | No accounts, no settings screen, no map tiles. Three tabs. |
| 20 | Feedback Loops | Toasts on save, remove, copy and clear; pressed state on every button; the station name announced in ride mode; errors say what went wrong and offer a fix ("Did you mean"). |
