var http = require('http');

var _ = require('underscore');

/** @variable {net.Server} */
var httpServer = null;

/** @variable {WorkerStatistics[]} */
var workersStatistics = [];

/**
 *
 * @param {Number} port
 */
module.exports.start = function (port) {
  if(httpServer) {
    throw new Error();
  } else {
    httpServer = http.createServer(function (request, response) {
      if(request.url === '/' && request.method === 'GET') {
        var responseBody = JSON.stringify(
            {
              workers: _.object(workersStatistics.map(function (workerStatistics) {
                return [
                  workerStatistics.process.pid,
                  workerStatistics.getStatistics()
                ];
              }))
            },
            null,
            " "
        );

        response.writeHead(200, { "Content-Type": 'application/json' });
        response.end(responseBody);
      } else {
        response.writeHead(400, { "Content-Type": 'text/plain' });
        response.end('Bad request - only GET to / is allowed.');
      }
    });

    httpServer.on('error', function (e) {
      console.error('Monitoring server failed to start on port ' + port + ':', e);
    });

    httpServer.listen(port, function () {
      console.log('Monitoring server started at http://localhost:' + port + '/');
    });
  }
};

module.exports.stop = function () {
  httpServer.close();

  httpServer = null;
};

/**
 *
 * @param {ChildProcess} worker
 */
module.exports.registerWorker = function (worker) {
  if(!httpServer) {
    throw new Error();
  } else {
    var workerStatistics = new WorkerStatistics(process);

    workersStatistics.push(workerStatistics);

    worker.send({ name: 'monitoring-enable' });

    worker.on('message', function (message) {
      switch(message.name) {
        case 'monitoring-update':
          workerStatistics.onMonitoringUpdateMessage(message.params);
      }
    })
  }
};

////////////////////////////////////////////////////////////////////////////////
// ScoringDistribution

function ScoringDistribution() {
  this.distribution = [];
}

ScoringDistribution.prototype.getStatistics = function () {
  var min = null;
  var max = null;
  var total = 0;
  var sum = 0;

  for(var i = 0; i < this.distribution.length; i++) {
    var count = this.distribution[i];

    if(count) {
      if(min === null || i < min) {
        min = i;
      }

      if(max === null || i > max) {
        max = i;
      }

      total += count;
      sum += count * i;
    }
  }

  return {
    min: min,
    max: max,
    total: total,
    average: sum / total
  }
};

/**
 *
 * @param {Number} score
 */
ScoringDistribution.prototype.notify = function (score) {
  this.distribution[score] = (this.distribution[score] || 0) + 1;
};

////////////////////////////////////////////////////////////////////////////////
// WorkerStatistics

/**
 *
 * @param {ChildProcess} process
 * @constructor
 */
function WorkerStatistics(process) {
  this.process = process;
  this.annealingDistribution = new ScoringDistribution();
  this.exhaustiveDistribution = new ScoringDistribution();
}

WorkerStatistics.prototype.getStatistics = function () {
  return {
    annealing: this.annealingDistribution.getStatistics(),
    exhaustive: this.exhaustiveDistribution.getStatistics()
  }
};

/**
 *
 * @param {*} messageParams
 */
WorkerStatistics.prototype.onMonitoringUpdateMessage = function (messageParams) {
  var updateType = messageParams[0];

  switch(updateType) {
    case 'annealing':
      this.annealingDistribution.notify(messageParams[1]);

      break;
    case 'exhaustive':
      this.exhaustiveDistribution.notify(messageParams[1]);

      break;
    default:
      throw new Error('unknown monitoring message type:', updateType);
  }
};
