#include <assert.h>
#include <stdio.h>
#include <string.h>
#include "metro.h"

#define FIX "tests/data/"

static int idx(const Net *g, int id)
{
    int i = net_find_id(g, id);
    assert(i >= 0);
    return i;
}

static Net fixture(void)
{
    Net g;
    net_init(&g);
    assert(load_stations(&g, FIX "stations.txt") == 8);
    assert(load_links(&g, FIX "links.txt") == 6);
    return g;
}

static void test_graph(void)
{
    Net g;
    net_init(&g);
    assert(net_add_station(&g, 1, "A", "X") == 0);
    assert(net_add_station(&g, 1, "B", "X") == -2);
    assert(net_add_station(&g, 2, "has,comma", "X") == -1);
    assert(net_add_station(&g, 3, "", "X") == -1);
    assert(net_add_station(&g, 2, "B", "X") == 1);
    assert(net_add_link(&g, 1, 2, 3) == 0);
    assert(net_has_link(&g, 0, 1) && net_has_link(&g, 1, 0));
    assert(net_add_link(&g, 1, 2, 3) == -3);
    assert(net_add_link(&g, 1, 9, 3) == -1);
    assert(net_add_link(&g, 1, 2, 0) == -2);
    net_free(&g);
}

static void test_fileio(void)
{
    Net g = fixture();
    assert(save_stations(&g, "tmp_st.txt") == 0);
    assert(save_links(&g, "tmp_ln.txt") == 0);

    Net h;
    net_init(&h);
    assert(load_stations(&h, "tmp_st.txt") == g.n);
    assert(load_links(&h, "tmp_ln.txt") == 6);
    for (int i = 0; i < g.n; i++) {
        assert(h.st[i].id == g.st[i].id);
        assert(!strcmp(h.st[i].name, g.st[i].name));
        assert(h.st[i].nadj == g.st[i].nadj);
    }
    assert(load_stations(&h, "no_such_file.txt") == -1);
    remove("tmp_st.txt");
    remove("tmp_ln.txt");
    net_free(&g);
    net_free(&h);
}

static int changes(const Net *g, const Route *r)
{
    int c = 0;
    for (int i = 1; i < r->len; i++)
        if (strcmp(g->st[r->path[i]].line, g->st[r->path[i - 1]].line))
            c++;
    return c;
}

static void test_route(void)
{
    Net g = fixture();
    Route r;

    assert(find_route(&g, idx(&g, 1), idx(&g, 4), &r) == 0);
    assert(r.len == 4 && r.mins == 6 && r.stops == 3 && changes(&g, &r) == 0);
    route_free(&r);

    /* Alpha to Foxtrot: 2+2 on Red, 5 walk, 3 on Green */
    assert(find_route(&g, idx(&g, 1), idx(&g, 12), &r) == 0);
    assert(r.mins == 12 && r.stops == 3 && changes(&g, &r) == 1);
    assert(r.path[0] == idx(&g, 1) && r.path[r.len - 1] == idx(&g, 12));
    route_free(&r);

    assert(find_route(&g, idx(&g, 1), idx(&g, 99), &r) == -1);
    assert(find_route(&g, idx(&g, 1), idx(&g, 1), &r) == -2);

    /* a direct but slow link must lose to the longer, faster path */
    assert(net_add_link(&g, 1, 4, 20) == 0);
    assert(find_route(&g, idx(&g, 1), idx(&g, 4), &r) == 0);
    assert(r.mins == 6 && r.len == 4);
    route_free(&r);
    net_free(&g);
}

static void test_fare(void)
{
    int stops[] = {0, 2, 3, 5, 6, 12, 13, 21, 22, 32, 33, 80};
    int want[] = {11, 11, 21, 21, 32, 32, 43, 43, 54, 54, 64, 64};
    for (size_t i = 0; i < sizeof stops / sizeof *stops; i++)
        assert(fare_for(stops[i]) == want[i]);
}

static void test_search(void)
{
    Net g = fixture();
    int out[16];
    assert(net_match(&g, "char", out, 16) == 2);
    assert(net_match(&g, "ALPHA", out, 16) == 1 && out[0] == idx(&g, 1));
    assert(net_match(&g, "zzz", out, 16) == 0);
    assert(net_match(&g, "", out, 16) == 0);
    net_free(&g);
}

static void test_line(void)
{
    Net g = fixture();
    int out[16];
    int n = line_order(&g, "red", out, 16);
    assert(n == 4);
    /* either end is fine, but it has to run end to end */
    int fwd = g.st[out[0]].id == 1;
    for (int i = 0; i < 4; i++)
        assert(g.st[out[i]].id == (fwd ? i + 1 : 4 - i));
    assert(line_order(&g, "purple", out, 16) == 0);
    assert(!net_has_line(&g, "purple") && net_has_line(&g, "GREEN"));
    net_free(&g);
}

int main(void)
{
    test_graph();
    test_fileio();
    test_route();
    test_fare();
    test_search();
    test_line();
    puts("all tests passed");
    return 0;
}
