var _ = require('underscore');

var SolverStageJournal = require('./solver-stage-journal.js');

/**
 *
 * @constructor WorkerJournal
 *
 * @param {ChildProcess} worker
 * @param {Map} map
 */
var WorkerJournal = module.exports = function (worker, map) {
  this.worker = worker;
  this.map = map;
  this.startTime = new Date();

  /** @member {SolverStageJournal} */
  this.annealingJournal = new SolverStageJournal();

  /** @member {SolverStageJournal} */
  this.exhaustiveJournal = new SolverStageJournal();

  this.lastMessage = null;
};

/**
 * Merge a WorkerJournal into this one. The current WorkerJournal will be mutated.
 *
 * @param {WorkerJournal} other
 */
WorkerJournal.prototype.merge = function (other) {
  if(this.worker !== null) {
    throw new Error('A WorkerJournal may only be merged into if it does not have a worker.');
  }

  if(this.map.id != other.map.id) {
    throw new Error('WorkerJournals may only be merged if they have the same map.');
  }

  if(this.startTime === null || other.startTime < this.startTime) {
    this.startTime = other.startTime;
  }

  this.annealingJournal.merge(other.annealingJournal);
  this.exhaustiveJournal.merge(other.exhaustiveJournal);

  if(this.lastMessage === null || other.lastMessage.time > this.lastMessage.time) {
    this.lastMessage = _.extend({}, other.lastMessage);
  }
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
    workerPID: this.worker && this.worker.pid,
    mapId: this.map.id,
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
  return this.annealingJournal.getCombinedTopScoreInfo(this.exhaustiveJournal);
};
