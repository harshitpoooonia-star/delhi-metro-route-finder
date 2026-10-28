# Feature specification: Delhi Metro route finder

**Feature branch**: `001-metro-route-finder`

**Created**: 2026-10-28

**Status**: Draft

**Input**: Course project proposal for CSET333, Problem Solving using C (see README).

## User scenarios and testing

### User story 1: find the fastest route (P1)

A rider types a start and end station and gets the fastest route, stop by stop, with every line change marked and the trip's stops, minutes and fare at the bottom.

**Why this priority**: it's the whole point of the program. Everything else is support.

**Independent test**: load the sample network, ask for Knowledge Park II to Rajiv Chowk, check the route changes from Aqua to Blue at Sector 51 / Sector 52 and the totals add up.

**Acceptance scenarios**:

1. **Given** the network is loaded, **When** the rider asks for two stations on the same line, **Then** the route stays on that line and shows no line change.
2. **Given** the network is loaded, **When** the rider asks for stations on two different lines, **Then** the route shows each change with the line before and after.
3. **Given** two possible routes, **When** one takes fewer minutes including walking time at interchanges, **Then** that one is shown even if it has more stops.

### User story 2: find a station by part of its name (P2)

A rider who doesn't know the exact name types part of it and gets every matching station with its line.

**Why this priority**: station names are long and easy to mistype. Without this, route search fails for a lot of real inputs.

**Independent test**: search "sec" and get every Sector station; search "zzz" and get a "no match" message.

**Acceptance scenarios**:

1. **Given** the network is loaded, **When** the rider types "sec", **Then** every station with "sec" in its name is listed, case ignored.
2. **Given** route search, **When** the rider's text matches exactly one station, **Then** that station is used without asking again.
3. **Given** route search, **When** the text matches several stations, **Then** the rider picks one from a numbered list.

### User story 3: see all stations on a line (P3)

A rider picks a line and gets its stations in order from one end to the other.

**Why this priority**: useful for planning, but riders can get by without it.

**Independent test**: ask for the Aqua line and get its stations in order, ending at the terminals.

**Acceptance scenarios**:

1. **Given** the network is loaded, **When** the rider picks Aqua, **Then** the Aqua stations print in order, end to end.
2. **Given** the rider types a line that doesn't exist, **Then** a short "unknown line" message appears.

### User story 4: add a station or link (P4)

Whoever maintains the data adds a new station or a new link from the menu, and it's saved to the data files so it's there next time.

**Why this priority**: the network grows over time, but editing the text files by hand also works.

**Independent test**: add a station and a link to it, quit, restart, and route to the new station.

**Acceptance scenarios**:

1. **Given** admin mode, **When** a new station with a free id is added, **Then** it's saved and can be searched straight away.
2. **Given** admin mode, **When** a link between two existing stations is added, **Then** routes can use it straight away and it survives a restart.
3. **Given** admin mode, **When** the id is already taken or a link names a missing station, **Then** nothing is saved and a short error appears.

### Edge cases

- Same station for start and end: short message, no route.
- No path between the two stations: "no route" message.
- A station name that matches nothing: "no such station".
- Missing or unreadable data file: the program says which file and exits cleanly.
- A bad line in a data file (wrong column count, non-numeric id or minutes, a link to an unknown id): skipped with a warning naming the file and line number; the rest still loads.
- Blank input or non-numeric menu choices: asked again, no crash.

## Requirements

### Functional requirements

- **FR-001**: The program MUST load stations (id, name, line) and links (from, to, minutes) from two text files at startup.
- **FR-002**: Links MUST work in both directions with the same minutes.
- **FR-003**: Interchanges MUST be ordinary links whose minutes are walking time, so a line change adds time.
- **FR-004**: Route search MUST return the route with the fewest total minutes.
- **FR-005**: The route MUST print stop by stop, with each line change marked by the line left and the line joined.
- **FR-006**: Every route MUST end with the number of stops, total minutes and fare in rupees.
- **FR-007**: Fare MUST come from a stop-count slab table (see assumptions).
- **FR-008**: Station search MUST match any part of a name, case ignored.
- **FR-009**: Line view MUST list a line's stations in travel order.
- **FR-010**: Admin mode MUST add stations and links and write them back to the data files.
- **FR-011**: Admin mode MUST refuse duplicate station ids and links to unknown stations.
- **FR-012**: Every error in the edge cases above MUST produce a one-line message and return to the menu (or exit cleanly for a missing file).
- **FR-013**: The sample data MUST cover the Aqua, Blue, Yellow and Magenta lines.

### Key entities

- **Station**: id, name, line. A physical interchange with two lines is two stations joined by a walking link (Sector 51 on Aqua, Sector 52 on Blue).
- **Link**: two station ids and the minutes between them.
- **Route**: the ordered stations from start to end, plus stops, minutes and fare.

## Success criteria

### Measurable outcomes

- **SC-001**: Knowledge Park II to Rajiv Chowk returns a route with one marked change from Aqua to Blue.
- **SC-002**: Every route's minutes equal the sum of its link minutes.
- **SC-003**: Every edge case above gives a message and never crashes or loops.
- **SC-004**: A station added in admin mode can be routed to after a restart.
- **SC-005**: A route on the full four-line network prints in under a second.

## Assumptions

- Fares use stop count, since the files hold minutes but no distances. Slabs: up to 2 stops Rs 11, 3 to 5 Rs 21, 6 to 12 Rs 32, 13 to 21 Rs 43, 22 to 32 Rs 54, more Rs 64. These are close to DMRC's distance slabs but won't match real fares.
- Interchange walking links don't count as stops.
- Station travel times are estimates, not DMRC timetable data.
- The program runs in a terminal, one user at a time. No login for admin mode.
- Station names in the data files don't contain commas.
