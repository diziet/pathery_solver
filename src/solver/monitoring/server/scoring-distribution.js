/**
 * @constructor ScoringDistribution
 */
var ScoringDistribution = module.exports = function () {
  this.distribution = [];

  /**
   * Stored for convenience; obviously derivable from distribution.
   *
   * N.B.: Modified externally by e.g. SolverStageJournal#merge.
   *
   * @member {Number}
   */
  this.max = null;
};

ScoringDistribution.prototype.calculateStatistics = function () {
  var min = null;
  var total = 0;
  var sum = 0;

  for(var i = 0; i < this.distribution.length; i++) {
    var count = this.distribution[i];

    if(count) {
      if(min === null || i < min) {
        min = i;
      }

      total += count;
      sum += count * i;
    }
  }

  return {
    min: min,
    max: this.max,
    total: total,
    average: sum / total
  }
};

/**
 *
 * @param {Number} score
 * @returns {Boolean} True iff this was a new max score.
 */
ScoringDistribution.prototype.notify = function (score) {
  this.distribution[score] = (this.distribution[score] || 0) + 1;

  if(this.max === null || score > this.max) {
    this.max = score;

    return true;
  } else {
    return false;
  }
};

ScoringDistribution.prototype.serializableHash = function () {
  return {
    distribution: this.distribution
  };
};
