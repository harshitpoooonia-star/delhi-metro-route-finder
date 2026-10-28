#include <stdio.h>
#include "metro.h"

int main(int argc, char **argv)
{
    const char *dir = argc > 1 ? argv[1] : "data";
    char sp[512], lp[512];
    snprintf(sp, sizeof sp, "%s/stations.txt", dir);
    snprintf(lp, sizeof lp, "%s/links.txt", dir);

    Net g;
    net_init(&g);
    if (load_stations(&g, sp) < 0 || load_links(&g, lp) < 0) {
        net_free(&g);
        return 1;
    }
    printf("Loaded %d stations.\n", g.n);
    run_menu(&g, dir);
    net_free(&g);
    return 0;
}
