/** @module pathery/solver */

var Analyst = require('./../src/analyst.js');
var ExploratoryUtilities = require('./../src/exploratory-utilities.js');

var Monitor = require('./solver/monitor.js');

/**
 * Find solutions, calling onNewTopScoreCallback whenever a better one is found.
 *
 * @param {Analyst.PatheryGraph} graph
 * @param {Number[][]} initialSolution
 * @param {Object} options
 * @param {Function} onNewTopScoreCallback
 */
module.exports.solve = function (graph, initialSolution, options, onNewTopScoreCallback) {
  /**
   * Choose whether or not to do exhaustive searching based upon configuration.
   *
   * @function
   *
   * @param {Analyst.PatheryGraph} graph
   * @param {Object} currBlocks
   * @param {Number} currAnnealingScore
   * @returns {{score: Number, solution: Number[][] }}
   */
  var exhaustiveSearchWrapper = (function () {
    if(ExploratoryUtilities.configuration.exhaustiveSearchDepth > 0) {
      var ExhaustiveSearch = require('./solver/exhaustive-search.js');

      ExhaustiveSearch.initialize();

      return ExhaustiveSearch.searchWrapper;
    } else {
      return function (_graph, currBlocks, currAnnealingScore) {
        return {
          score: currAnnealingScore,
          solution: currBlocks
        }
      };
    }
  })();

  var currBlocks = graph.dictify_blocks(initialSolution);
  var topScore = null;

  while(true) {
    var annealingResult = Analyst.annealingIteration(graph, currBlocks);
    Monitor.recordAnnealingResult(annealingResult.score);

    var exhaustiveSearchResult = exhaustiveSearchWrapper(graph, currBlocks, annealingResult.score);

    Monitor.broadcast();

    if(topScore === null || exhaustiveSearchResult.score > topScore) {
      topScore = exhaustiveSearchResult.score;

      onNewTopScoreCallback(exhaustiveSearchResult);
    }
  }
};
