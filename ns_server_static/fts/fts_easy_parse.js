//  Copyright 2020-Present Couchbase, Inc.
//
//  Use of this software is governed by the Business Source License included
//  in the file licenses/BSL-Couchbase.txt.  As of the Change Date specified
//  in that file, in accordance with the Business Source License, use of this
//  software will be governed by the Apache License, Version 2.0, included in
//  the file licenses/APL2.txt.

function newParsedDocs() {
    var parsedDocs = {};
    var parsedXattrsDocs = {};

    return {
        getParsedDocForCollection: function (collectionName, xattrs) {
            if (!(collectionName in parsedDocs)) {
                parsedDocs[collectionName] = parseDocument('{}', null);
            }
            if (xattrs) {
                return parsedXattrsDocs[collectionName];
            }
            return parsedDocs[collectionName];
        },
        setDocForCollection: function (collectionName, src, xattrs) {
            parsedDocs[collectionName] = parseDocument(src, null);
            parsedXattrsDocs[collectionName] = parseDocument(src, xattrs)
        }
    }
}

function parseDocument(doc, xattrs) {

    var parseStack = [];
    var keysStack = [];
    var rowPaths = [];
    var rowTypes = [];
    var count = 0;
    var valsSincePop = 0;
    var dims = {};

    var replacer = function (key, value) {
        // on closing brace, pop stack, duplicate last entry for rowpaths
        while ((parseStack.length > 0) && (this !== parseStack[parseStack.length - 1])) {
            parseStack.pop();
            keysStack.pop();

            if (valsSincePop > 1) {
                rowPaths.push(rowPaths[rowPaths.length - 1]);
                rowTypes.push(rowTypes[rowTypes.length - 1]);
                valsSincePop--;
            }
        }
        var ks = keysStack;
        var keysCopy = [];

        // copy non-numeric elements from keys stack
        // this builds correct path traversing arrays
        for (var i = 0; i < ks.length; i++) {
            if (isNaN(ks[i])) {
                keysCopy.push(ks[i]);
            }
        }
        if (isNaN(key)) {
            keysCopy.push(key);
        }
        var fullPath = keysCopy.join(".");

        // if object, push onto stack
        var valType = typeof value;
        if (valType === "object") {
            parseStack.push(value);
            keysStack.push(key);
            valsSincePop = 0;
        }

        // for any row other than the first, push the path onto rowPaths
        if (count != 0) {
            rowPaths.push(fullPath);
            rowTypes.push(valType);
        }
        // this is the second row, push an extra to fix up opening brace case
        if (count == 1) {
            rowPaths.push(fullPath);
            rowTypes.push(valType);
        }

        count++;
        valsSincePop++;
        return value;
    };

    var parsedObj;
    try {
        parsedObj = JSON.parse(doc)
    } catch (e) {
        console.log("error parsing json", e)
    }

    if (xattrs != null && Object.keys(xattrs) != 0) {
        var parsedXattrs = {}
        for (const [key, val] of Object.entries(xattrs)) {
            if (!key.startsWith('_') && key != "txn") {
                parsedXattrs[key] = val
            }
        }
        if (Object.keys(parsedXattrs) != 0) {
            parsedObj["_$xattrs"] = parsedXattrs
        }
    }

    var docString = JSON.stringify(parsedObj || "", replacer, 2);

    while (parseStack.length > 0) {
        parseStack.pop();
        keysStack.pop();
        rowPaths.push(rowPaths[rowPaths.length - 1]);
        rowTypes.push(rowTypes[rowTypes.length - 1]);
    }

    return {
        getPath: function (col) {
            return rowPaths[col];
        },
        getType: function (col) {
            // check whether the object is a nested geojson shape.
            if (rowTypes[col] === "object" &&
                col < rowPaths.length - 2 && col < rowTypes.length - 2) {

                var childPath1 = rowPaths[col + 1].toLowerCase()
                var childPath2 = rowPaths[col + 2].toLowerCase()
                var typeField = rowPaths[col] + ".type"
                var coordField = rowPaths[col] + ".coordinates"
                var gcField = rowPaths[col] + ".geometries"

                if (childPath1.includes(typeField)) {
                    if (childPath2.includes(coordField) ||
                        childPath2.includes(gcField)) {
                        return "geoshape"
                    }
                } else if (childPath2.includes(typeField)) {
                    if (childPath1.includes(coordField) ||
                        childPath1.includes(gcField)) {
                        return "geoshape"
                    }
                }
            }

            // check whether the object is a vector
            if (rowTypes[col] === "object") {
                var numDims = 0
                var path = rowPaths[col]
                var nestDepth = rowPaths[col].split(".").length
                for (let i = col+1; i < rowTypes.length - 1; i++) {
                    if ((rowPaths[i] == path) && (rowTypes[i] == 'number')) {
                        numDims++
                    } else {
                        break
                    }
                }
                if (numDims > 1) {
                    dims[col] = numDims - nestDepth
                    return "vector"
                }
            }

            // check whether the object is a vector_base64
            if (rowTypes[col] === "string") {
                var vecLen = parseBase64Length(parsedObj[rowPaths[col]])
                if (vecLen > 2) {
                    dims[col] = vecLen
                    return "vector_base64"
                }
            }

            return rowTypes[col];
        },
        getDocument: function () {
            return docString;
        },
        getRow: function (path) {
            for (var i = 1; i < rowPaths.length; i++) {
                if (rowPaths[i] == path) {
                    return i;
                }
            }
            return 1;
        },
        getDims: function (col) {
            return dims[col]
        }
    };
}

function parseBase64Length(str) {
    try {
        var vecStr = atob(str)
        return vecStr.length / 4
    } catch {
        return -1
    }
}

export { newParsedDocs };
