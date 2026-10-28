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

EXPORT const char *api_route(const char *from, const char *to)
{
    int a[MAXG], b[MAXG];
    int na = station_group(&net, from, a, MAXG), nb = station_group(&net, to, b, MAXG);
    if (!na)
        return fail("UNKNOWN_STATION", from);
    if (!nb)
        return fail("UNKNOWN_STATION", to);
    if (str_ieq(from, to))
        return fail("SAME_STATION", "start and end are the same");

    Route r = {0};
    if (find_route_multi(&net, a, na, b, nb, &r) != 0)
        return fail("NO_ROUTE", "no route between these stations");

    begin();
    raw("{\"ok\":true,\"from\":");
    str(net.st[r.path[0]].name);
    raw(",\"to\":");
    str(net.st[r.path[r.len - 1]].name);
    fmt(",\"stops\":%d,\"minutes\":%d,\"fare\":%d", r.stops, r.mins, r.fare);

    /* legs split at walk links; each change records both ends so a walkway
       like Noida Sector 51 -> 52 can name both stations */
    raw(",\"legs\":[{\"line\":");
    str(net.st[r.path[0]].line);
    raw(",\"stations\":[");
    str(net.st[r.path[0]].name);
    int changes = 0;
    for (int i = 1; i < r.len; i++) {
        int p = r.path[i - 1], c = r.path[i];
        if (is_walk(p, c)) {
            raw("]},{\"line\":");
            str(net.st[c].line);
            raw(",\"stations\":[");
            str(net.st[c].name);
            changes++;
        } else {
            raw(",");
            str(net.st[c].name);
        }
    }
    raw("]}],\"changes\":[");
    int first = 1;
    for (int i = 1; i < r.len; i++) {
        int p = r.path[i - 1], c = r.path[i];
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
    fmt("],\"interchanges\":%d}", changes);
    route_free(&r);
    return out.s;
}

/* one entry per station name, with all its lines */
EXPORT const char *api_search(const char *text)
{
    int m[MAXG * 4];
    int n = net_match(&net, text, m, MAXG * 4);
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
