var ChildProcess = require('child_process');

var ExploratoryUtilities = require('./../../exploratory-utilities.js');

var MonitoringServer = (function () {
  var monitorPort = ExploratoryUtilities.configuration.monitorPort;

  if(monitorPort) {
    var ret = require('./../monitoring/server.js');

    ret.start(monitorPort);

    return ret;
  } else {
    return null;
  }
})();

var workers = [];

/**
 * Create a new worker solving the specified map.
 *
 * @param {Map} map
 * @param {Number[][]} initialSolution
 * @param {{workerEnv: Object}} options
 * @param {Function} onNewTopScoreCallback
 * @returns {ChildProcess} For convenience, returns the process corresponding to the worker; in general, however, this should not be used.
 */
module.exports.startWorker = function (map, initialSolution, options, onNewTopScoreCallback) {
  var worker = ChildProcess.fork(__dirname + '/worker.js', { env: (options.workerEnv) });

  if(MonitoringServer) {
    MonitoringServer.registerWorker(worker, map);
  }

  worker.send({
    name: 'solve',
    params: {
      board: map.board,
      initialSolution: initialSolution,
      options: options
    }
  });

  worker.on('message', function (message) {
    switch(message.name) {
      case 'new-result':
        onNewTopScoreCallback(message.params);
    }
  });

  workers.push(worker);

  return worker;
};

module.exports.stopAll = function () {
  module.exports.stopWorkers();
  module.exports.stopMonitoringServer();
};

module.exports.stopMonitoringServer = function () {
  if(MonitoringServer) {
    MonitoringServer.stop();
  }
};

module.exports.stopWorkers = function () {
  workers.forEach(function (worker) {
    worker.kill();
  });
};

/**
 * Write a a report from Solver.Monitoring.Server (if it is running) to the specified directory.
 *
 * @param {String} monitoringReportDirectory
 * @param {Function} onDoneCallback - No arguments. Called on success and failure.
 */
module.exports.writeMonitoringReport = function (monitoringReportDirectory, onDoneCallback) {
  if(MonitoringServer && MonitoringServer.serverPort) {
    var FS = require('fs');
    var http = require('http');

    var request = http.request(
        {
          hostname: 'localhost',
          path: '/index.html',
          port: MonitoringServer.serverPort
        },
        function (response) {
          var buffer = '';

          response.setEncoding('utf8');

          response.on('data', function (chunk) {
            buffer += chunk;
          });

          response.on('end', function () {
            if(response.statusCode === 200) {
              try {
                var monitoringReportPath = monitoringReportDirectory + '/report.' + Date.now() + '.html';

                FS.writeFileSync(monitoringReportPath, buffer);
              } catch(e) {
                console.warn('Failed to write monitoring report: ' + e);
              }

              onDoneCallback();
            } else {
              console.warn('Failed to read monitoring report: ' + response.statusCode);

              onDoneCallback();
            }
          });
        }
    );

    request.end();
  } else {
    onDoneCallback();
  }
};
