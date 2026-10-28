# Delhi Metro Route Finder

A menu-driven C program that finds the fastest metro route between two stations in Delhi NCR. CSET333 Problem Solving using C, Bennett University.

**Status: working.** All features in the proposal are in.

## What it does

Ask for a source and destination, then print the route stop by stop, flag each line change, and total up stops, travel time and fare. A trip from Knowledge Park II to Rajiv Chowk, for example, needs the Aqua Line and the Blue Line, and the program works out where to switch.

The first version covers the Aqua, Blue, Yellow and Magenta lines.

## How it works

The network is a weighted graph. Each station is a node, each link between neighbouring stations is an edge weighted by travel time in minutes. Interchanges such as Sector 51 (Aqua) to Sector 52 (Blue) are edges too, weighted by walking time, so a line change costs time the way it does in real life.

1. Load `stations.txt` and `links.txt` into an adjacency list
2. Read source and destination, matching partial names
3. Run Dijkstra from the source, keeping each station's best time and predecessor
4. Walk back from the destination to rebuild the path
5. Print the route with line changes, stops, time and fare

## Data files

```
stations.txt    id,name,line
12,Knowledge Park II,Aqua
31,Sector 51,Aqua
58,Sector 52,Blue

links.txt       from,to,minutes
12,13,2
31,58,6
```

Adding a station is one new line in a file, no code change.

## Features

| Feature | What it does |
|---|---|
| Route search | Fastest path between two stations, stop by stop |
| Line changes | Flags every station where the rider switches lines |
| Trip summary | Stops, minutes and fare in rupees |
| Station search | Partial names, so "sec" lists every Sector station |
| Line view | All stations on one line, in order |
| Admin mode | Add a station or link and save it to the data files |
| Error handling | Short messages for unknown names, same source and destination, or no route |

## Build and run

```sh
make          # builds ./metro
make test     # runs the tests
./metro       # uses data/; ./metro other-dir to load another network
```

On Windows, build with MinGW (`mingw32-make`) or run `gcc -std=c11 -o metro src/*.c`.

Sample run, Knowledge Park II to Rajiv Chowk (middle stops cut):

```text
Route: Knowledge Park II -> Rajiv Chowk

  Knowledge Park II            Aqua
  Noida Sector 148             Aqua
  ...
  Noida Sector 51              Aqua
  >> change: Aqua -> Blue (walk 6 min)
  Noida Sector 52              Blue
  ...
  Rajiv Chowk                  Blue

Stops: 32  Time: 74 min  Fare: Rs 54
```

## Web version

The same C engine runs in the browser. `src/api.c` wraps routing, search and line view in
functions that return JSON, and Emscripten compiles it to WebAssembly with `data/` packed in.
`web/` is a small HTML/JS page on top: station autocomplete, swap button, a line-coloured route,
shareable links (`?from=Rajiv%20Chowk&to=Hauz%20Khas`) and offline use through a service worker.

```sh
make wasm     # needs emcc on PATH (Emscripten SDK)
make serve    # http://localhost:8000
```

`web/` is a static site, so it can go on any static host.

## Code

| File | What's in it |
|---|---|
| `src/graph.c` | stations, links, name search, line order |
| `src/route.c` | Dijkstra, path rebuild, line changes, fare |
| `src/fileio.c` | loading and saving the data files |
| `src/api.c` | JSON functions for the web build |
| `src/menu.c` | the menu, input, admin mode |
| `src/main.c` | startup |

Interchange stations like Rajiv Chowk exist once per line, joined by a walking link. When you pick one, Dijkstra starts from every copy at once (`find_route_multi`), so one run covers all of them.

## Limits

The sample network has 133 stations: the Aqua line, the main Blue line (Dwarka Sector 21 to Noida Electronic City), the Yellow line and the Magenta line from Janakpuri West to Botanical Garden. The Blue branch to Vaishali and the newer Magenta extension aren't in yet. Timings and fares are simplified. Fares go by number of stops (Rs 11 to Rs 64), since the data has minutes but no distances, and won't match DMRC. This is a student project, not an official DMRC tool.

## Development

The spec, plan and tasks are in `specs/001-metro-route-finder/`.
