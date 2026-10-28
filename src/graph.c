#include <ctype.h>
#include <stdlib.h>
#include <string.h>
#include "metro.h"

void net_init(Net *g)
{
    g->st = NULL;
    g->n = g->cap = 0;
}

void net_free(Net *g)
{
    for (int i = 0; i < g->n; i++)
        free(g->st[i].adj);
    free(g->st);
    net_init(g);
}

int net_find_id(const Net *g, int id)
{
    for (int i = 0; i < g->n; i++)
        if (g->st[i].id == id)
            return i;
    return -1;
}

int net_add_station(Net *g, int id, const char *name, const char *line)
{
    if (id <= 0 || !*name || !*line || strchr(name, ',') || strchr(line, ','))
        return -1;
    if (strlen(name) > NAME_MAX_LEN || strlen(line) > LINE_MAX_LEN)
        return -1;
    if (net_find_id(g, id) >= 0)
        return -2;
    if (g->n == g->cap) {
        int cap = g->cap ? g->cap * 2 : 64;
        Station *p = realloc(g->st, cap * sizeof *p);
        if (!p)
            return -1;
        g->st = p;
        g->cap = cap;
    }
    Station *s = &g->st[g->n];
    s->id = id;
    strcpy(s->name, name);
    strcpy(s->line, line);
    s->adj = NULL;
    s->nadj = s->capadj = 0;
    return g->n++;
}

static int push_link(Station *s, int to, int mins)
{
    if (s->nadj == s->capadj) {
        int cap = s->capadj ? s->capadj * 2 : 4;
        Link *p = realloc(s->adj, cap * sizeof *p);
        if (!p)
            return -1;
        s->adj = p;
        s->capadj = cap;
    }
    s->adj[s->nadj].to = to;
    s->adj[s->nadj].mins = mins;
    s->nadj++;
    return 0;
}

int net_has_link(const Net *g, int a, int b)
{
    for (int i = 0; i < g->st[a].nadj; i++)
        if (g->st[a].adj[i].to == b)
            return 1;
    return 0;
}

/* returns 0 ok, -1 unknown id, -2 bad minutes, -3 duplicate */
int net_add_link(Net *g, int from_id, int to_id, int mins)
{
    int a = net_find_id(g, from_id), b = net_find_id(g, to_id);
    if (a < 0 || b < 0)
        return -1;
    if (mins <= 0 || a == b)
        return -2;
    if (net_has_link(g, a, b))
        return -3;
    if (push_link(&g->st[a], b, mins) || push_link(&g->st[b], a, mins))
        return -1;
    return 0;
}

int str_ieq(const char *a, const char *b)
{
    for (; *a && *b; a++, b++)
        if (tolower((unsigned char)*a) != tolower((unsigned char)*b))
            return 0;
    return *a == *b;
}

static int icontains(const char *hay, const char *needle)
{
    size_t n = strlen(needle);
    if (!n)
        return 0;
    for (; *hay; hay++) {
        size_t i = 0;
        while (i < n && hay[i] &&
               tolower((unsigned char)hay[i]) == tolower((unsigned char)needle[i]))
            i++;
        if (i == n)
            return 1;
    }
    return 0;
}

int net_match(const Net *g, const char *text, int *out, int max)
{
    int k = 0;
    /* an exact name wins outright, so "Sector 15" doesn't also pull in Sector 150 */
    for (int i = 0; i < g->n && k < max; i++)
        if (str_ieq(g->st[i].name, text))
            out[k++] = i;
    if (k)
        return k;
    for (int i = 0; i < g->n && k < max; i++)
        if (icontains(g->st[i].name, text))
            out[k++] = i;
    return k;
}

int net_has_line(const Net *g, const char *line)
{
    for (int i = 0; i < g->n; i++)
        if (str_ieq(g->st[i].line, line))
            return 1;
    return 0;
}

static int same_line_deg(const Net *g, int i)
{
    int d = 0;
    for (int j = 0; j < g->st[i].nadj; j++)
        if (!strcmp(g->st[g->st[i].adj[j].to].line, g->st[i].line))
            d++;
    return d;
}

/* Walks the line from one end. Fine for straight lines; a branch would stop at the fork. */
int line_order(const Net *g, const char *line, int *out, int max)
{
    int start = -1;
    for (int i = 0; i < g->n; i++) {
        if (!str_ieq(g->st[i].line, line))
            continue;
        if (start < 0)
            start = i;
        if (same_line_deg(g, i) <= 1) {
            start = i;
            break;
        }
    }
    if (start < 0)
        return 0;

    int k = 0, prev = -1, cur = start;
    while (cur >= 0 && k < max) {
        out[k++] = cur;
        int next = -1;
        for (int j = 0; j < g->st[cur].nadj; j++) {
            int t = g->st[cur].adj[j].to;
            if (t != prev && !strcmp(g->st[t].line, g->st[cur].line)) {
                next = t;
                break;
            }
        }
        prev = cur;
        cur = next;
        if (cur == start)
            break;
    }
    return k;
}
