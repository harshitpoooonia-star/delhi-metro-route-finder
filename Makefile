CC ?= gcc
CFLAGS ?= -std=c11 -Wall -Wextra -O2
EMCC ?= emcc

SRC = src/graph.c src/route.c src/fileio.c src/search.c src/api.c
BIN = metro
WEB = web

all: $(BIN)

$(BIN): $(SRC) src/menu.c src/main.c src/metro.h
	$(CC) $(CFLAGS) -o $@ $(SRC) src/menu.c src/main.c

test: test_metro test_api
	./test_metro
	./test_api

test_metro: $(SRC) tests/test_main.c src/metro.h
	$(CC) $(CFLAGS) -Isrc -o $@ $(SRC) tests/test_main.c

test_api: $(SRC) tests/test_api.c src/metro.h
	$(CC) $(CFLAGS) -Isrc -o $@ $(SRC) tests/test_api.c

# The C engine compiled to WebAssembly, with data/ packed in at /data.
# Needs Emscripten (emcc) on PATH.
wasm: $(WEB)/metro.js

$(WEB)/metro.js: $(SRC) src/metro.h data/stations.txt data/links.txt
	$(EMCC) -std=c11 -O2 -o $@ $(SRC) 		--preload-file data@/data 		-sMODULARIZE -sEXPORT_NAME=createMetro -sENVIRONMENT=web 		-sALLOW_MEMORY_GROWTH 		-sEXPORTED_FUNCTIONS=_api_load,_api_route,_api_search,_api_lines,_api_line 		-sEXPORTED_RUNTIME_METHODS=ccall

serve: wasm
	python -m http.server 8000 -d $(WEB)

clean:
	rm -f $(BIN) $(BIN).exe test_metro test_metro.exe test_api test_api.exe
	rm -f $(WEB)/metro.js $(WEB)/metro.wasm $(WEB)/metro.data

.PHONY: all test wasm serve clean
