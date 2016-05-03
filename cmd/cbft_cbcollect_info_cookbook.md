Some command-line cookbook notes and hints, which might be useful when
trying to diagnose cbcollect-info logs...

To dump the full /api/diag from a cbcollect-info directory...
    ./cbft_cbcollect_info_analyze extract /api/diag cbcollect_info*

For example, you can now pipe it to "jq ." (or "python -m json.tool") or other tools...
    ./cbft_cbcollect_info_analyze extract /api/diag cbcollect_info* | jq .

To see the "/api/cfg"...
    ./cbft_cbcollect_info_analyze extract /api/diag cbcollect_info* | jq '.["/api/cfg"]'

To see the "/api/stats"...
    ./cbft_cbcollect_info_analyze extract /api/diag cbcollect_info* | jq '.["/api/stats"]

To see the bucketDataSourceStats (from cbdatasource) across all feeds...
    ./cbft_cbcollect_info_analyze extract /api/diag cbcollect_info* | jq '.["/api/stats"]?["feeds"]?[]?["bucketDataSourceStats"]?'

To look for non-zero cbdatasource error counts...
    ./cbft_cbcollect_info_analyze extract /api/diag cbcollect_info* | jq '.["/api/stats"]?["feeds"]?[]?["bucketDataSourceStats"]?' | grep Err | grep -v " 0,"
    ...
    "TotWorkerReceiveErr": 1,
    "TotWorkerHandleRecvErr": 1,
    "TotUPRDataChangeStateErr": 1,
    "TotUPRSnapshotStateErr": 1,
    "TotWantCloseRequestedVBucketErr": 1,
    ...

To get the cbft node uuid's...
    grep "\-uuid" cbcollect_info_*/*fts.log

To find the node that became the (so-called) "MCP" during rebalance...
    grep %%% cbc*/*.log | cut -f 1 -d \- | sort | uniq

To see what node was being removed during rebalance...
    grep nodesToRemove cbcollect_info_*/*fts.log

To see what metakv "planPIndexes" updates the cbft's might be making...
    grep metakv */*.log | grep fts | grep PUT | grep planPIndexes

Another, faster way to see the what pindex updates the cbft nodes are making through metakv (from Aliaksey)...
    grep PUT.*PIndexes */ns_server.http_access_internal.log | sort -k4

To find the couchbase nodes that ns-server might know about...
    grep -h per_node_ets_tables */*.log | cut -f 1 -d , | sort | uniq

To see when rebalance was started by ns-server...
    grep -i ns_rebalancer */*.log | grep -i started
    ...
    cbcollect_info_ns_1@172.23.106.176_20160429-001333/diag.log:2016-04-28T17:07:18.198-07:00, ns_rebalancer:0:info:message(ns_1@172.23.106.139) - Started rebalancing bucket default
    ...
