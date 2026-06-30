//  Copyright 2026-Present Couchbase, Inc.
//
//  Use of this software is governed by the Business Source License included
//  in the file licenses/BSL-Couchbase.txt.  As of the Change Date specified
//  in that file, in accordance with the Business Source License, use of this
//  software will be governed by the Apache License, Version 2.0, included in
//  the file licenses/APL2.txt.

//go:build vectors
// +build vectors

package cbft

import (
	"fmt"
	"io"
	"sync/atomic"
	"time"

	"github.com/couchbase/cbgt"
)

// TrainingStats tracks the time spent in each phase of the vector index
// sampling/training flow. The results are accumulated in nanoseconds, and
// written out in milliseconds JSON format via WriteJSON.
type TrainingStats struct {
	TotKVFetchTimeInNs           uint64
	TotDocBuildTimeInNs          uint64
	TotBatchTrainTimeInNs        uint64
	TotTrainedIndexBuildTimeInNs uint64
	TotTrainedIndexCopyTimeInNs  uint64
}

func (s *TrainingStats) WriteJSON(w io.Writer) {
	toMs := func(ns uint64) float64 {
		return float64(ns) / float64(time.Millisecond)
	}

	stats := fmt.Sprintf(`{"TotTrainedIndexBuildTimeInMs":%.3f`, toMs(atomic.LoadUint64(&s.TotTrainedIndexBuildTimeInNs)))
	stats += fmt.Sprintf(`,"TotKVFetchTimeInMs":%.3f`, toMs(atomic.LoadUint64(&s.TotKVFetchTimeInNs)))
	stats += fmt.Sprintf(`,"TotDocBuildTimeInMs":%.3f`, toMs(atomic.LoadUint64(&s.TotDocBuildTimeInNs)))
	stats += fmt.Sprintf(`,"TotBatchTrainTimeInMs":%.3f`, toMs(atomic.LoadUint64(&s.TotBatchTrainTimeInNs)))
	stats += fmt.Sprintf(`,"TotTrainedIndexCopyTimeInMs":%.3f`, toMs(atomic.LoadUint64(&s.TotTrainedIndexCopyTimeInNs)))
	w.Write([]byte(stats))
	w.Write(cbgt.JsonCloseBrace)
}
