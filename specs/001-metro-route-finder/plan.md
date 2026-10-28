# Implementation plan: Delhi Metro route finder

**Branch**: `001-metro-route-finder` | **Date**: 2026-10-28 | **Spec**: [spec.md](spec.md)

## Summary

A terminal program in C that loads the metro network from two text files into an adjacency list and runs Dijkstra on travel minutes to find the fastest route. Interchanges are plain links weighted by walking time, so line changes cost time with no special handling in the search. Line changes are found afterwards by comparing the line of each stop with the one before it.

## Technical context

**Language/version**: C11

**Primary dependencies**: standard library only

**Storage**: `data/stations.txt` and `data/links.txt`, comma-separated, one header line each

**Testing**: `tests/test_main.c`, a plain `assert` binary run by `make test`, using a small fixture network in `tests/data/`

**Target platform**: GCC on Linux, macOS, and Windows (MinGW)

**Project type**: CLI

**Performance goals**: a route on about 150 stations prints in well under a second

**Constraints**: no third-party libraries; must build with `gcc -std=c11 -Wall -Wextra` and no warnings

**Scale/scope**: four lines in the sample data, up to 1,000 stations without code changes

## Constitution check


## Project structure

### Documentation (this feature)

```text
specs/001-metro-route-finder/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/cli.md
└── tasks.md
```

### Source code (repository root)

```text
src/
├── metro.h      shared types and function declarations
├── graph.c      network storage, lookups, adding stations and links
├── route.c      Dijkstra, path rebuild, line changes, fare
├── fileio.c     loading and saving the data files
├── menu.c       menu, input, search, line view, admin mode
└── main.c       startup and the menu loop
data/
├── stations.txt
└── links.txt
tests/
├── test_main.c
└── data/        small fixture network
Makefile
```

**Structure decision**: one header and the four files named in the proposal, plus a short `main.c`. Splitting `main` out lets the test binary link `graph.c`, `route.c` and `fileio.c` without pulling in the menu.

## Complexity tracking

None.
