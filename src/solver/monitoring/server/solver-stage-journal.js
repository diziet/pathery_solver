var ScoringDistribution = require('./scoring-distribution.js');

var SolverStageJournal = module.exports = function () {
  this.scoringDistribution = new ScoringDistribution();
  this.runTime = 0;
  this.topScoreTime = null;

  /**
   *
   * @member {Date}
   * @private
   */
  this._startedTime = null;
};

/**
 * Have any scores been processed yet?
 *
 * @returns {Boolean}
 */
SolverStageJournal.prototype.isBlank = function () {
  return this.topScoreTime === null;
};

/**
 *
 * @param {Date} time
 */
SolverStageJournal.prototype.notifyStarted = function (time) {
  if(this._startedTime) {
    console.warn('_startedTime was not null');
  }

  this._startedTime = time;
};

/**
 *
 * @param {Date} time
 * @param {Number} score
 */
SolverStageJournal.prototype.notifyFinished = function (time, score) {
  if(this._startedTime) {
    this.runTime += time - this._startedTime;

    this._startedTime = null;
  } else {
    console.warn('_startedTime was null');
  }

  if(this.scoringDistribution.notify(score)) {
    this.topScoreTime = time;
  }
};

SolverStageJournal.prototype.serializableHash = function () {
  return {
    scoringDistribution: this.scoringDistribution.serializableHash(),
    runTime: this.runTime,
    topScoreTime: this.topScoreTime
  };
};
