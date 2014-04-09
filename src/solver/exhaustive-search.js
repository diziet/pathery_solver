// TODO: Timeout the exhaustive search after some period of time?
// TODO:     Additionally -- lower the depth if too many timeouts?
// TODO:     Alternatively, maybe vary the probability based upon the ratio between exhaustive and non-exhaustive.
// TODO: Keep a small cache (based on score/last seen) of exhaustively searched solutions...primarily to cut down on searching essentially the same top solution repeatedly.

var _ = require('underscore');

var Analyst = require('./../analyst.js');
var ExploratoryUtilities = require('./../exploratory-utilities.js');

var MonitoringClient = require('./monitoring/client.js');

/**
 * @see NON_TOP_EXHAUSTIVE_SEARCH_ADDEND
 *
 * @constant {Number}
 */
const NON_TOP_EXHAUSTIVE_SEARCH_BASE = 3;

/**
 * @see NON_TOP_EXHAUSTIVE_SEARCH_BASE
 *
 * @constant {Number}
 */
const NON_TOP_EXHAUSTIVE_SEARCH_ADDEND = 1;

/**
 * Exhaustive searches will not be performed until this hits 0.
 *
 * Using iterations rather than time to allow for repeatability in e.g. test/benchmark.js.
 *
 * @variable {Number}
 */
var delayExhaustiveSearchIterations = ExploratoryUtilities.configuration.exhaustiveSearchDelayIterations;
if((typeof delayExhaustiveSearchIterations !== 'number') || delayExhaustiveSearchIterations < 0) { throw new Error(); }

/**
 * The top score we have seen solely looking at the annealing process. This _does not_ include scores generated via
 * exhaustive searching.
 *
 * @variable {Number}
 */
var topAnnealingScore = null;

/**
 * Choose search type based upon configuration.
 *
 * @function
 *
 * @param {Analyst.PatheryGraph} graph
 * @param {Object} currBlocks
 * @returns {{score: Number, solution: Number[][] }}
 */
var specializedSearchFunction = (function () {
  switch(ExploratoryUtilities.configuration.exhaustiveSearchDomain) {
    case 'combinatorial':
      var CombinatorialSearcher = require('./exhaustive-search/combinatorial-searcher.js');

      return CombinatorialSearcher.search;
    case 'random':
      var RandomSearcher = require('./exhaustive-search/random-searcher.js');

      return RandomSearcher.search;
    default:
      throw new Error('invariant');
  }
})();

/**
 *
 * @param {Analyst.PatheryGraph} graph
 * @param {Object} currBlocks
 * @param {Number} currAnnealingScore
 * @returns {{score: Number, solution: Object }}
 */
module.exports.searchWrapper = function (graph, currBlocks, currAnnealingScore) {
  var doExhaustiveSearch;

  if(delayExhaustiveSearchIterations !== 0) {
    delayExhaustiveSearchIterations--;

    doExhaustiveSearch = false;
  } else {
    // Potentially greater than 1 based on delta...obviously anything greater than 1 is equivalent to 1.
    var doExhaustiveSearchProbability = 1 / Math.pow(NON_TOP_EXHAUSTIVE_SEARCH_BASE, topAnnealingScore - currAnnealingScore + NON_TOP_EXHAUSTIVE_SEARCH_ADDEND);

    doExhaustiveSearch = ExploratoryUtilities.random() < doExhaustiveSearchProbability;
  }

  if(topAnnealingScore === null || currAnnealingScore > topAnnealingScore) {
    topAnnealingScore = currAnnealingScore;
  }

  // Perform an exhaustive search and then _continue_ to perform exhaustive searches as long as the score keeps improving.
  if(doExhaustiveSearch) {
    var iterations = 1;
    var lastExhaustiveSearchBlocks = _.extend({}, currBlocks);
    var lastExhaustiveSearchScore = currAnnealingScore;

    MonitoringClient.recordExhaustiveStart();

    while(true) {
      var initialResult = specializedSearchFunction(graph, lastExhaustiveSearchBlocks);

      lastExhaustiveSearchBlocks = graph.dictify_blocks(initialResult.solution);

      if(initialResult.score > lastExhaustiveSearchScore) {
        iterations++;

        lastExhaustiveSearchScore = initialResult.score;
      } else {
        MonitoringClient.recordExhaustiveResult(initialResult.score, iterations);

        return {
          score: initialResult.score,
          solution: lastExhaustiveSearchBlocks
        }
      }
    }
  } else {
    return {
      score: currAnnealingScore,
      solution: currBlocks
    };
  }
};
