#include <stdlib.h>
#include <string.h>
#include "metro.h"

static void chomp(char *s)
{
    s[strcspn(s, "\r\n")] = 0;
}

static char *trim(char *s)
{
    while (*s == ' ' || *s == '\t')
        s++;
    char *e = s + strlen(s);
    while (e > s && (e[-1] == ' ' || e[-1] == '\t'))
        *--e = 0;
    return s;
}

static int parse_int(const char *s, int *v)
{
    char *end;
    long x = strtol(s, &end, 10);
    while (*end == ' ' || *end == '\t')
        end++;
    if (end == s || *end || x <= 0 || x > INF)
        return -1;
    *v = (int)x;
    return 0;
}

/* returns stations loaded, or -1 if the file can't be opened */
int load_stations(Net *g, const char *path)
{
    FILE *f = fopen(path, "r");
    if (!f) {
        fprintf(stderr, "can't open %s\n", path);
        return -1;
    }
    char buf[256];
    int ln = 0, n = 0;
    while (fgets(buf, sizeof buf, f)) {
        ln++;
        chomp(buf);
        if (ln == 1 || !*trim(buf))
            continue;
        char *f1 = strtok(buf, ","), *f2 = strtok(NULL, ","), *f3 = strtok(NULL, ","),
             *extra = strtok(NULL, ",");
        int id;
        if (!f3 || extra || parse_int(trim(f1), &id) ||
            net_add_station(g, id, trim(f2), trim(f3)) < 0) {
            fprintf(stderr, "%s:%d: skipped\n", path, ln);
            continue;
        }
        n++;
    }
    fclose(f);
    return n;
}

int load_links(Net *g, const char *path)
{
    FILE *f = fopen(path, "r");
    if (!f) {
        fprintf(stderr, "can't open %s\n", path);
        return -1;
    }
    char buf[256];
    int ln = 0, n = 0;
    while (fgets(buf, sizeof buf, f)) {
        ln++;
        chomp(buf);
        if (ln == 1 || !*trim(buf))
            continue;
        char *f1 = strtok(buf, ","), *f2 = strtok(NULL, ","), *f3 = strtok(NULL, ","),
             *extra = strtok(NULL, ",");
        int a, b, m;
        if (!f3 || extra || parse_int(trim(f1), &a) || parse_int(trim(f2), &b) ||
            parse_int(trim(f3), &m) || net_add_link(g, a, b, m)) {
            fprintf(stderr, "%s:%d: skipped\n", path, ln);
            continue;
        }
        n++;
    }
    fclose(f);
    return n;
}

int save_stations(const Net *g, const char *path)
{
    FILE *f = fopen(path, "w");
    if (!f)
        return -1;
    fprintf(f, "id,name,line\n");
    for (int i = 0; i < g->n; i++)
        fprintf(f, "%d,%s,%s\n", g->st[i].id, g->st[i].name, g->st[i].line);
    return fclose(f);
}

int save_links(const Net *g, const char *path)
{
    FILE *f = fopen(path, "w");
    if (!f)
        return -1;
    fprintf(f, "from,to,minutes\n");
    /* each link is stored on both ends; write it from the lower index only */
    for (int i = 0; i < g->n; i++)
        for (int j = 0; j < g->st[i].nadj; j++) {
            int t = g->st[i].adj[j].to;
            if (i < t)
                fprintf(f, "%d,%d,%d\n", g->st[i].id, g->st[t].id, g->st[i].adj[j].mins);
        }
    return fclose(f);
}
