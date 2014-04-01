/** @module pathery/solver/monitor */

const MONITOR_INTERVAL_MILLISECONDS = 60000;

var lastRunTime = Date.now();
var annealingDistribution = [];
var exhaustiveDistribution = [];

function getStatistics(distribution) {
  var min = null;
  var max = null;
  var total = 0;
  var sum = 0;

  for(var i = 0; i < distribution.length; i++) {
    var count = distribution[i];

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
}

module.exports.broadcast = function () {
  var currTime = Date.now();

  if(currTime - lastRunTime > MONITOR_INTERVAL_MILLISECONDS) {
    console.log('MONITOR (worker ' + process.pid + '): annealingDistribution:', getStatistics(annealingDistribution), ' ; exhaustiveDistribution:', getStatistics(exhaustiveDistribution));

    lastRunTime = currTime;
    annealingDistribution = [];
    exhaustiveDistribution = [];
  }
};

module.exports.recordAnnealingResult = function (annealingScore) {
  annealingDistribution[annealingScore] = (annealingDistribution[annealingScore] || 0) + 1;
};

module.exports.recordExhaustiveResult = function (exhaustiveScore) {
  exhaustiveDistribution[exhaustiveScore] = (exhaustiveDistribution[exhaustiveScore] || 0) + 1;
};
