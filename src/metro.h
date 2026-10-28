#ifndef METRO_H
#define METRO_H

#include <stdio.h>

#define NAME_MAX_LEN 63
#define LINE_MAX_LEN 15
#define INF 1000000000

typedef struct {
    int to;   /* station index, not file id */
    int mins;
} Link;

typedef struct {
    int id;
    char name[NAME_MAX_LEN + 1];
    char line[LINE_MAX_LEN + 1];
    Link *adj;
    int nadj, capadj;
} Station;

typedef struct {
    Station *st;
    int n, cap;
} Net;

typedef struct {
    int *path;
    int len;
    int mins;
    int stops;
    int fare;
} Route;

/* graph.c */
void net_init(Net *g);
void net_free(Net *g);
int net_find_id(const Net *g, int id);
int net_add_station(Net *g, int id, const char *name, const char *line);
int net_add_link(Net *g, int from_id, int to_id, int mins);
int net_has_link(const Net *g, int a, int b);
int net_match(const Net *g, const char *text, int *out, int max);
int net_has_line(const Net *g, const char *line);
int line_order(const Net *g, const char *line, int *out, int max);
int str_ieq(const char *a, const char *b);

/* route.c */
int find_route(const Net *g, int src, int dst, Route *r);
int find_route_multi(const Net *g, const int *src, int ns, const int *dst, int nd, Route *r);
void route_free(Route *r);
int fare_for(int stops);
void print_route(const Net *g, const Route *r, FILE *out);

/* fileio.c */
int load_stations(Net *g, const char *path);
int load_links(Net *g, const char *path);
int save_stations(const Net *g, const char *path);
int save_links(const Net *g, const char *path);

/* api.c: JSON in strings, for the web build. Returned strings live until the next call. */
int api_load(const char *dir);
void api_free(void);
const char *api_route(const char *from, const char *to);
const char *api_search(const char *text);
const char *api_lines(void);
const char *api_line(const char *line);
int station_group(const Net *g, const char *name, int *out, int max);

/* menu.c */
void run_menu(Net *g, const char *dir);

#endif
