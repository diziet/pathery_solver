// TODO: Timeout the exhaustive search after some period of time?
// TODO:     Additionally -- lower the depth if too many timeouts?
// TODO:     Alternatively, maybe vary the probability based upon the ratio between exhaustive and non-exhaustive.
// TODO: Keep a small cache (based on score/last seen) of exhaustively searched solutions...primarily to cut down on searching essentially the same top solution repeatedly.

var _ = require('underscore');

var Analyst = require('./../analyst.js');
var ExploratoryUtilities = require('./../exploratory-utilities.js');

var MonitoringClient = require('./monitoring/client.js');

/**
 * The number of milliseconds to wait after the worker starts before attempting exhaustive searches.
 *
 * @see delayExhaustiveSearch
 *
 * @constant {Number} - Wait this number of milliseconds
 */
const DELAY_EXHAUSTIVE_SEARCH_FOR_MILLISECONDS = 2000;

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
 * This will be set to false once @see DELAY_EXHAUSTIVE_SEARCH_FOR_MILLISECONDS have passed, thus causing exhaustive
 * searches to go forward.
 *
 * @variable {boolean}
 */
var delayExhaustiveSearch = true;

/**
 * The time (in milliseconds) that we started the solver.
 *
 * @variable {Number}
 */
var solverStartedAt = Date.now();

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

module.exports.initialize = function () {
  solverStartedAt = Date.now();
};

/**
 *
 * @param {Analyst.PatheryGraph} graph
 * @param {Object} currBlocks
 * @param {Number} currAnnealingScore
 * @returns {{score: Number, solution: Object }}
 */
module.exports.searchWrapper = function (graph, currBlocks, currAnnealingScore) {
  var doExhaustiveSearch;

  if(delayExhaustiveSearch) {
    delayExhaustiveSearch = (Date.now() - solverStartedAt) < DELAY_EXHAUSTIVE_SEARCH_FOR_MILLISECONDS;

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
    var startTime = Date.now();
    var lastExhaustiveSearchBlocks = _.extend({}, currBlocks);
    var lastExhaustiveSearchScore = currAnnealingScore;

    MonitoringClient.recordExhaustiveStart();

    while(true) {
      var initialResult = specializedSearchFunction(graph, lastExhaustiveSearchBlocks);

      lastExhaustiveSearchBlocks = graph.dictify_blocks(initialResult.solution);

      // Analyst.place_greedy occasionally returns a score which is too high.
      var checkedScore = Analyst.find_pathery_path(graph, lastExhaustiveSearchBlocks).value;

      if(checkedScore > lastExhaustiveSearchScore) {
        iterations++;

        lastExhaustiveSearchScore = checkedScore;
      } else {
        MonitoringClient.recordExhaustiveResult(checkedScore, iterations);

        return {
          score: checkedScore,
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
