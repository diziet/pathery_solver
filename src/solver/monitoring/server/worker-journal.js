var SolverStageJournal = require('./solver-stage-journal.js');

/**
 *
 * @constructor WorkerJournal
 *
 * @param {ChildProcess} worker
 */
var WorkerJournal = module.exports = function (worker) {
  this.worker = worker;
  this.startTime = new Date();

  this.annealingJournal = new SolverStageJournal();
  this.exhaustiveJournal = new SolverStageJournal();

  this.lastMessage = null;
};

/**
 *
 * @param {Object} monitoringMessage
 */
WorkerJournal.prototype.onMonitoringUpdateMessage = function (monitoringMessage) {
  var solverStageJournal;

  monitoringMessage.time = new Date(monitoringMessage.time);

  if(monitoringMessage.type === 'annealing') {
    solverStageJournal = this.annealingJournal;
  } else if(monitoringMessage.type === 'exhaustive') {
    solverStageJournal = this.exhaustiveJournal;
  } else {
    throw new Error('unknown monitoring message type: ' + monitoringMessage.type);
  }

  if(monitoringMessage.action === 'start') {
    solverStageJournal.notifyStarted(monitoringMessage.time);
  } else if(monitoringMessage.action === 'finish') {
    solverStageJournal.notifyFinished(monitoringMessage.time, monitoringMessage.score);
  } else {
    throw new Error('unknown monitoring message action: ' + monitoringMessage.action);
  }

  this.lastMessage = monitoringMessage;
};

WorkerJournal.prototype.serializableHash = function () {
  return {
    workerPID: this.worker.pid,
    startTime: this.startTime,
    annealingJournal: this.annealingJournal.serializableHash(),
    exhaustiveJournal: this.exhaustiveJournal.serializableHash(),
    lastMessage: this.lastMessage
  }
};

/**
 * Convenience mechanism to get the top score from between the annealing journal and exhaustive journal.
 *
 * @returns {{score: Number, time: Date}}
 */
WorkerJournal.prototype.getTopScoreInfo = function () {
  if(this.annealingJournal.isBlank()) {
    return null;
  } else {
    var annealingTopScore = this.annealingJournal.scoringDistribution.max;
    var exhaustiveTopScore = !this.exhaustiveJournal.isBlank() && this.exhaustiveJournal.scoringDistribution.max;

    if(exhaustiveTopScore && (exhaustiveTopScore > annealingTopScore || (exhaustiveTopScore === annealingTopScore && this.exhaustiveJournal.topScoreTime < this.annealingJournal.topScoreTime))) {
      return {
        score: exhaustiveTopScore,
        time: this.exhaustiveJournal.topScoreTime
      }
    } else {
      return {
        score: annealingTopScore,
        time: this.annealingJournal.topScoreTime
      }
    }
  }
};
