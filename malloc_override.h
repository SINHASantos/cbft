//  Copyright 2024-Present Couchbase, Inc.
//
//  Use of this software is governed by the Business Source License included
//  in the file licenses/BSL-Couchbase.txt.  As of the Change Date specified
//  in that file, in accordance with the Business Source License, use of this
//  software will be governed by the Apache License, Version 2.0, included in
//  the file licenses/APL2.txt.

#ifndef MALLOC_OVERRIDE_H
#define MALLOC_OVERRIDE_H

#include <stddef.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <errno.h>

#ifdef JEMALLOC
    /* Include jemalloc.h for jemalloc specific functions. */
    #include <jemalloc/jemalloc.h>
    /* jemalloc checks for this symbol, and it's contents for the config to use. */
    extern const char* malloc_conf;
#else
    #if defined(__linux__) || defined(__linux) || defined(linux) || defined(__gnu_linux__) || defined(WIN32)
        // Include malloc.h for malloc_info(..) on linux and _heapwalk(..) on windows
        #include <malloc.h>
    #elif defined(__APPLE__) && defined(__MACH__)
        // Include malloc/malloc.h for mstats()
        #include <malloc/malloc.h>
    #endif
#endif

typedef struct {
	char *buf;
	int offset;
	int size;
} stats_buf;

// ----------------------------------------------------------------------------------------------
// Set API wrappers for statistic collection and profiling from the underlying C memory allocator
// ----------------------------------------------------------------------------------------------
#ifdef __cplusplus
extern "C" {
#endif
    // number of bytes allocated in malloc - num_bytes_used_ram_c
    size_t mm_allocated();
    // if malloc implementation is jemalloc, mm_stats_json and mm_stats_text
    // return jemalloc stats by calling the malloc_stats_print API, 
    // otherwise they return NULL
    // mm_stats_json - returns jemalloc stats in json format
    char* mm_stats_json();
    // mm_stats_text - returns jemalloc stats in text format
    char* mm_stats_text();
    // mm_prof_activate - activates jemalloc profiling
    int mm_prof_activate();
    // mm_prof_deactivate - deactivates jemalloc profiling
    int mm_prof_deactivate();
    // mm_prof_dump - dumps jemalloc profiling data to a file
    int mm_prof_dump(char* filePath);

#ifdef __cplusplus
}
#endif

#endif // MALLOC_OVERRIDE_H
