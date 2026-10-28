CC ?= gcc
CFLAGS ?= -std=c11 -Wall -Wextra -O2

SRC = src/graph.c src/route.c src/fileio.c
BIN = metro

all: $(BIN)

$(BIN): $(SRC) src/menu.c src/main.c src/metro.h
	$(CC) $(CFLAGS) -o $@ $(SRC) src/menu.c src/main.c

test: test_metro
	./test_metro

test_metro: $(SRC) tests/test_main.c src/metro.h
	$(CC) $(CFLAGS) -Isrc -o $@ $(SRC) tests/test_main.c

clean:
	rm -f $(BIN) $(BIN).exe test_metro test_metro.exe

.PHONY: all test clean
