// TODO: Display HTML more prettily.
// TODO: Various derived statistics.
// TODO: Visually display the score distributions.
// TODO: Summary for all workers.
// TODO: Interval summaries (e.g. last full minute, 5 minutes, hour).
// TODO: Something additional on exhaustive start...not sure what though.
// TODO: Track statistics on improvement by exhaustive search.

var http = require('http');

var _ = require('underscore');

/** @variable {net.Server} */
var httpServer = null;

/** @variable {WorkerJournal[]} */
var workerJournals = [];

/**
 *
 * @param {Number} port
 */
module.exports.start = function (port) {
  if(httpServer) {
    throw new Error();
  } else {
    httpServer = http.createServer(function (request, response) {
      // TODO: /index.html and /index.json.
      if(request.url === '/' && request.method === 'GET') {
        var responseBody = JSON.stringify(
            {
              workers: _.object(workerJournals.map(function (workerJournal) {
                return [
                  workerJournal.worker.pid,
                  workerJournal.getReport()
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
      // TODO: Automatically increment ports if taken?
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
    var workerJournal = new WorkerJournal(worker);

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
// WorkerJournal

/**
 *
 * @param {ChildProcess} worker
 * @constructor
 */
function WorkerJournal(worker) {
  this.worker = worker;

  this.annealingDistribution = new ScoringDistribution();
  this.annealingRunTime = 0;
  this.annealingTopScoreInfo = null;

  this.exhaustiveDistribution = new ScoringDistribution();
  this.exhaustiveRunTime = 0;
  this.exhaustiveTopScoreInfo = null;

  this.lastMessage = null;
}

WorkerJournal.prototype.getReport = function () {
  return {
    annealing: {
      statistics: this.annealingDistribution.getStatistics(),
      runTime: this.annealingRunTime,
      topScoreInfo: this.annealingTopScoreInfo
    },
    exhaustive: {
      statistics: this.exhaustiveDistribution.getStatistics(),
      runTime: this.exhaustiveRunTime,
      topScoreInfo: this.exhaustiveTopScoreInfo
    },
    lastMessage: this.lastMessage
  }
};

/**
 *
 * @param {Object} monitoringMessage
 */
WorkerJournal.prototype.onMonitoringUpdateMessage = function (monitoringMessage) {
  if(monitoringMessage.type === 'annealing') {
    if(monitoringMessage.action === 'start') {
      // Do nothing.
    } else if(monitoringMessage.action === 'finish') {
      this.annealingDistribution.notify(monitoringMessage.score);

      if(this.lastMessage.type !== 'annealing' || this.lastMessage.action !== 'start') {
        console.error.log('bad message order:', this.lastMessage);
      } else {
        this.annealingRunTime += monitoringMessage.time - this.lastMessage.time;
      }

      if(this.annealingTopScoreInfo === null || monitoringMessage.score > this.annealingTopScoreInfo.score) {
        this.annealingTopScoreInfo = {
          score: monitoringMessage.score,
          time: monitoringMessage.time
        }
      }
    } else {
      throw new Error('unknown monitoring message action: ' + monitoringMessage.action);
    }
  } else if(monitoringMessage.type === 'exhaustive') {
    if(monitoringMessage.action === 'start') {
      // Do nothing.
    } else if(monitoringMessage.action === 'finish') {
      this.exhaustiveDistribution.notify(monitoringMessage.score);

      if(this.lastMessage.type !== 'exhaustive' || this.lastMessage.action !== 'start') {
        console.error.log('bad message order:', this.lastMessage);
      } else {
        this.exhaustiveRunTime += monitoringMessage.time - this.lastMessage.time;
      }

      if(this.exhaustiveTopScoreInfo === null || monitoringMessage.score > this.exhaustiveTopScoreInfo.score) {
        this.exhaustiveTopScoreInfo = {
          score: monitoringMessage.score,
          time: monitoringMessage.time
        }
      }
    } else {
      throw new Error('unknown monitoring message action: ' + monitoringMessage.action);
    }
  } else {
    throw new Error('unknown monitoring message type: ' + monitoringMessage.type);
  }

  this.lastMessage = monitoringMessage;
};
