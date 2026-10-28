#include <assert.h>
#include <stdio.h>
#include <string.h>
#include "metro.h"

#define FIX "tests/data"

static int has(const char *s, const char *part)
{
    if (!strstr(s, part)) {
        fprintf(stderr, "missing %s in\n%s\n", part, s);
        return 0;
    }
    return 1;
}

static void test_multi_source(void)
{
    Net g;
    net_init(&g);
    assert(load_stations(&g, FIX "/stations.txt") == 8);
    assert(load_links(&g, FIX "/links.txt") == 6);

    /* Charlie exists on Red and Green; starting from both copies must not pay the walk */
    int src[4], dst[4];
    int ns = station_group(&g, "charlie", src, 4), nd = station_group(&g, "Foxtrot", dst, 4);
    assert(ns == 2 && nd == 1);
    Route r = {0};
    assert(find_route_multi(&g, src, ns, dst, nd, &r) == 0);
    assert(r.mins == 3 && r.stops == 1 && r.len == 2);
    route_free(&r);

    /* any shared station means same place */
    assert(find_route_multi(&g, src, ns, src + 1, 1, &r) == -2);
    net_free(&g);
}

static void test_route_json(void)
{
    assert(api_load(FIX) == 8);
    const char *s = api_route("Alpha", "Foxtrot");
    assert(has(s, "\"ok\":true"));
    assert(has(s, "\"minutes\":12"));
    assert(has(s, "\"stops\":3"));
    assert(has(s, "\"interchanges\":1"));
    assert(has(s, "{\"at\":\"Charlie\",\"toStation\":\"Charlie\",\"fromLine\":\"Red\",\"toLine\":\"Green\",\"walk\":5}"));
    assert(has(s, "\"legs\":[{\"line\":\"Red\",\"stations\":[\"Alpha\",\"Bravo\",\"Charlie\"]},"
                  "{\"line\":\"Green\",\"stations\":[\"Charlie\",\"Foxtrot\"]}]"));

    assert(has(api_route("Alpha", "alpha"), "SAME_STATION"));
    assert(has(api_route("Charlie", "charlie"), "SAME_STATION"));
    assert(has(api_route("Alpha", "Lonely"), "NO_ROUTE"));
    assert(has(api_route("Alpha", "Zulu"), "\"code\":\"UNKNOWN_STATION\",\"message\":\"Zulu\""));
    api_free();
}

static void test_search_json(void)
{
    assert(api_load(FIX) == 8);
    assert(!strcmp(api_search("char"), "[{\"name\":\"Charlie\",\"lines\":[\"Red\",\"Green\"]}]"));
    assert(!strcmp(api_search("zzz"), "[]"));
    assert(!strcmp(api_lines(), "[\"Red\",\"Green\",\"Grey\"]"));
    const char *red = api_line("red");
    assert(!strcmp(red, "[\"Alpha\",\"Bravo\",\"Charlie\",\"Delta\"]") ||
           !strcmp(red, "[\"Delta\",\"Charlie\",\"Bravo\",\"Alpha\"]"));
    assert(has(api_line("purple"), "UNKNOWN_LINE"));
    api_free();
}

static void test_escape(void)
{
    assert(api_load(FIX) == 8);
    /* names can't hold commas, but quotes must still come out as valid JSON */
    assert(has(api_route("Al\"pha", "Delta"), "\"message\":\"Al\\\"pha\""));
    api_free();
}

/* the real sample network: the README's own example */
static void test_sample(void)
{
    assert(api_load("data") > 100);
    const char *s = api_route("Knowledge Park II", "Rajiv Chowk");
    assert(has(s, "\"ok\":true"));
    assert(has(s, "\"fromLine\":\"Aqua\",\"toLine\":\"Blue\""));
    assert(has(s, "\"interchanges\":1"));
    /* Hauz Khas sits on Yellow and Magenta; either copy is a valid end */
    assert(has(api_route("Rajiv Chowk", "Hauz Khas"), "\"interchanges\":0"));
    api_free();
}

int main(void)
{
    test_multi_source();
    test_route_json();
    test_search_json();
    test_escape();
    test_sample();
    puts("api tests passed");
    return 0;
}
