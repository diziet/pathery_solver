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
 * This should be set to false via @see updateDelayExhaustiveSearch once exhaustive searches should go forward.
 *
 * @variable {boolean}
 */
var delayExhaustiveSearch;

/**
 * Called when @see delayExhaustiveSearch is true, possible setting it to false;
 *
 * @function
 *
 * @return {Boolean}
 */
var updateDelayExhaustiveSearch;

if(ExploratoryUtilities.configuration.exhaustiveSearchDelayIterations === null) {
  const DELAY_EXHAUSTIVE_SEARCH_FOR_MILLISECONDS = 2000;

  delayExhaustiveSearch = true;

  updateDelayExhaustiveSearch = function () {
    return (Date.now() - solverStartedAt) < DELAY_EXHAUSTIVE_SEARCH_FOR_MILLISECONDS;
  }
} else {
  var delayExhaustiveSearchIteration = ExploratoryUtilities.configuration.exhaustiveSearchDelayIterations;

  if(delayExhaustiveSearchIteration === 0) {
    delayExhaustiveSearch = false;
  } else {
    delayExhaustiveSearch = true;

    updateDelayExhaustiveSearch = function () {
      return --delayExhaustiveSearchIteration > 0;
    }
  }
}

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

/**
 *
 * @param {Number} [initialTopAnnealingScore]
 */
module.exports.initialize = function (initialTopAnnealingScore) {
  solverStartedAt = Date.now();

  if(initialTopAnnealingScore !== undefined) {
    topAnnealingScore = initialTopAnnealingScore;
  }
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
    delayExhaustiveSearch = updateDelayExhaustiveSearch();

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
