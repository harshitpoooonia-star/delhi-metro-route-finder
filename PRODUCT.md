# NextStop

NextStop (formerly Delhi Metro Route Finder) tells a Delhi Metro rider how to get from one station
to another: which lines, where to change, how long, roughly what it costs, and then walks them
through the trip stop by stop. The routing engine is the original C coursework program compiled to
WebAssembly, so it runs in the browser and works underground with no signal.

## Who uses it

- Students and commuters on a mid-range Android phone, often on a platform or inside a train, with
  one thumb free and patchy signal.
- Visitors who don't know the network and need to be told where to change.
- Occasionally someone on a laptop planning ahead.

## The job

1. Get a correct route in seconds from a half-remembered station name.
2. Not miss the change or the stop once on the train.
3. Send the route to a friend.

## Surface mode

Operate. Speed, scanability and familiar patterns come first; the identity lives in the line
colours, the route strip and the details.

## Constraints

- Static site, no server, no accounts. Everything runs on the device; trips are stored only in the
  browser's local storage.
- Network data covers the Aqua, Blue, Yellow and Magenta lines (133 rows). Times and fares are
  estimates, and the app says so.
- Not an official DMRC product; the footer says so on every screen.
