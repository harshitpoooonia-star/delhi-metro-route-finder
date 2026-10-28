#include <stdarg.h>
#include <stdlib.h>
#include <string.h>
#include "metro.h"

#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#define EXPORT EMSCRIPTEN_KEEPALIVE
#else
#define EXPORT
#endif

#define MAXG 16

static Net net;
static int loaded;

typedef struct {
    char *s;
    size_t len, cap;
} Buf;

static Buf out;

static void put(const char *s, size_t n)
{
    if (out.len + n + 1 > out.cap) {
        size_t cap = out.cap ? out.cap : 1024;
        while (cap < out.len + n + 1)
            cap *= 2;
        char *p = realloc(out.s, cap);
        if (!p)
            return;
        out.s = p;
        out.cap = cap;
    }
    memcpy(out.s + out.len, s, n);
    out.len += n;
    out.s[out.len] = 0;
}

static void raw(const char *s)
{
    put(s, strlen(s));
}

static void fmt(const char *f, ...)
{
    char tmp[64];
    va_list ap;
    va_start(ap, f);
    int n = vsnprintf(tmp, sizeof tmp, f, ap);
    va_end(ap);
    if (n > 0)
        put(tmp, (size_t)n < sizeof tmp ? (size_t)n : sizeof tmp - 1);
}

static void str(const char *s)
{
    raw("\"");
    for (; *s; s++) {
        if (*s == '"' || *s == '\\') {
            char e[2] = {'\\', *s};
            put(e, 2);
        } else if ((unsigned char)*s < 0x20) {
            fmt("\\u%04x", *s);
        } else {
            put(s, 1);
        }
    }
    raw("\"");
}

static void begin(void)
{
    out.len = 0;
    put("", 0);
}

static const char *fail(const char *code, const char *msg)
{
    begin();
    raw("{\"ok\":false,\"error\":{\"code\":");
    str(code);
    raw(",\"message\":");
    str(msg);
    raw("}}");
    return out.s;
}

static int is_walk(int a, int b)
{
    return strcmp(net.st[a].line, net.st[b].line) != 0;
}

static int walk_mins(int a, int b)
{
    for (int i = 0; i < net.st[a].nadj; i++)
        if (net.st[a].adj[i].to == b)
            return net.st[a].adj[i].mins;
    return 0;
}

/* every copy of a station (one per line) that has this exact name */
int station_group(const Net *g, const char *name, int *grp, int max)
{
    int k = 0;
    for (int i = 0; i < g->n && k < max; i++)
        if (str_ieq(g->st[i].name, name))
            grp[k++] = i;
    return k;
}

EXPORT int api_load(const char *dir)
{
    char sp[512], lp[512];
    snprintf(sp, sizeof sp, "%s/stations.txt", dir);
    snprintf(lp, sizeof lp, "%s/links.txt", dir);
    if (loaded)
        net_free(&net);
    net_init(&net);
    loaded = 1;
    if (load_stations(&net, sp) < 0 || load_links(&net, lp) < 0)
        return -1;
    return net.n;
}

EXPORT void api_free(void)
{
    if (loaded)
        net_free(&net);
    loaded = 0;
    free(out.s);
    out.s = NULL;
    out.len = out.cap = 0;
}

/* exact name first; otherwise the best search hit, so "cp" or "rajiv chok" still routes */
static int resolve(const char *text, int *grp)
{
    int n = station_group(&net, text, grp, MAXG);
    if (n)
        return n;
    int top;
    if (net_search(&net, text, &top, 1) != 1)
        return 0;
    return station_group(&net, net.st[top].name, grp, MAXG);
}

/* the terminal a train from a to b on this line is heading for */
static int towards(int a, int b, int *ord, int n)
{
    int ia = -1, ib = -1;
    for (int i = 0; i < n; i++) {
        if (!strcmp(net.st[ord[i]].name, net.st[a].name))
            ia = i;
        if (!strcmp(net.st[ord[i]].name, net.st[b].name))
            ib = i;
    }
    if (ia < 0 || ib < 0)
        return -1;
    return ib > ia ? ord[n - 1] : ord[0];
}

static void option(const char *kind, const Route *r, int *ord)
{
    int changes = 0;
    for (int i = 1; i < r->len; i++)
        if (is_walk(r->path[i - 1], r->path[i]))
            changes++;
    raw("{\"kind\":");
    str(kind);
    fmt(",\"stops\":%d,\"minutes\":%d,\"fare\":%d,\"interchanges\":%d", r->stops, r->mins,
        r->fare, changes);

    /* legs split at walk links; each change records both ends so a walkway
       like Noida Sector 51 -> 52 can name both stations */
    raw(",\"legs\":[");
    int start = 0;
    for (int i = 1; i <= r->len; i++) {
        if (i < r->len && !is_walk(r->path[i - 1], r->path[i]))
            continue;
        int a = r->path[start], b = r->path[i - 1];
        if (start)
            raw(",");
        raw("{\"line\":");
        str(net.st[a].line);
        int n = line_order(&net, net.st[a].line, ord, net.n);
        int t = towards(a, b, ord, n);
        raw(",\"towards\":");
        str(t >= 0 ? net.st[t].name : "");
        raw(",\"stations\":[");
        for (int k = start; k < i; k++) {
            if (k > start)
                raw(",");
            str(net.st[r->path[k]].name);
        }
        raw("]}");
        start = i;
    }
    raw("],\"changes\":[");
    int first = 1;
    for (int i = 1; i < r->len; i++) {
        int p = r->path[i - 1], c = r->path[i];
        if (!is_walk(p, c))
            continue;
        raw(first ? "{" : ",{");
        first = 0;
        raw("\"at\":");
        str(net.st[p].name);
        raw(",\"toStation\":");
        str(net.st[c].name);
        raw(",\"fromLine\":");
        str(net.st[p].line);
        raw(",\"toLine\":");
        str(net.st[c].line);
        fmt(",\"walk\":%d}", walk_mins(p, c));
    }
    raw("]}");
}

static int same_path(const Route *x, const Route *y)
{
    return x->len == y->len && !memcmp(x->path, y->path, x->len * sizeof *x->path);
}

/* the fastest route, plus the one with the fewest changes when that's a different trip */
EXPORT const char *api_route(const char *from, const char *to)
{
    int a[MAXG], b[MAXG];
    int na = resolve(from, a), nb = resolve(to, b);
    if (!na)
        return fail("UNKNOWN_STATION", from);
    if (!nb)
        return fail("UNKNOWN_STATION", to);
    if (!strcmp(net.st[a[0]].name, net.st[b[0]].name))
        return fail("SAME_STATION", "start and end are the same");

    Route fast = {0}, few = {0};
    if (find_route_ex(&net, a, na, b, nb, 0, &fast) != 0)
        return fail("NO_ROUTE", "no route between these stations");
    /* bigger than any trip's minutes, so fewer changes always wins */
    int have_few = find_route_ex(&net, a, na, b, nb, 1000, &few) == 0 && !same_path(&fast, &few);

    int *ord = malloc(net.n * sizeof *ord);
    if (!ord) {
        route_free(&fast);
        route_free(&few);
        return fail("NO_MEMORY", "out of memory");
    }
    begin();
    raw("{\"ok\":true,\"from\":");
    str(net.st[fast.path[0]].name);
    raw(",\"to\":");
    str(net.st[fast.path[fast.len - 1]].name);
    raw(",\"options\":[");
    option("FASTEST", &fast, ord);
    if (have_few) {
        raw(",");
        option("FEWEST_CHANGES", &few, ord);
    }
    raw("]}");
    free(ord);
    route_free(&fast);
    route_free(&few);
    return out.s;
}

/* one entry per station name, with all its lines, best match first */
EXPORT const char *api_search(const char *text)
{
    int m[MAXG * 4];
    int n = net_search(&net, text, m, MAXG * 4);
    begin();
    raw("[");
    int k = 0;
    for (int i = 0; i < n; i++) {
        int dup = 0;
        for (int j = 0; j < i; j++)
            if (!strcmp(net.st[m[j]].name, net.st[m[i]].name))
                dup = 1;
        if (dup)
            continue;
        raw(k++ ? ",{\"name\":" : "{\"name\":");
        str(net.st[m[i]].name);
        raw(",\"lines\":[");
        int grp[MAXG], ng = station_group(&net, net.st[m[i]].name, grp, MAXG);
        for (int j = 0; j < ng; j++) {
            if (j)
                raw(",");
            str(net.st[grp[j]].line);
        }
        raw("]}");
    }
    raw("]");
    return out.s;
}

EXPORT const char *api_lines(void)
{
    begin();
    raw("[");
    int k = 0;
    for (int i = 0; i < net.n; i++) {
        int seen = 0;
        for (int j = 0; j < i; j++)
            if (!strcmp(net.st[j].line, net.st[i].line))
                seen = 1;
        if (seen)
            continue;
        if (k++)
            raw(",");
        str(net.st[i].line);
    }
    raw("]");
    return out.s;
}

EXPORT const char *api_line(const char *line)
{
    if (!net_has_line(&net, line))
        return fail("UNKNOWN_LINE", line);
    int *ord = malloc(net.n * sizeof *ord);
    if (!ord)
        return fail("NO_MEMORY", "out of memory");
    int n = line_order(&net, line, ord, net.n);
    begin();
    raw("[");
    for (int i = 0; i < n; i++) {
        if (i)
            raw(",");
        str(net.st[ord[i]].name);
    }
    raw("]");
    free(ord);
    return out.s;
}
