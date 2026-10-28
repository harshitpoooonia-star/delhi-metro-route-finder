#include <ctype.h>
#include <stdlib.h>
#include <string.h>
#include "metro.h"

#define QMAX 64

/* names people actually type that don't share text with the real name */
static const char *aliases[][2] = {
    {"cp", "Rajiv Chowk"},
    {"connaught place", "Rajiv Chowk"},
    {"kashmiri gate", "Kashmere Gate"},
    {"isbt", "Kashmere Gate"},
    {"qutub minar", "Qutab Minar"},
    {"ina", "Dilli Haat INA"},
    {"t1", "Terminal 1 IGI Airport"},
    {"airport", "Terminal 1 IGI Airport"},
    {"igi", "Terminal 1 IGI Airport"},
    {"du", "Vishwavidyalaya"},
    {"delhi university", "Vishwavidyalaya"},
    {"north campus", "Vishwavidyalaya"},
    {"race course", "Lok Kalyan Marg"},
    {"gurgaon", "Millennium City Centre Gurugram"},
    {"huda city centre", "Millennium City Centre Gurugram"},
    {"pragati maidan", "Supreme Court"},
};

/* lowercase, punctuation to spaces, single spaces, "sec" -> "sector" */
static void normalise(const char *in, char *out, size_t size)
{
    char tmp[QMAX];
    size_t k = 0;
    int space = 1;
    for (; *in && k < sizeof tmp - 1; in++) {
        unsigned char c = (unsigned char)*in;
        if (isalnum(c)) {
            tmp[k++] = (char)tolower(c);
            space = 0;
        } else if (!space) {
            tmp[k++] = ' ';
            space = 1;
        }
    }
    while (k && tmp[k - 1] == ' ')
        k--;
    tmp[k] = 0;

    size_t o = 0;
    for (char *w = strtok(tmp, " "); w; w = strtok(NULL, " ")) {
        const char *word = !strcmp(w, "sec") || !strcmp(w, "sect") ? "sector" : w;
        size_t n = strlen(word);
        if (o + n + 2 > size)
            break;
        if (o)
            out[o++] = ' ';
        memcpy(out + o, word, n);
        o += n;
    }
    out[o] = 0;
}

static int min3(int a, int b, int c)
{
    int m = a < b ? a : b;
    return m < c ? m : c;
}

/* edit distance between a and the closest prefix of b, so "rajiv chok" is 1 away
   from "rajiv chowk" and a half-typed "kashmiri ga" still lands */
static int prefix_dist(const char *a, const char *b)
{
    int la = (int)strlen(a), lb = (int)strlen(b);
    int prev[QMAX + 1], cur[QMAX + 1];
    if (la > QMAX || lb > QMAX)
        return 99;
    for (int j = 0; j <= lb; j++)
        prev[j] = j;
    for (int i = 1; i <= la; i++) {
        cur[0] = i;
        for (int j = 1; j <= lb; j++)
            cur[j] = min3(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] != b[j - 1]));
        memcpy(prev, cur, sizeof cur);
    }
    int best = 99;
    for (int j = 0; j <= lb; j++)
        if (prev[j] < best)
            best = prev[j];
    return best;
}

static int word_prefix(const char *name, const char *q)
{
    size_t n = strlen(q);
    for (const char *p = name; *p; p++)
        if ((p == name || p[-1] == ' ') && !strncmp(p, q, n))
            return 1;
    return 0;
}

/* every word of q appears somewhere in name, any order */
static int all_words(const char *name, const char *q)
{
    char tmp[QMAX];
    strcpy(tmp, q);
    for (char *w = strtok(tmp, " "); w; w = strtok(NULL, " "))
        if (!strstr(name, w))
            return 0;
    return 1;
}

/* lower is better, -1 for no match */
static int score(const char *name, const char *q)
{
    if (!strcmp(name, q))
        return 0;
    if (!strncmp(name, q, strlen(q)))
        return 1;
    if (word_prefix(name, q))
        return 2;
    if (strstr(name, q))
        return 3;
    if (strchr(q, ' ') && all_words(name, q))
        return 4;
    /* typos only once there's enough text to tell names apart */
    size_t n = strlen(q);
    if (n >= 4) {
        int d = prefix_dist(q, name);
        if (d <= (n >= 8 ? 2 : 1))
            return 5 + d;
    }
    return -1;
}

typedef struct {
    int idx, score;
} Hit;

static int by_score(const void *a, const void *b)
{
    const Hit *x = a, *y = b;
    return x->score != y->score ? x->score - y->score : x->idx - y->idx;
}

/* ranked matches, best first; returns how many were written to out */
int net_search(const Net *g, const char *text, int *out, int max)
{
    char q[QMAX];
    normalise(text, q, sizeof q);
    if (!*q || max <= 0)
        return 0;

    Hit *hits = malloc(g->n * sizeof *hits);
    if (!hits)
        return 0;
    int nh = 0;
    for (int i = 0; i < g->n; i++) {
        char name[QMAX];
        normalise(g->st[i].name, name, sizeof name);
        int s = score(name, q);
        for (size_t a = 0; a < sizeof aliases / sizeof *aliases; a++) {
            if (!str_ieq(aliases[a][1], g->st[i].name))
                continue;
            int t = score(aliases[a][0], q);
            /* an alias hit ranks just behind the same kind of hit on the real name */
            if (t >= 0 && (s < 0 || t < s))
                s = t;
        }
        if (s >= 0)
            hits[nh++] = (Hit){i, s};
    }
    qsort(hits, nh, sizeof *hits, by_score);
    int k = nh < max ? nh : max;
    for (int i = 0; i < k; i++)
        out[i] = hits[i].idx;
    free(hits);
    return k;
}
