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
      mapAttributes: map.serializableHash(),
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
 * @param {String} monitoringReportPath
 * @param {Function} onDoneCallback - No arguments. Called on success and failure.
 */
module.exports.writeMonitoringReport = function (monitoringReportPath, onDoneCallback) {
  if(MonitoringServer) {
    var FS = require('fs');

    MonitoringServer.renderIndexHTML(
        function (indexHTMLContent) {
          FS.writeFile(monitoringReportPath, indexHTMLContent, function (err) {
            if(err) {
              console.warn('Failed to write monitoring report:', err);
            }

            onDoneCallback();
          });
        },
        function (err) {
          console.warn('Failed to generate monitoring report:', err);

          onDoneCallback();
        }
    );
  } else {
    onDoneCallback();
  }
};
