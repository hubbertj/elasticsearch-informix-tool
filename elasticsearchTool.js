"use strict";
var program = require('commander');
var PropertiesReader = require('properties-reader');

var events = require('events');
var eventEmitter = new events.EventEmitter();

var elasticsearch = require('elasticsearch');
var childProcess = require('child_process');
var path = require('path');
const PROPERTIES = PropertiesReader('./config/application.properties');
const JAR_NAME = PROPERTIES.get('elasticsearch.jar_name') || 'data_ingress.jar';
var client = null;
var fs = require('fs');
var defaultJsonDataFileName = "FilterDataList.json";
var sleep = require('thread-sleep');
var clientOptions = {
    host: PROPERTIES.get('elasticsearch.server') + ':9200',
    apiVersion: '5.3',
    log: ['error'],
    httpAuth: PROPERTIES.get('elasticsearch.username'),
    ssl: {
        cert: fs.readFileSync(path.join(__dirname, PROPERTIES.get('elasticsearch.ssl.cert'))),
        key: fs.readFileSync(path.join(__dirname, PROPERTIES.get('elasticsearch.ssl.certkey'))),
        rejectUnauthorized: false
    },
    deadTimeout: 600000,
    requestTimeout: 9999999,
    keepAlive: true
};
var startCount = 0;
var systemErrors = [];
var systemCreated = [];


/**
 * prints the system report
 * @return {[type]} [description]
 */
var showSystemReport = function() {
    if (systemErrors.length > 0) {
        console.log(JSON.stringify(systemErrors));
    }

    console.log('-------------------------------------------------------');
    console.log('# of Processed documents = %s', startCount);
    if(program.hasOwnProperty('update')){
        console.log('# of documents created = %s', systemCreated.length);
    }
    console.log('# of Errors in processing = %s', systemErrors.length);
    console.log('# of Success in processing = %s', (startCount - systemErrors.length));
};

/**
 * Create a new index and inserts a fake row 1;
 * @param  {[type]} indexName [description]
 * @return {[String]} Name of the index which was created.
 */
var createIndex = function(indexName, documentType, serverUri) {

    return new Promise(function(resolve, reject) {
        new Promise(function(res, rej) {
            client.ping({ requestTimeout: 1000 },
                function(error) {
                    if (error) {
                        return rej('Elasticsearch cluster...\t\tFAILED', error);
                    } else {
                        return res('Elasticsearch server...\t\tOK');
                    }
                });
        }).then(function(msg) {
            console.log(msg);
            console.log('Creating new index...\t\t%s', indexName);
            return new Promise(function(resolve, reject) {
                client.create({
                    index: indexName,
                    type: documentType,
                    id: 1,
                    body: {}
                }, function(error, response) {
                    if (error) {
                        return reject(error);
                    }
                    return resolve(response);
                });
            });
        }).then(function(results) {
            //deletes fake row
            return new Promise(function(resolve, reject) {
                client.delete({
                    index: indexName,
                    type: documentType,
                    id: 1
                }, function(error, response) {
                    if (error) {
                        return reject(error);
                    }
                    return resolve(response);
                });
            });
        }).then(function(res) {
            if (res.hasOwnProperty('_index') && res._index) {
                return resolve(res._index);
            } else {
                return new Promise(function(aResolve, aReject) {
                    return aReject('Elasticsearch server...\t\tFAILED TO GET CREATE RESPOND BACK')
                });
            }
        }).catch(function(errorMsg, err) {
            return reject(errorMsg, err);
        });
    });
};

/**
 * Updates into elk serach using recursive in the callback;
 * @param  {[type]} indexName    [description]
 * @param  {[type]} documentType [description]
 * @param  {[type]} masterKey    [description]
 * @param  {[type]} jsonDataList [description]
 * @param  {[type]} serverUri    [description]
 * @return {[type]}              [description]
 */
var updateDataIntoIndex = function(indexName, documentType, masterKey, jsonDataList, serverUri) {
    if (jsonDataList.length > 0) {
        var documen = jsonDataList.pop();
        if (documen) {
            client.get({
                index: indexName,
                type: documentType,
                id: documen[masterKey]
            }, function(err, response) {
                // if we error doc doesn't exist;
                if (err) {
                    systemCreated.push(documen);
                    client.create({
                        index: indexName,
                        type: documentType,
                        id: documen[masterKey],
                        body: documen
                    }, function(error, resp) {
                        if (error) {
                            console.error(error);
                            systemErrors.push(error);
                        }
                        console.log(JSON.stringify(resp));
                        updateDataIntoIndex(indexName, documentType, masterKey, jsonDataList, serverUri);
                    });
                } else {
                    updateDataIntoIndex(indexName, documentType, masterKey, jsonDataList, serverUri);
                }
            });
        }
    } else {
        showSystemReport();
    }
};

/**
 * Inserts into elk serach using recursive in the callback;
 * @param  {[type]} indexName    [description]
 * @param  {[type]} documentType [description]
 * @param  {[type]} masterKey    [description]
 * @param  {[type]} jsonDataList [description]
 * @param  {[type]} serverUri    [description]
 * @return {[type]}              [description]
 */
var insertDataIntoIndex = function(indexName, documentType, masterKey, jsonDataList, serverUri) {
    if (jsonDataList.length > 0) {
        var tmp = [];
        for (var x = 0; x < 3; x++) {
            var documen = jsonDataList.pop();
            if (documen) {
                tmp.push({
                    create: {
                        _index: indexName,
                        _type: documentType,
                        _id: documen[masterKey]
                    }
                });
                tmp.push(documen);
            }
        }

        client.bulk({
            body: tmp
        }, function(err, resp) {
            if (err) {
                console.error(err);
                systemErrors.push(err);
            } else {
                console.log(JSON.stringify(resp));
            }

            insertDataIntoIndex(indexName, documentType, masterKey, jsonDataList, serverUri);
        });

    } else {
        showSystemReport();
    }
};

eventEmitter.on('onForce', insertDataIntoIndex);


program.arguments('<file>')
    .option('-f, --force  <indexName>', 'Use if you want to specify the index. And want to skip the data gather process.')
    .option('-c, --create <indexName>', 'When used this will create a new index and insert the new documents')
    .option('-u, --update <indexName>', 'When used this will try to update the index and insert the new documents.').parse(process.argv);

/**
 * Main running argument
 * @return {null}
 */
var main = function() {
    var indexName = PROPERTIES.get('elasticsearch.indexname');
    var server = PROPERTIES.get('elasticsearch.server');
    var documentType = PROPERTIES.get('elasticsearch.documentType');
    var masterKey = PROPERTIES.get('elasticsearch.documentId');
    var doCreate = false;
    client = new elasticsearch.Client(clientOptions);

    if (program.hasOwnProperty('force') && program.force) {
        var jsonDataList = JSON.parse(fs.readFileSync(__dirname + PROPERTIES.get('elasticsearch.searchable.log.dir') + defaultJsonDataFileName));
        startCount = jsonDataList.length;
        console.log("Found %s documents", startCount);
        sleep(300);
        eventEmitter.emit('onForce', program.force, documentType, masterKey, jsonDataList, server);
        return;
    }

    var jarPath = path.join(__dirname, JAR_NAME);
    var aPromise = new Promise(function(resolve, reject) {
        console.log("Working please wait..");
        var child = childProcess.exec('java -jar ' + jarPath, { maxBuffer: 1024 * 1000 },
            function(error, stdout, stderr) {
                if (error !== null) {
                    return reject(error, stderr);
                }
                console.log(stdout);
                console.log("Retrieved json file please wait...\t\t");
                console.log("Saving JSON to file...\t\t")
                // sleep(30000);
                return resolve(true);
            });
    }).then(function(result) {
        var jsonDataList = JSON.parse(fs.readFileSync(__dirname + PROPERTIES.get('elasticsearch.searchable.log.dir') + defaultJsonDataFileName));
        startCount = jsonDataList.length;
        console.log("Found %s documents", startCount);
        sleep(300);
        if (program.rawArgs.length === 2) {
            console.log('No arguments passed in, using defaults: indexName: %s, server: %s, create_index: %s', indexName, server, doCreate);
            insertDataIntoIndex(indexName, documentType, masterKey, jsonDataList, server);
        } else if (program.hasOwnProperty('create') && program.create) {
            createIndex(program.create, documentType, server)
                .then(function(newIndexName) {
                    insertDataIntoIndex(newIndexName, documentType, masterKey, jsonDataList, server);
                });
        } else if (program.hasOwnProperty('update') && program.update) {
            updateDataIntoIndex(program.update, documentType, masterKey, jsonDataList, server);
        } else {
            insertDataIntoIndex(program.index, documentType, masterKey, jsonDataList, server);
        }
    }).catch(function(error, output) {
        console.error(error);
    });
}();