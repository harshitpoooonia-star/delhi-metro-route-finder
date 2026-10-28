# NextStop feature brainstorm

Ideas for making the route finder more useful to a rider, sorted by what shipped in this round and
what is left. "Engine change" means the C code in `src/` and a WebAssembly rebuild would be needed;
everything else runs in `web/app.js` on top of the existing API.

## Shipped in this round

| Feature | What the rider gets | Engine change |
|---|---|---|
| Ride mode | "Start trip" turns the route into one stop at a time: next stop in large type, a progress bar in the current line's colour, stops and minutes left, and a dark callout when the next step is a line change. One thumb-sized button moves on. Survives the tab being killed (stored on the device). | No |
| Arrival screen | Ride mode ends on "You've arrived at X" with the trip's real duration against the estimate and a "Plan the trip back" button that swaps the stations. | No |
| Arrival clock | "Arrive about 6:55 pm if you leave now" next to the trip time, refreshed every 30 seconds. | No |
| Saved trips | Star a route; it shows above Recent on the home screen and on the Saved tab. Remove with one tap. | No |
| Share as text | Share sends the whole route as plain text (lines, directions, changes, time, fare) plus the link, through the phone's share sheet or the clipboard. Made for WhatsApp. | No |
| Forgiving search | Short forms and Hinglish spellings resolve before the engine sees them: "cp", "kashmiri gate", "hauz khaas", "sec 18", "du", "airport", "gurgaon", "ndls". | No |
| Did you mean | An unknown station offers up to three real stations as buttons instead of a dead end. | No |
| Recent stations | Focusing an empty field lists the stations from saved and recent trips, so a regular never types. | No |
| Line map | The Lines tab draws each line as one unbroken strip in its colour, marks interchanges, lists them beside the strip, and has From / To buttons on every station. | No |
| Route options | Fastest and Fewest changes as a segmented control, kept in the URL (`&pref=fewest-changes`). | No |
| Keyboard | "/" jumps to the search, arrows move through suggestions, Enter or Tab picks, Esc clears. | No |
| Load and offline state | Fields stay disabled with "Loading stations..." until the engine is ready; "Offline ready" appears once the service worker has cached the app. | No |

## Next, small

- **Walkway interchanges from the data.** Noida Sector 51 and 52 are hard-coded as a walkway in
  `app.js`. An `api_transfers()` export would let the Lines view find all of them. Engine change.
- **Per-leg minutes.** The engine knows each hop's minutes but `api_route` only returns the trip
  total, so ride mode spreads time evenly. Returning minutes per leg would make "minutes left"
  accurate. Engine change.
- **Hindi names.** Mukta already has a Devanagari design. Needs a `name_hi` column in the data and
  a language toggle.
- **Light / dark toggle.** Follows the system today; some riders want dark on a bright platform.
- **Home and Work.** Two named slots above Saved trips, filled from any station's menu.

## Later, bigger

- **Nearest station.** Uses location to fill "From". Needs coordinates for every station.
- **Fewest stations / cheapest.** More route preferences, as in the handover plan (ADR-001).
- **Fares by distance.** The engine prices by stop count; DMRC prices by distance and has Sunday
  and smart-card rates. Needs distance data and checked fare tables.
- **Full network.** Red, Green, Violet, Pink, Grey, Airport Express and Rapid Metro, with the Blue
  and Green branches.
- **Ride mode that moves on its own.** Advance by the clock or by GPS when there is signal, with
  a vibration one stop before the change and before the destination.
- **Last train warning.** Needs last-train times per line.
- **Accessibility info.** Lifts and step-free exits per station.
