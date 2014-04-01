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
 * @param {Analyst.PatheryGraph} graph
 * @param {Number[][]} initialSolution
 * @param {{workerEnv: Object}} options
 * @param {Function} onNewTopScoreCallback
 * @returns {ChildProcess} For convenience, returns the process corresponding to the worker; in general, however, this should not be used.
 */
module.exports.startWorker = function (graph, initialSolution, options, onNewTopScoreCallback) {
  var worker = ChildProcess.fork(__dirname + '/worker.js', { env: (options.workerEnv) });

  if(MonitoringServer) {
    MonitoringServer.registerWorker(worker);
  }

  worker.send({
    name: 'solve',
    params: {
      board: graph.board,
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

module.exports.terminate = function () {
  workers.forEach(function (worker) {
    worker.kill();
  });

  if(MonitoringServer) {
    MonitoringServer.stop();
  }
};
