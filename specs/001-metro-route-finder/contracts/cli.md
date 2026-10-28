# CLI contract

Run as `./metro [data-dir]`. `data-dir` defaults to `data`.

## Menu

```text
1. Find route
2. Search station
3. Show line
4. Add station
5. Add link
0. Exit
```

## Route output

```text
Route: Knowledge Park II -> Rajiv Chowk

  Knowledge Park II        Aqua
  ...
  Sector 51                Aqua
  >> change: Aqua -> Blue (walk 6 min)
  Sector 52                Blue
  ...
  Rajiv Chowk              Blue

Stops: 32  Time: 74 min  Fare: Rs 54
```

## Messages

| Case | Text |
|---|---|
| no match | `no such station: <text>` |
| same start and end | `start and end are the same` |
| no path | `no route between <a> and <b>` |
| unknown line | `unknown line: <text>` |
| duplicate id | `id <n> already used` |
| missing station in link | `no station with id <n>` |
| bad file line | `<file>:<line>: skipped` |
| missing file | `can't open <file>` |
