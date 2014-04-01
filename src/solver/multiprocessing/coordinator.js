var ChildProcess = require('child_process');

var workers = [];

/**
 * Create a new worker solving the specified map.
 *
 * @param {Analyst.PatheryGraph} graph
 * @param {Number[][]} initialSolution
 * @param {Object} options
 * @param {Function} onNewTopScoreCallback
 * @returns {ChildProcess} For convenience, returns the process corresponding to the worker; in general, however, this should not be used.
 */
module.exports.startWorker = function (graph, initialSolution, options, onNewTopScoreCallback) {
  var worker = ChildProcess.fork(__dirname + '/worker.js', { env: (options.workerEnv) });

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

        break;
      default:
        throw new Error('unknown message from child: ' + message.name);
    }
  });

  workers.push(worker);

  return worker;
};

module.exports.stopWorkers = function () {
  workers.forEach(function (worker) {
    worker.kill();
  });
};
