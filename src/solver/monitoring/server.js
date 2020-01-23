// TODO: Various derived statistics.
// TODO: Interval summaries (e.g. last full minute, 5 minutes, hour).
// TODO: Something additional on exhaustive start...not sure what though.
// TODO: Track statistics on improvement by exhaustive search.

var FS = require('fs');
var http = require('http');

var HamlJS = require('hamljs');
// var Sass = require('node-sass');
var strftime = require('strftime');

var WorkerJournal = require('./server/worker-journal.js');

/**
 * The maximum number of times to attempt to listen on a new port.
 *
 * @constant {Number}
 */
const MAX_LISTEN_ATTEMPTS = 20;

/** @variable {net.Server} */
var httpServer = null;

/** @variable {WorkerJournal[]} */
var workerJournals = [];

/**
 * Render the index.html.haml template, passing the final content to the provided onSuccessCallback.
 *
 * @param {Function} onSuccessCallback
 * @param {Function} onErrorCallback
 */
module.exports.renderIndexHTML = function (onSuccessCallback, onErrorCallback) {
  FS.readFile(__dirname + '/server/index.html.haml', { encoding: 'utf8' }, function (readIndexTemplateErr, indexTemplateContent) {
    if(readIndexTemplateErr) {
      onErrorCallback(readIndexTemplateErr);
    } else {
      FS.readFile(__dirname + '/server/assets/index.js', { encoding: 'utf8' }, function (readIndexJavaScriptErr, indexJavaScriptContent) {
        if(readIndexJavaScriptErr) {
          onErrorCallback(readIndexJavaScriptErr);
        } else {
          Sass.render({
            file: __dirname + '/server/assets/index.css.scss',
            error: onErrorCallback,
            success: function (indexCSSContent) {
              var indexHTMLContent;
              var hamlError;
              var aggregatedWorkerJournal;
              var combinedWorkerJournals;

              if(workerJournals.length === 0) {
                aggregatedWorkerJournal = null;
                combinedWorkerJournals = [];
              } else if(workerJournals.length === 1) {
                aggregatedWorkerJournal = workerJournals[0];
                combinedWorkerJournals = [aggregatedWorkerJournal];
              } else {
                aggregatedWorkerJournal = new WorkerJournal(null, workerJournals[0].map);

                for(var i = 0; i < workerJournals.length; i++) {
                  aggregatedWorkerJournal.merge(workerJournals[i]);
                }

                combinedWorkerJournals = [aggregatedWorkerJournal].concat(workerJournals);
              }

              try {
                indexHTMLContent = HamlJS.render(indexTemplateContent, {
                  locals: {
                    aggregatedWorkerJournal: aggregatedWorkerJournal,
                    combinedWorkerJournals: combinedWorkerJournals,
                    indexCSSContent: indexCSSContent,
                    indexJavaScriptContent: indexJavaScriptContent,
                    strftime: strftime
                  }
                });
              } catch(e) {
                hamlError = e;
              }

              if(hamlError) {
                onErrorCallback(hamlError);
              } else {
                onSuccessCallback(indexHTMLContent);
              }
            }
          });
        }
      });
    }
  });
};

/**
 *
 * @param {Number} initialPort
 */
module.exports.start = function (initialPort) {
  if(httpServer) {
    throw new Error();
  } else {
    httpServer = http.createServer(function (request, response) {
      if(request.url === '/' && request.headers['Accept'] === 'application/json' || request.url === '/index.json') {
        if(request.method === 'GET') {
          response.writeHead(200, { 'Content-Type': 'application/json' });
          response.end(
              JSON.stringify({
                workerJournals: workerJournals.map(function (workerJournal) { return workerJournal.serializableHash(); })
              })
          );
        } else {
          response.writeHead(405, { Allow: 'GET' });
          response.end();
        }
      } else if(request.url === '/' || request.url === '/index.html') {
        if(request.method === 'GET') {
          module.exports.renderIndexHTML(
              function (indexHTMLContent) {
                response.writeHead(200, { 'Content-Type': 'text/html; charset=UTF-8' });
                response.end(indexHTMLContent);
              },
              function (err) {
                console.error(err);

                response.writeHead(500, { 'Content-Type': 'text/html; charset=UTF-8' });
                response.end('error: ' + err);
              }
          );
        } else {
          response.writeHead(405, { Allow: 'GET' });
          response.end();
        }
      } else {
        response.writeHead(404, { 'Content-Type': 'text/plain' });
        response.end('Only /index.html and /index.json served.');
      }
    });

    (function () {
      var currentPort = initialPort;

      httpServer.on('error', onServerError);
      httpServer.on('listening', onServerListening);

      // N.B.: Totally unsecure...**do not** open to the outside world.
      httpServer.listen(currentPort, 'localhost');

      ////////////////////
      // Event handlers.

      function onServerError(e) {
        if(e.errno === 'EADDRINUSE' && currentPort < initialPort + MAX_LISTEN_ATTEMPTS) {
          console.warn('Monitoring server failed to start on port ' + currentPort + '; attempting on port ' + ++currentPort);

          // N.B.: Totally unsecure...**do not** open to the outside world.
          httpServer.listen(currentPort, 'localhost');
        } else {
          console.error('Monitoring server failed to start on port ' + currentPort + ':', e);

          httpServer.removeListener('error', onServerError);
          httpServer.removeListener('listening', onServerListening);
        }
      }

      function onServerListening() {
        console.log('Monitoring server started at http://localhost:' + currentPort + '/index.html');

        httpServer.removeListener('error', onServerError);
        httpServer.removeListener('listening', onServerListening);
      }
    })();
  }
};

module.exports.stop = function () {
  httpServer.close();

  httpServer = null;
};

/**
 *
 * @param {ChildProcess} worker
 * @param {Map} map
 */
module.exports.registerWorker = function (worker, map) {
  if(!httpServer) {
    throw new Error();
  } else {
    var workerJournal = new WorkerJournal(worker, map);

    workerJournals.push(workerJournal);

    worker.send({ name: 'monitoring-enable' });

    worker.on('message', function (message) {
      switch(message.name) {
        case 'monitoring-update':
          workerJournal.onMonitoringUpdateMessage(message.params);
      }
    })
  }
};
