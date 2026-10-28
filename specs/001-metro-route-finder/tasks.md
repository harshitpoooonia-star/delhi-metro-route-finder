# Tasks: Delhi Metro route finder

**Input**: design docs in `specs/001-metro-route-finder/`
**Tests**: yes, the plan asks for an assert-based test binary (`make test`).

## Phase 1: Setup

- [x] T001 Create `src/`, `data/`, `tests/data/` and a `Makefile` with `all` (builds `metro` from `src/*.c` with `gcc -std=c11 -Wall -Wextra -O2`), `test` (builds and runs `tests/test_main.c` linked with `graph.c route.c fileio.c`) and `clean`
- [x] T002 [P] Add `.gitignore` for `metro`, `metro.exe`, `test_metro`, `*.o`

## Phase 2: Foundational

- [x] T003 Write `src/metro.h`: `Station` (id; name up to 63 chars; line up to 15 chars; adjacency array), `Link` (to index, minutes > 0), `Net` (growable station array), `Route` (path, len, minutes, stops, fare), and declarations for every function below
- [x] T004 Implement `src/graph.c`: `net_init`, `net_free`, `net_add_station` (refuses duplicate id, empty name, name with a comma), `net_find_id`, `net_add_link` (both directions, refuses unknown ids and minutes <= 0)
- [x] T005 Implement `src/fileio.c`: `load_stations` and `load_links` (skip the header line, skip and warn `<file>:<line>: skipped` on bad lines, fail with `can't open <file>`), `save_stations`, `save_links` (each link written once)
- [x] T006 [P] Write fixture network in `tests/data/stations.txt` and `tests/data/links.txt`: two short lines meeting at one interchange, plus one isolated station
- [x] T007 Tests in `tests/test_main.c` for T004 and T005: duplicate id refused, link is two-way, bad file lines skipped, save then reload gives the same network

## Phase 3: User story 1, find the fastest route (P1)

**Goal**: fastest route with line changes, stops, minutes and fare.
**Independent test**: fixture route across the interchange; sample route Knowledge Park II to Rajiv Chowk.

- [x] T008 [US1] Tests in `tests/test_main.c`: same-line route has no change; cross-line route changes once; slower-but-fewer-stops path loses; isolated station gives no route; minutes equal sum of links; interchange walk not counted as a stop; fare slabs at 2, 3, 5, 6, 12, 13, 21, 22, 32, 33 stops
- [x] T009 [US1] Implement in `src/route.c`: `find_route` (O(V^2) Dijkstra with `dist[]`, `visited[]`, `prev[]`, then rebuild the path), `fare_for` (slabs from the spec's assumptions)
- [x] T010 [US1] Implement `print_route` in `src/route.c` matching `contracts/cli.md`
- [x] T011 [US1] Write sample data in `data/stations.txt` and `data/links.txt` for Aqua, Blue, Yellow and Magenta, with walking links at the real interchanges
- [x] T012 [US1] Implement `src/menu.c` route option and `src/main.c` (loads `data/` or the dir in argv[1], runs the menu loop); input via `fgets` only

## Phase 4: User story 2, station search (P2)

- [x] T013 [US2] Test case-insensitive substring match in `tests/test_main.c`
- [x] T014 [US2] Implement `net_match` in `src/graph.c` and the search option plus pick-from-list for route input in `src/menu.c`

## Phase 5: User story 3, line view (P3)

- [x] T015 [US3] Test that the fixture line prints end to end in order in `tests/test_main.c`
- [x] T016 [US3] Implement `line_order` in `src/graph.c` (start at a station with at most one same-line neighbour, walk forward) and the line option in `src/menu.c`; unknown line prints `unknown line: <text>`

## Phase 6: User story 4, admin mode (P4)

- [x] T017 [US4] Implement add-station and add-link options in `src/menu.c`, saving with `save_stations` / `save_links` and showing the T004 errors

## Phase 7: Polish

- [x] T018 Build with no warnings, run `make test`, walk through `quickstart.md`
- [x] T019 [P] Update `README.md` with build and run steps and the real sample output; fix the example in `contracts/cli.md` to match

## Dependencies

Setup, then foundational, then US1. US2, US3 and US4 each need only the foundation and the menu from US1, so they can go in any order after it.

## Parallel work

T002 with T001; T006 with T004 and T005; T019 alongside T018.

## MVP

Phases 1 to 3. That's a working route finder; the rest adds convenience.
