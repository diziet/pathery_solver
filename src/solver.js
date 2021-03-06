/** @module pathery/solver */

var Analyst = require('./analyst.js');
var ExploratoryUtilities = require('./exploratory-utilities.js');

var MonitoringClient = require('./solver/monitoring/client.js');

/**
 * Find solutions, calling onNewTopScoreCallback whenever a better one is found.
 *
 * @param {Map} map
 * @param {Number[][]} initialSolution
 * @param {Object} options
 * @param {Function} onNewTopScoreCallback
 */
module.exports.solve = function (map, initialSolution, options, onNewTopScoreCallback) {
  /** @variable {Analyst.PatheryGraph} */
  var graph = map.graph();

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
    var annealingResult;
    var exhaustiveSearchResult;

    MonitoringClient.recordAnnealingStart();
    annealingResult = Analyst.annealingIteration(graph, currBlocks);
    MonitoringClient.recordAnnealingResult(annealingResult.score);

    exhaustiveSearchResult = exhaustiveSearchWrapper(graph, currBlocks, annealingResult.score);

    if(topScore === null || exhaustiveSearchResult.score > topScore) {
      topScore = exhaustiveSearchResult.score;

      onNewTopScoreCallback(exhaustiveSearchResult);
    }
  }
};
