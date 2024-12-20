//  Copyright 2017-Present Couchbase, Inc.
//
//  Use of this software is governed by the Business Source License included
//  in the file licenses/BSL-Couchbase.txt.  As of the Change Date specified
//  in that file, in accordance with the Business Source License, use of this
//  software will be governed by the Apache License, Version 2.0, included in
//  the file licenses/APL2.txt.

// controller responsible for building custom analysis components
import {confirmDialog, alertDialog} from "../../../static/util.js";
import TestAnalyzerModalCtrl from "./test_analyzer.js";

import analyzerTemplate from '../../partials/analysis/analyzer.html';
import wordlistTemplate from '../../partials/analysis/wordlist.html';
import charfilterTemplate from '../../partials/analysis/charfilter.html';
import tokenizerTemplate from '../../partials/analysis/tokenizer.html';
import tokenfilterTemplate from '../../partials/analysis/tokenfilter.html';
import datetimeparserTemplate from '../../partials/analysis/datetimeparser.html';
import testAnalyzerTemplate from '../../partials/analysis/test_analyzer.html';
import documentfilterTemplate from '../../partials/analysis/documentfilter.html';
import synonymsourceTemplate from '../../partials/analysis/synonymsource.html';

export default BleveAnalysisCtrl;
BleveAnalysisCtrl.$inject = ["$scope", "$http", "$log", "$uibModal"];
function BleveAnalysisCtrl($scope, $http, $log, $uibModal) {
    var viewOnly = $scope.viewOnly;

    $scope.newAnalyzer = function() {
        return $scope.editAnalyzer("", {
            "type": "custom",
            "char_filters": [],
            "tokenizer": "unicode",
            "token_filters": []
        });
    };

    $scope.analyzerPlayground = function() {
        var mapping = $scope.indexMappingResult();
        $uibModal.open({
            template: testAnalyzerTemplate,
            animation: $scope.animationsEnabled,
            scope: $scope,
            controller: TestAnalyzerModalCtrl,
            resolve: {
                analyzerName: function() {
                    return "standard";
                },
                analyzerList: function() {
                    return $scope.analyzerNames;
                },
                textValue: function() {
                    return "";
                },
                indexMapping: function() {
                    return mapping;
                },
                httpClient: function() {
                    return $http;
                }
            }
        }).result.then(function(){});
    };

    $scope.deleteAnalyzer = function(name) {
        var used = $scope.isAnalyzerUsed(name);
        if (used) {
            alertDialog(
                $scope, $uibModal,
                "Delete Analyzer",
                "The analyzer `" + name + "` cannot be deleted because it is being used by the " + used + "."
            ).then(function success() {});
            return;
        }

        confirmDialog(
            $scope, $uibModal,
            "Confirm Delete Analyzer",
            "Are you sure you want to delete '" + name + "'?",
            "Delete Analyzer"
        ).then(function success() {
            delete $scope.indexMapping.analysis.analyzers[name];
        });
    };

    $scope.isAnalyzerUsed = function(name) {
        // analyzers are used in mappings (in various places)

        // first check index level default analyzer
        if ($scope.indexMapping.default_analyzer == name) {
            return "index mapping default analyzer";
        }

        // then check the default document mapping
        var dm = $scope.indexMapping.default_mapping;
        let used = $scope.isAnalyzerUsedInDocMapping(name, dm, "");
        if (used) {
            return "default document mapping " + used;
        }

        // then check the document mapping for each type
        for (var docType in $scope.indexMapping.types) {
            var docMapping = $scope.indexMapping.types[docType];
            let used = $scope.isAnalyzerUsedInDocMapping(name, docMapping, "");
            if (used) {
                return "document mapping type '" + docType + "' ";
            }
        }

        return null;
    };

    // a recursive helper
    $scope.isAnalyzerUsedInDocMapping = function(name, docMapping, path) {
        // first check the document level default analyzer
        if (docMapping.default_analyzer == name) {
            if (path) {
                return "default analyzer at " + path;
            } else {
                return "default analyzer";
            }
        }

        // now check fields at this level
        for (var fieldIndex in docMapping.fields) {
            var field = docMapping.fields[fieldIndex];
            if (field.analyzer == name) {
                if (field.name) {
                    return "in the field named " + field.name;
                }
                return "in the field at path " + path;
            }
        }

        // now check each nested property
        for (var propertyName in docMapping.properties) {
            var subDoc = docMapping.properties[propertyName];
            if (path) {
                let used = $scope.isAnalyzerUsedInDocMapping(name, subDoc, path+"."+propertyName);
                if (used) {
                    return used;
                }
            } else {
                let used = $scope.isAnalyzerUsedInDocMapping(name, subDoc, propertyName);
                if (used) {
                    return used;
                }
            }
        }

        return null;
    };

    $scope.editAnalyzer = function(name, value, viewOnlyIn) {
        var viewOnlyModal = $scope.viewOnlyModal = viewOnlyIn || viewOnly;
        var modalInstance = $uibModal.open({
          scope: $scope,
          animation: $scope.animationsEnabled,
          template: analyzerTemplate,
          controller: 'BleveAnalyzerModalCtrl',
          resolve: {
            name: function() {
                return name;
            },
            value: function() {
                return value;
            },
            mapping: function() {
                return $scope.indexMapping;
            },
            static_prefix: function() {
                return $scope.static_prefix;
            },
            viewOnlyModal: function() {
                return viewOnlyModal;
            }
          }
        });

        modalInstance.result.then(function(result) {
            $scope.viewOnlyModal = false;
            // add this result to the mapping
            for (var resultKey in result) {
                if (name !== "" && resultKey != name) {
                    // remove the old name
                    delete $scope.indexMapping.analysis.analyzers[name];
                }
                $scope.indexMapping.analysis.analyzers[resultKey] =
                    result[resultKey];

                // reload available analyzers
                var lan =
                    $scope.loadAnalyzerNames ||
                    $scope.$parent.loadAnalyzerNames;
                if (lan) {
                    lan();
                }
            }
        }, function() {
          $scope.viewOnlyModal = false;
          $log.info('Modal dismissed at: ' + new Date());
        });
    };

    // word lists

    $scope.newWordList = function() {
        return $scope.editWordList("", {tokens:[]});
    };

    $scope.deleteWordList = function(name) {
        var used = $scope.isWordListUsed(name);
        if (used) {
            alertDialog(
                $scope, $uibModal,
                "Delete Word List",
                "The word list `" + name + "` cannot be deleted because it is being used by the " + used + "."
            ).then(function success() {});
            return;
        }

        confirmDialog(
            $scope, $uibModal,
            "Confirm Delete Word List",
            "Are you sure you want to delete '" + name + "'?",
            "Delete Word List"
        ).then(function success() {
            delete $scope.indexMapping.analysis.token_maps[name];
        });
    };

    $scope.isWordListUsed = function(name) {
        // word lists are only used by token filters
        let tokenFilterName;
        for (tokenFilterName in $scope.indexMapping.analysis.token_filters) {
            var tokenFilter =
                $scope.indexMapping.analysis.token_filters[tokenFilterName];
            // word lists are embeded in a variety of different field names
            if (tokenFilter.dict_token_map == name ||
                tokenFilter.articles_token_map == name ||
                tokenFilter.keywords_token_map == name ||
                tokenFilter.stop_token_map == name) {
                return "token filter named '" + tokenFilterName + "'";
            }
        }
        return null;
    };

    $scope.editWordList = function(name, value, viewOnlyIn) {
        var viewOnlyModal = $scope.viewOnlyModal = viewOnlyIn || viewOnly;
        var modalInstance = $uibModal.open({
          scope: $scope,
          animation: $scope.animationsEnabled,
          template: wordlistTemplate,
          controller: 'BleveWordListModalCtrl',
          resolve: {
            name: function() {
                return name;
            },
            words: function() {
                return value.tokens;
            },
            mapping: function() {
                return $scope.indexMapping;
            },
            static_prefix: function() {
                return $scope.static_prefix;
            },
            viewOnlyModal: function() {
                return viewOnlyModal;
            }
          }
        });

        modalInstance.result.then(function(result) {
            $scope.viewOnlyModal = false;
            // add this result to the mapping
            for (var resultKey in result) {
                if (name !== "" && resultKey != name) {
                    // remove the old name
                    delete $scope.indexMapping.analysis.token_maps[name];
                }
                $scope.indexMapping.analysis.token_maps[resultKey] =
                    result[resultKey];
            }
        }, function() {
          $scope.viewOnlyModal = false;
          $log.info('Modal dismissed at: ' + new Date());
        });
    };

    // character filters

    $scope.newCharFilter = function() {
        return $scope.editCharFilter("", {});
    };

    $scope.deleteCharFilter = function(name) {
        var used = $scope.isCharFilterUsed(name);
        if (used) {
            alertDialog(
                $scope, $uibModal,
                "Delete Character Filter",
                "The character filter `" + name + "` cannot be deleted because it is being used by the " + used + "."
            ).then(function success() {});
            return;
        }

        confirmDialog(
            $scope, $uibModal,
            "Confirm Delete Character Filter",
            "Are you sure you want to delete '" + name + "'?",
            "Delete Character Filter"
        ).then(function success() {
            delete $scope.indexMapping.analysis.char_filters[name];
        });
    };

    $scope.isCharFilterUsed = function(name) {
        // character filters can only be used by analyzers
        for (var analyzerName in $scope.indexMapping.analysis.analyzers) {
            var analyzer = $scope.indexMapping.analysis.analyzers[analyzerName];
            for (var charFilterIndex in analyzer.char_filters) {
                var charFilterName = analyzer.char_filters[charFilterIndex];
                if (charFilterName == name) {
                    return "analyzer named '" + analyzerName + "'";
                }
            }
        }
        return null;
    };

    $scope.editCharFilter = function(name, value, viewOnlyIn) {
        var viewOnlyModal = $scope.viewOnlyModal = viewOnlyIn || viewOnly;
        var modalInstance = $uibModal.open({
          scope: $scope,
          animation: $scope.animationsEnabled,
          template: charfilterTemplate,
          controller: 'BleveCharFilterModalCtrl',
          resolve: {
            name: function() {
                return name;
            },
            value: function() {
                return value;
            },
            mapping: function() {
                return $scope.indexMapping;
            },
            static_prefix: function() {
                return $scope.static_prefix;
            },
            viewOnlyModal: function() {
                return viewOnlyModal;
            }
          }
        });

        modalInstance.result.then(function(result) {
            $scope.viewOnlyModal = false;
            // add this result to the mapping
            for (var resultKey in result) {
                if (name !== "" && resultKey != name) {
                    // remove the old name
                    delete $scope.indexMapping.analysis.char_filters[name];
                }
                $scope.indexMapping.analysis.char_filters[resultKey] =
                    result[resultKey];
            }
        }, function() {
          $scope.viewOnlyModal = false;
          $log.info('Modal dismissed at: ' + new Date());
        });
    };

    // tokenizers

    $scope.newTokenizer = function() {
        return $scope.editTokenizer("", {});
    };

    $scope.deleteTokenizer = function(name) {
        var used = $scope.isTokenizerUsed(name);
        if (used) {
            alertDialog(
                $scope, $uibModal,
                "Delete Tokenizer",
                "The tokenizer `" + name + "` cannot be deleted because it is being used by the " + used + "."
            ).then(function success() {});
            return;
        }

        confirmDialog(
            $scope, $uibModal,
            "Confirm Delete Tokenizer",
            "Are you sure you want to delete '" + name + "'?",
            "Delete Tokenizer"
        ).then(function success() {
            delete $scope.indexMapping.analysis.tokenizers[name];
        });
    };

    $scope.isTokenizerUsed = function(name) {
        // tokenizers can be used by *other* tokenizers
        for (var tokenizerName in $scope.indexMapping.analysis.tokenizers) {
            var tokenizer = $scope.indexMapping.analysis.tokenizers[tokenizerName];
            if (tokenizer.tokenizer == name) {
                return "tokenizer named '" + tokenizerName + "'";
            }
        }

        // tokenizers can be used by analyzers
        for (var analyzerName in $scope.indexMapping.analysis.analyzers) {
            var analyzer = $scope.indexMapping.analysis.analyzers[analyzerName];
            if (analyzer.tokenizer == name) {
                return "analyzer named '" + analyzerName + "'";
            }
        }
        return null;
    };

    $scope.editTokenizer = function(name, value, viewOnlyIn) {
        var viewOnlyModal = $scope.viewOnlyModal = viewOnlyIn || viewOnly;
        var modalInstance = $uibModal.open({
          scope: $scope,
          animation: $scope.animationsEnabled,
          template: tokenizerTemplate,
          controller: 'BleveTokenizerModalCtrl',
          resolve: {
            name: function() {
                return name;
            },
            value: function() {
                return value;
            },
            mapping: function() {
                return $scope.indexMapping;
            },
            static_prefix: function() {
                return $scope.static_prefix;
            },
            viewOnlyModal: function() {
                return viewOnlyModal;
            }
          }
        });

        modalInstance.result.then(function(result) {
            $scope.viewOnlyModal = false;
            // add this result to the mapping
            for (var resultKey in result) {
                if (name !== "" && resultKey != name) {
                    // remove the old name
                    delete $scope.indexMapping.analysis.tokenizers[name];
                }
                $scope.indexMapping.analysis.tokenizers[resultKey] =
                    result[resultKey];
            }
        }, function() {
          $scope.viewOnlyModal = false;
          $log.info('Modal dismissed at: ' + new Date());
        });
    };

    // token filters

    $scope.newTokenFilter = function() {
        return $scope.editTokenFilter("", {});
    };

    $scope.deleteTokenFilter = function(name) {
        var used = $scope.isTokenFilterUsed(name);
        if (used) {
            alertDialog(
                $scope, $uibModal,
                "Delete Token Filter",
                "The token filter `" + name + "` cannot be deleted because it is being used by the " + used + "."
            ).then(function success() {});
            return;
        }

        confirmDialog(
            $scope, $uibModal,
            "Confirm Delete Token Filter",
            "Are you sure you want to delete '" + name + "'?",
            "Delete Token Filter"
        ).then(function success() {
            delete $scope.indexMapping.analysis.token_filters[name];
        });
    };

    $scope.isTokenFilterUsed = function(name) {
        // token filters can only be used by analyzers
        for (var analyzerName in $scope.indexMapping.analysis.analyzers) {
            var analyzer = $scope.indexMapping.analysis.analyzers[analyzerName];
            for (var tokenFilterIndex in analyzer.token_filters) {
                let tokenFilterName = analyzer.token_filters[tokenFilterIndex];
                if (tokenFilterName == name) {
                    return "analyzer named '" + analyzerName + "'";
                }
            }
        }
        return null;
    };

    $scope.editTokenFilter = function(name, value, viewOnlyIn) {
        var viewOnlyModal = $scope.viewOnlyModal = viewOnlyIn || viewOnly;
        var modalInstance = $uibModal.open({
          scope: $scope,
          animation: $scope.animationsEnabled,
          template: tokenfilterTemplate,
          controller: 'BleveTokenFilterModalCtrl',
          resolve: {
            name: function() {
                return name;
            },
            value: function() {
                return value;
            },
            mapping: function() {
                return $scope.indexMapping;
            },
            static_prefix: function() {
                return $scope.static_prefix;
            },
            viewOnlyModal: function() {
                return viewOnlyModal;
            }
          }
        });

        modalInstance.result.then(function(result) {
            $scope.viewOnlyModal = false;
            // add this result to the mapping
            for (var resultKey in result) {
                if (name !== "" && resultKey != name) {
                    // remove the old name
                    delete $scope.indexMapping.analysis.token_filters[name];
                }
                $scope.indexMapping.analysis.token_filters[resultKey] =
                    result[resultKey];
            }
        }, function() {
          $scope.viewOnlyModal = false;
          $log.info('Modal dismissed at: ' + new Date());
        });
    };

    // date time parsers

    $scope.newDatetimeParser = function() {
        return $scope.editDatetimeParser("", {
            "type": "sanitizedgo",
            "layouts": []
        });
    };

    $scope.deleteDatetimeParser = function(name) {
        var used = $scope.isDatetimeParserUsed(name);
        if (used) {
            alertDialog(
                $scope, $uibModal,
                "Delete Date/Time Parser",
                "The date/time parser `" + name + "` cannot be deleted because it is being used by the " + used + "."
            ).then(function success() {});
            return;
        }

        confirmDialog(
            $scope, $uibModal,
            "Confirm Delete Date/Time Parser",
            "Are you sure you want to delete '" + name + "'?",
            "Delete Date/Time Parser"
        ).then(function success() {
            delete $scope.indexMapping.analysis.date_time_parsers[name]
        });
    };

    $scope.isDatetimeParserUsed = function(name) {
        // datetime parsers are used in fields (under various mappings)

        // first check index level default date/time parser
        if ($scope.indexMapping.default_datetime_parser == name) {
            return "index mapping default datetime parser";
        }

        // then check the default document mapping
        var dm = $scope.indexMapping.default_mapping;
        let used = $scope.isDatetimeParserUsedInDocMapping(name, dm, "");
        if (used) {
            return "default document mapping " + used;
        }

        // then check the document mapping for each type
        for (var docType in $scope.indexMapping.types) {
            var docMapping = $scope.indexMapping.types[docType];
            let used = $scope.isDatetimeParserUsedInDocMapping(name, docMapping, "");
            if (used) {
                return "document mapping type '" + docType + "' ";
            }
        }

        return null;
    };

    // a recursive helper
    $scope.isDatetimeParserUsedInDocMapping = function(name, docMapping, path) {
        // first check the document level default analyzer
        if (docMapping.default_datetime_parser == name) {
            if (path) {
                return "default datetime parser at " + path;
            } else {
                return "default datetime parser";
            }
        }

        // now check fields at this level
        for (var fieldIndex in docMapping.fields) {
            var field = docMapping.fields[fieldIndex];
            if (field.date_format == name) {
                if (field.name) {
                    return "in the field named " + field.name;
                }
                return "in the field at path " + path;
            }
        }

        // now check each nested property
        for (var propertyName in docMapping.properties) {
            var subDoc = docMapping.properties[propertyName];
            if (path) {
                let used = $scope.isDatetimeParserUsedInDocMapping(name, subDoc, path+"."+propertyName);
                if (used) {
                    return used;
                };
            } else {
                let used = $scope.isDatetimeParserUsedInDocMapping(name, subDoc, propertyName);
                if (used) {
                    return used;
                }
            }
        }

        return null;
    };

    $scope.editDatetimeParser = function(name, value, viewOnlyIn) {
        var viewOnlyModal = $scope.viewOnlyModal = viewOnlyIn || viewOnly;
        var modalInstance = $uibModal.open({
          scope: $scope,
          animation: $scope.animationsEnabled,
          template: datetimeparserTemplate,
          controller: 'BleveDatetimeParserModalCtrl',
          resolve: {
            name: function() {
                return name;
            },
            value: function() {
                return value;
            },
            mapping: function() {
                return $scope.indexMapping;
            },
            static_prefix: function() {
                return $scope.static_prefix;
            },
            viewOnlyModal: function() {
                return viewOnlyModal;
            }
          }
        });

        modalInstance.result.then(function(result) {
            $scope.viewOnlyModal = false;
            // add this result to the mapping
            for (var resultKey in result) {
                if (name !== "" && resultKey != name) {
                    // remove the old name
                    delete $scope.indexMapping.analysis.date_time_parsers[name];
                }
                $scope.indexMapping.analysis.date_time_parsers[resultKey] =
                    result[resultKey];

                // reload available date_time_parsers
                var lan =
                    $scope.loadDatetimeParserNames ||
                    $scope.$parent.loadDatetimeParserNames;
                if (lan) {
                    lan();
                }
            }
        }, function() {
          $scope.viewOnlyModal = false;
          $log.info('Modal dismissed at: ' + new Date());
        });
    };

    // document filters
    $scope.newDocumentFilter = function() {
        return $scope.editDocumentFilter("", {});
    };

    $scope.deleteDocumentFilter = function(type) {
        confirmDialog(
            $scope, $uibModal,
            "Confirm Delete Document Filter",
            "Are you sure you want to delete the document filter '" + type + "'?",
            "Delete Document Filter"
        ).then(function success() {
            delete($scope.ftsDocConfig.doc_filter[type]);
        });
    };

    $scope.editDocumentFilter = function(type, value, viewOnlyIn) {
        var viewOnlyModal = $scope.viewOnlyModal = viewOnlyIn || viewOnly;
        var modalInstance = $uibModal.open({
          scope: $scope,
          animation: $scope.animationsEnabled,
          template: documentfilterTemplate,
          controller: 'BleveDocumentFilterModalCtrl',
          resolve: {
            type: function() {
                return type;
            },
            value: function() {
                return value;
            },
            docConfig: function() {
                return $scope.ftsDocConfig;
            },
            mapping: function() {
                return $scope.indexMapping;
            },
            viewOnlyModal: function() {
                return viewOnlyModal;
            }
          }
        });

        modalInstance.result.then(function(result) {
            $scope.viewOnlyModal = false;
            if ($scope.isObjectEmpty($scope.ftsDocConfig.doc_filter)) {
                $scope.ftsDocConfig.doc_filter = {};
            }
            // add this result to the mapping
            for (var resultKey in result) {
                if (type !== "" && resultKey != type) {
                    // remove the old type
                    delete $scope.ftsDocConfig.doc_filter[type];
                }
                $scope.ftsDocConfig.doc_filter[resultKey] =
                    result[resultKey];
            }
        }, function() {
          $scope.viewOnlyModal = false;
          $log.info('Modal dismissed at: ' + new Date());
        });
    };

    $scope.isObjectEmpty = function(obj){
        if (obj == null) {
            return true;
        }
        return Object.keys(obj).length === 0;
    };

    // synonym sources

    $scope.newSynonymSource = function() {
        return $scope.editSynonymSource("", {
        });
    };

    $scope.editSynonymSource = function(name, value, viewOnlyIn) {
        var viewOnlyModal = $scope.viewOnlyModal = viewOnlyIn || viewOnly;
        var modalInstance = $uibModal.open({
          scope: $scope,
          animation: $scope.animationsEnabled,
          template: synonymsourceTemplate,
          controller: 'BleveSynonymSourceModalCtrl',
          resolve: {
            name: function() {
                return name;
            },
            value: function() {
                return value;
            },
            mapping: function() {
                return $scope.indexMapping;
            },
            languages: function() {
                return null;
            },
            static_prefix: function() {
                return $scope.static_prefix;
            },
            viewOnlyModal: function() {
                return viewOnlyModal;
            }
          }
        });

        modalInstance.result.then(function(result) {
            $scope.viewOnlyModal = false;
            // add this result to the mapping
            for (var resultKey in result) {
                if (name !== "" && resultKey != name) {
                    // remove the old name
                    delete $scope.indexMapping.analysis.synonym_sources[name];
                }
                $scope.indexMapping.analysis.synonym_sources[resultKey] =
                    result[resultKey];

                // reload available synonym sources
                var lan =
                    $scope.loadSynonymSources ||
                    $scope.$parent.loadSynonymSources;
                if (lan) {
                    lan();
                }
            }
        }, function() {
          $scope.viewOnlyModal = false;
          $log.info('Modal dismissed at: ' + new Date());
        });
    };

    $scope.deleteSynonymSource = function(name) {
        confirmDialog(
            $scope, $uibModal,
            "Confirm Delete Synonym Source",
            "Are you sure you want to delete '" + name + "'?",
            "Delete Synonym Source"
        ).then(function success() {
            delete $scope.indexMapping.analysis.synonym_sources[name]
        });
    };
}
