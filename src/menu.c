#include <stdlib.h>
#include <string.h>
#include "metro.h"

#define MAXM 64

/* 0 on EOF so the caller can bail out instead of looping on a closed stdin */
static int ask(const char *prompt, char *buf, int size)
{
    printf("%s", prompt);
    fflush(stdout);
    if (!fgets(buf, size, stdin))
        return 0;
    buf[strcspn(buf, "\r\n")] = 0;
    return 1;
}

static int ask_int(const char *prompt, int *v)
{
    char buf[64], *end;
    for (;;) {
        if (!ask(prompt, buf, sizeof buf))
            return 0;
        long x = strtol(buf, &end, 10);
        if (end != buf && !*end && x >= 0 && x < INF) {
            *v = (int)x;
            return 1;
        }
        puts("enter a number");
    }
}

/* Interchanges like Rajiv Chowk exist once per line. Grouping by name lets the rider
   pick the station, and route search tries every line's copy. */
static int pick_station(const Net *g, const char *prompt, int *grp)
{
    char buf[128];
    int m[MAXM];
    for (;;) {
        if (!ask(prompt, buf, sizeof buf))
            return -1;
        if (!*buf)
            continue;
        int n = net_match(g, buf, m, MAXM);
        if (!n) {
            printf("no such station: %s\n", buf);
            continue;
        }
        int names[MAXM] = {0}, nn = 0;
        for (int i = 0; i < n; i++) {
            int dup = 0;
            for (int j = 0; j < nn; j++)
                if (!strcmp(g->st[names[j]].name, g->st[m[i]].name))
                    dup = 1;
            if (!dup)
                names[nn++] = m[i];
        }
        int pick = names[0];
        if (nn > 1) {
            for (int i = 0; i < nn; i++)
                printf("  %d. %s\n", i + 1, g->st[names[i]].name);
            int c;
            if (!ask_int("Pick one: ", &c))
                return -1;
            if (c < 1 || c > nn) {
                puts("not in the list");
                continue;
            }
            pick = names[c - 1];
        }
        int k = 0;
        for (int i = 0; i < g->n; i++)
            if (!strcmp(g->st[i].name, g->st[pick].name))
                grp[k++] = i;
        return k;
    }
}

static void do_route(const Net *g)
{
    int a[MAXM], b[MAXM];
    int na = pick_station(g, "From: ", a);
    if (na < 0)
        return;
    int nb = pick_station(g, "To: ", b);
    if (nb < 0)
        return;
    if (!strcmp(g->st[a[0]].name, g->st[b[0]].name)) {
        puts("start and end are the same");
        return;
    }
    Route best = {0}, r;
    best.mins = INF;
    for (int i = 0; i < na; i++)
        for (int j = 0; j < nb; j++)
            if (find_route(g, a[i], b[j], &r) == 0) {
                if (r.mins < best.mins) {
                    route_free(&best);
                    best = r;
                } else {
                    route_free(&r);
                }
            }
    if (!best.path) {
        printf("no route between %s and %s\n", g->st[a[0]].name, g->st[b[0]].name);
        return;
    }
    print_route(g, &best, stdout);
    route_free(&best);
}

static void do_search(const Net *g)
{
    char buf[128];
    int m[MAXM];
    if (!ask("Search: ", buf, sizeof buf))
        return;
    int n = net_match(g, buf, m, MAXM);
    if (!n) {
        printf("no such station: %s\n", buf);
        return;
    }
    for (int i = 0; i < n; i++)
        printf("  %-28s %s\n", g->st[m[i]].name, g->st[m[i]].line);
    if (n == MAXM)
        puts("  (more matches, type more of the name)");
}

static void do_line(const Net *g)
{
    char buf[64];
    if (!ask("Line: ", buf, sizeof buf))
        return;
    if (!net_has_line(g, buf)) {
        printf("unknown line: %s\n", buf);
        return;
    }
    int *out = malloc(g->n * sizeof *out);
    if (!out)
        return;
    int n = line_order(g, buf, out, g->n);
    for (int i = 0; i < n; i++)
        printf("  %2d. %s\n", i + 1, g->st[out[i]].name);
    free(out);
}

static void save(const Net *g, const char *dir)
{
    char sp[512], lp[512];
    snprintf(sp, sizeof sp, "%s/stations.txt", dir);
    snprintf(lp, sizeof lp, "%s/links.txt", dir);
    if (save_stations(g, sp) || save_links(g, lp))
        puts("couldn't save the data files");
    else
        puts("saved");
}

static void do_add_station(Net *g, const char *dir)
{
    int id;
    char name[128], line[64];
    if (!ask_int("Id: ", &id) || !ask("Name: ", name, sizeof name) || !ask("Line: ", line, sizeof line))
        return;
    int r = net_add_station(g, id, name, line);
    if (r == -2)
        printf("id %d already used\n", id);
    else if (r < 0)
        puts("bad station (empty, too long, or has a comma)");
    else
        save(g, dir);
}

static void do_add_link(Net *g, const char *dir)
{
    int a, b, m;
    if (!ask_int("From id: ", &a) || !ask_int("To id: ", &b) || !ask_int("Minutes: ", &m))
        return;
    int r = net_add_link(g, a, b, m);
    if (r == -1)
        printf("no station with id %d\n", net_find_id(g, a) < 0 ? a : b);
    else if (r == -2)
        puts("minutes must be above 0 and the stations different");
    else if (r == -3)
        puts("those stations are already linked");
    else
        save(g, dir);
}

void run_menu(Net *g, const char *dir)
{
    for (;;) {
        puts("\n1. Find route\n2. Search station\n3. Show line\n4. Add station\n5. Add link\n0. Exit");
        int c;
        if (!ask_int("> ", &c) || c == 0)
            return;
        switch (c) {
        case 1: do_route(g); break;
        case 2: do_search(g); break;
        case 3: do_line(g); break;
        case 4: do_add_station(g, dir); break;
        case 5: do_add_link(g, dir); break;
        default: puts("pick 0 to 5");
        }
    }
}
