//  Copyright (c) 2019 Couchbase, Inc.
//  Licensed under the Apache License, Version 2.0 (the "License");
//  you may not use this file except in compliance with the
//  License. You may obtain a copy of the License at
//    http://www.apache.org/licenses/LICENSE-2.0
//  Unless required by applicable law or agreed to in writing,
//  software distributed under the License is distributed on an "AS
//  IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
//  express or implied. See the License for the specific language
//  governing permissions and limitations under the License.

package main

import (
	"github.com/couchbase/cbauth"
	"github.com/couchbase/cbft"
	pb "github.com/couchbase/cbft/protobuf"
	"github.com/couchbase/cbgt"
	log "github.com/couchbase/clog"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/reflection"
	"net"
	"strconv"
	"strings"
	"sync"
)

var grpcServers []*grpc.Server
var grpcServersMutex sync.Mutex

// Close all Grpc Servers
func closeAndClearGrpcServerList() {
	grpcServersMutex.Lock()

	for _, server := range grpcServers {
		// stop the grpc server.
		server.Stop()
	}
	grpcServers = nil
	grpcServersMutex.Unlock()
}

func setUpGrpcListenersAndServ(mgr *cbgt.Manager,
	options map[string]string) {

	setUpGrpcListenersAndServUtil(mgr, flags.BindGRPC, false, options)

	authType = options["authType"]

	if authType == "cbauth" {
		handleConfigChanges := func() error {
			cfg := getTLSConfigs()
			log.Printf("init_grpc: handleConfigChanges callback: %d", cfg.refreshType)
			if cfg.refreshType == cbauth.CFG_CHANGE_CERTS_TLSCONFIG {
				// restart the servers in case of certs change
				setUpGrpcListenersAndServUtil(mgr, flags.BindGRPCSSL, true, options)
			}
			return nil
		}

		registerTLSRefreshCallback("grpc-ssl", handleConfigChanges)

		setUpGrpcListenersAndServUtil(mgr, flags.BindGRPCSSL, true, options)
	} else {
		setUpGrpcListenersAndServUtil(mgr, flags.BindGRPCSSL, true, options)
	}
}

func setUpGrpcListenersAndServUtil(mgr *cbgt.Manager, bindPORT string,
	secure bool, options map[string]string) {
	ipv6 = options["ipv6"]

	if secure {
		// close any previously open grpc servers
		closeAndClearGrpcServerList()
	}

	bindGRPCList := strings.Split(bindPORT, ",")
	anyHostPorts := map[string]bool{}
	// bind to 0.0.0.0's (IPv4) or [::]'s (IPv6) first for grpc listening.
	for _, bindGRPC := range bindGRPCList {
		if strings.HasPrefix(bindGRPC, "0.0.0.0:") ||
			strings.HasPrefix(bindGRPC, "[::]:") {
			go startGrpcServer(mgr, bindGRPC, secure, nil)

			anyHostPorts[bindGRPC] = true
		}
	}

	for i := len(bindGRPCList) - 1; i >= 1; i-- {
		go startGrpcServer(mgr, bindGRPCList[i], secure, anyHostPorts)
	}
}

func startGrpcServer(mgr *cbgt.Manager, bindGRPC string, secure bool,
	anyHostPorts map[string]bool) {
	if bindGRPC[0] == ':' {
		bindGRPC = "localhost" + bindGRPC
	}

	if anyHostPorts != nil && len(bindGRPC) > 0 {
		// if we've already bound to 0.0.0.0 or [::] on the same port, then
		// skip this hostPort.
		portIndex := strings.LastIndex(bindGRPC, ":") + 1
		if portIndex > 0 && portIndex < len(bindGRPC) {
			// possibly valid port available.
			port := bindGRPC[portIndex:]
			if _, err := strconv.Atoi(port); err == nil {
				// valid port.
				host := "0.0.0.0"
				if net.ParseIP(bindGRPC[:portIndex-1]).To4() == nil &&
					// not an IPv4
					ipv6 == "true" {
					host = "[::]"
				}

				anyHostPort := host + ":" + port
				if anyHostPorts[anyHostPort] {
					if anyHostPort != bindGRPC {
						log.Printf("init_grpc: GRPC is available"+
							" (via %v): %s", host, bindGRPC)
					}
					return
				}
			}
		} // else port not found.
	}

	lis, err := net.Listen("tcp", bindGRPC)
	if err != nil {
		log.Fatalf("init_grpc: mainGrpcServer, failed to listen: %v", err)
	}

	opts := getGrpcOpts(secure)

	s := grpc.NewServer(opts...)

	searchSrv := &cbft.SearchService{}
	searchSrv.SetManager(mgr)
	pb.RegisterSearchServiceServer(s, searchSrv)

	reflection.Register(s)

	if secure {
		grpcServersMutex.Lock()
		grpcServers = append(grpcServers, s)
		grpcServersMutex.Unlock()
	}

	log.Printf("init_grpc: GrpcServer Started at %s", bindGRPC)
	if err := s.Serve(lis); err != nil {
		log.Fatalf("failed to serve: %v", err)
	}

}

func getGrpcOpts(secure bool) []grpc.ServerOption {
	opts := []grpc.ServerOption{
		cbft.AddServerInterceptor(),
		grpc.MaxConcurrentStreams(cbft.DefaultGrpcMaxConcurrentStreams),
		grpc.MaxSendMsgSize(cbft.DefaultGrpcMaxRecvMsgSize),
		grpc.MaxRecvMsgSize(cbft.DefaultGrpcMaxSendMsgSize),
		// TODO add more configurability
	}

	if secure {
		var err error
		var creds credentials.TransportCredentials
		creds, err = credentials.NewServerTLSFromFile(flags.TLSCertFile,
			flags.TLSKeyFile)
		if err != nil {
			log.Fatalf("init_grpc: NewServerTLSFromFile, err: %v", err)
		}

		opts = append(opts, grpc.Creds(creds))
	}

	return opts
}
