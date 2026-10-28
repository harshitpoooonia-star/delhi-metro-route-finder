# Data model

## Station

| Field | Type | Rules |
|---|---|---|
| id | int | unique, > 0 |
| name | text, up to 63 chars | no commas, not empty |
| line | text, up to 15 chars | one of the lines in the file |
| adj | list of links | filled from `links.txt` |

## Link

| Field | Type | Rules |
|---|---|---|
| to | station index | must exist |
| minutes | int | > 0 |

Stored twice, once on each end, since every link runs both ways.

## Route

| Field | Type |
|---|---|
| path | station indexes, start to end |
| len | number of stations in path |
| minutes | sum of link minutes |
| stops | links travelled, not counting interchange walks |
| fare | rupees, from the slab table |

A link counts as an interchange walk when its two stations are on different lines.

## File formats

`stations.txt`:

```text
id,name,line
12,Knowledge Park II,Aqua
```

`links.txt`:

```text
from,to,minutes
12,13,2
```

The first line of each file is a header and is skipped.
