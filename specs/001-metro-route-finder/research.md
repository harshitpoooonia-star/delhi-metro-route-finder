# Research: Delhi Metro route finder

## Shortest path

- **Decision**: Dijkstra with plain `dist[]`, `visited[]` and `prev[]` arrays and a linear scan for the next station, O(V^2).
- **Rationale**: at a few hundred stations V^2 is under a million steps, far below a second. It's the version taught in the course and the one the proposal describes.
- **Alternatives**: a binary heap gives O(E log V) but adds about 60 lines for no visible gain here. BFS ignores minutes.

## Station ids

- **Decision**: file ids are arbitrary integers. Stations sit in a growable array; each keeps its file id and gets an index by load order. Lookups by id are a linear scan.
- **Rationale**: lets the data file skip ids or renumber freely. A scan of a few hundred entries happens once per link at load time.
- **Alternatives**: using ids as array indexes directly breaks on gaps and big numbers.

## Line order for line view

- **Decision**: start from a station on the line that has at most one neighbour on the same line (a terminal) and walk same-line links, never going back.
- **Rationale**: needs no extra column in the data files. Works for straight lines, which all four sample lines are.
- **Alternatives**: a sequence column in `stations.txt`. Simpler to print, but one more thing to keep right when adding stations.

## Fare

- **Decision**: slab table on stop count, documented in the spec's assumptions.
- **Rationale**: the files have minutes, not kilometres.

## Input

- **Decision**: read every line with `fgets` and parse with `sscanf`/`strtol`.
- **Rationale**: `scanf("%d")` leaves junk in the buffer on bad input and loops forever, which breaks the "never crash or loop" criterion.
