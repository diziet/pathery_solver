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
 * Convenience mechanism to get the top score from between this SolverStageJournal and another.
 *
 * @param {SolverStageJournal} other
 * @returns {{score: Number, time: Date}}
 */
SolverStageJournal.prototype.getCombinedTopScoreInfo = function (other) {
  if(this.isBlank() && other.isBlank()) {
    return null;
  } else {
    var topJournal;

    if(other.isBlank()) {
      topJournal = this;
    } else if(this.isBlank()) {
      topJournal = other;
    } else {
      if(this.scoringDistribution.max > other.scoringDistribution.max) {
        topJournal = this;
      } else if(this.scoringDistribution.max < other.scoringDistribution.max) {
        topJournal = other;
      } else if(this.topScoreTime < other.topScoreTime) {
        topJournal = this;
      } else {
        topJournal = other;
      }
    }

    return {
      score: topJournal.scoringDistribution.max,
      time: topJournal.topScoreTime
    };
  }
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
 * Merge a SolverStageJournal into this one. The current SolverStageJournal will be mutated.
 *
 * @param {SolverStageJournal} other
 */
SolverStageJournal.prototype.merge = function (other) {
  var combinedTopScoreInfo = this.getCombinedTopScoreInfo(other);

  for(var i = 0; i < other.scoringDistribution.distribution.length; i++) {
    var otherCount = other.scoringDistribution.distribution[i];

    if(otherCount) {
      this.scoringDistribution.distribution[i] = (this.scoringDistribution.distribution[i] || 0) + otherCount;
    }
  }

  this.runTime += other.runTime;

  if(combinedTopScoreInfo) {
    this.scoringDistribution.max = combinedTopScoreInfo.score;
    this.topScoreTime = combinedTopScoreInfo.time;
  }
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
