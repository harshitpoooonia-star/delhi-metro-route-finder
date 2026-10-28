#include <stdlib.h>
#include <string.h>
#include "metro.h"

static int is_walk(const Net *g, int a, int b)
{
    return strcmp(g->st[a].line, g->st[b].line) != 0;
}

static int link_mins(const Net *g, int a, int b)
{
    for (int i = 0; i < g->st[a].nadj; i++)
        if (g->st[a].adj[i].to == b)
            return g->st[a].adj[i].mins;
    return 0;
}

/* Dijkstra from every station in src[] at once, stopping at the first one in dst[] it
   settles. Interchanges exist once per line, so this is how "Rajiv Chowk" means every
   copy of it without running the search once per pair. Each line change costs `penalty`
   extra minutes during the search only, so a big penalty gives the route with the fewest
   changes (and the fastest among those); r->mins is always real time.
   0 ok, -1 no route, -2 same station. */
int find_route_ex(const Net *g, const int *src, int ns, const int *dst, int nd, int penalty,
                  Route *r)
{
    for (int i = 0; i < ns; i++)
        for (int j = 0; j < nd; j++)
            if (src[i] == dst[j])
                return -2;

    int n = g->n;
    int *dist = malloc(n * sizeof *dist);
    int *prev = malloc(n * sizeof *prev);
    char *done = calloc(n, 1);
    char *goal = calloc(n, 1);
    if (!dist || !prev || !done || !goal) {
        free(dist); free(prev); free(done); free(goal);
        return -1;
    }
    for (int i = 0; i < n; i++) {
        dist[i] = INF;
        prev[i] = -1;
    }
    for (int i = 0; i < ns; i++)
        dist[src[i]] = 0;
    for (int j = 0; j < nd; j++)
        goal[dst[j]] = 1;

    /* O(V^2): a few hundred stations, so a heap buys nothing here */
    int end = -1;
    for (;;) {
        int u = -1;
        for (int i = 0; i < n; i++)
            if (!done[i] && dist[i] < INF && (u < 0 || dist[i] < dist[u]))
                u = i;
        if (u < 0)
            break;
        if (goal[u]) {
            end = u;
            break;
        }
        done[u] = 1;
        for (int j = 0; j < g->st[u].nadj; j++) {
            const Link *l = &g->st[u].adj[j];
            int w = l->mins + (is_walk(g, u, l->to) ? penalty : 0);
            if (!done[l->to] && dist[u] + w < dist[l->to]) {
                dist[l->to] = dist[u] + w;
                prev[l->to] = u;
            }
        }
    }

    int ret = -1;
    if (end >= 0) {
        int len = 0;
        for (int v = end; v >= 0; v = prev[v])
            len++;
        r->path = malloc(len * sizeof *r->path);
        if (r->path) {
            int k = len;
            for (int v = end; v >= 0; v = prev[v])
                r->path[--k] = v;
            r->len = len;
            r->mins = 0;
            r->stops = 0;
            for (int i = 1; i < len; i++) {
                r->mins += link_mins(g, r->path[i - 1], r->path[i]);
                if (!is_walk(g, r->path[i - 1], r->path[i]))
                    r->stops++;
            }
            r->fare = fare_for(r->stops);
            ret = 0;
        }
    }
    free(dist);
    free(prev);
    free(done);
    free(goal);
    return ret;
}

int find_route_multi(const Net *g, const int *src, int ns, const int *dst, int nd, Route *r)
{
    return find_route_ex(g, src, ns, dst, nd, 0, r);
}

int find_route(const Net *g, int src, int dst, Route *r)
{
    return find_route_ex(g, &src, 1, &dst, 1, 0, r);
}

void route_free(Route *r)
{
    free(r->path);
    r->path = NULL;
    r->len = 0;
}

/* stop-count slabs standing in for DMRC's distance slabs; see spec assumptions */
int fare_for(int stops)
{
    if (stops <= 2) return 11;
    if (stops <= 5) return 21;
    if (stops <= 12) return 32;
    if (stops <= 21) return 43;
    if (stops <= 32) return 54;
    return 64;
}

void print_route(const Net *g, const Route *r, FILE *out)
{
    const Station *a = &g->st[r->path[0]], *b = &g->st[r->path[r->len - 1]];
    fprintf(out, "\nRoute: %s -> %s\n\n", a->name, b->name);
    for (int i = 0; i < r->len; i++) {
        int cur = r->path[i];
        if (i && is_walk(g, r->path[i - 1], cur))
            fprintf(out, "  >> change: %s -> %s (walk %d min)\n", g->st[r->path[i - 1]].line,
                    g->st[cur].line, link_mins(g, r->path[i - 1], cur));
        fprintf(out, "  %-28s %s\n", g->st[cur].name, g->st[cur].line);
    }
    fprintf(out, "\nStops: %d  Time: %d min  Fare: Rs %d\n", r->stops, r->mins, r->fare);
}
