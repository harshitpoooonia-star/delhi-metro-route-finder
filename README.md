# Delhi Metro Route Finder

A menu-driven C program that finds the fastest metro route between two stations in Delhi NCR. CSET333 Problem Solving using C, Bennett University.

**Status: in development.** Target: a working build by mid-November 2026.

## What it will do

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

## Planned features

| Feature | What it does |
|---|---|
| Route search | Fastest path between two stations, stop by stop |
| Line changes | Flags every station where the rider switches lines |
| Trip summary | Stops, minutes and fare in rupees |
| Station search | Partial names, so "sec" lists every Sector station |
| Line view | All stations on one line, in order |
| Admin mode | Add a station or link and save it to the data files |
| Error handling | Short messages for unknown names, same source and destination, or no route |

Code is split across `graph.c`, `route.c`, `fileio.c` and `menu.c`, built with GCC.

## Limits

Timings and fares are simplified. Fares use a distance-based slab system and won't match DMRC exactly. This is a student project, not an official DMRC tool.

## Development

Specs live under `specs/`.
