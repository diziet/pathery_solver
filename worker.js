var _ = require('underscore');

var Analyst = require('./src/analyst.js');
var ExploratoryUtilities = require('./src/exploratory-utilities.js');

var workerStartedAt = null;

process.on('message', function (params) {
  if(workerStartedAt) {
    throw new Error();
  } else {
    workerStartedAt = Date.now();

    run(params);
  }
});

function run(params) {
  var graph = new Analyst.PatheryGraph(params.board);
  var currBlocks = graph.dictify_blocks(params.initialSolution);
  var topScore = null;

  while(true) {
    var annealingResult = Analyst.annealingIteration(graph, currBlocks);
    var exhaustiveSearchResult = exhaustiveSearchWrapper(annealingResult.score, currBlocks, graph);

    if(topScore === null || exhaustiveSearchResult.score > topScore) {
      topScore = exhaustiveSearchResult.score;

      process.send(exhaustiveSearchResult);
    }
  }
}

////////////////////////////////////////////////////////////////////////////////
// Exhaustive search functionality.

/**
 * @function
 *
 * @param {Number} currAnnealingScore
 * @param {Object} currBlocks
 * @param {Analyst.PatheryGraph} graph
 * @returns {{score: Number, solution: Object}}
 */
var exhaustiveSearchWrapper;

/** @variable {Number */
var exhaustiveSearchDepth = ExploratoryUtilities.configuration.exhaustiveSearchDepth;

if(exhaustiveSearchDepth > 0) {
  // TODO: Timeout the exhaustive search after some period of time?
  // TODO:     Additionally -- lower the depth if too many timeouts?

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
   * The top score we have seen solely looking at the annealing process. This _does not_ include scores generated via
   * exhaustive searching.
   *
   * @variable {Number}
   */
  var topAnnealingScore = null;

  var _debug_LastExhaustiveSearchEndTime = Date.now();
  var _debug_NonExhaustiveSearchIterations = 0;

  exhaustiveSearchWrapper = function (currAnnealingScore, currBlocks, graph) {
    var doExhaustiveSearch;

    if(delayExhaustiveSearch) {
      delayExhaustiveSearch = (Date.now() - workerStartedAt) < DELAY_EXHAUSTIVE_SEARCH_FOR_MILLISECONDS;

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

      while(true) {
        var res = performExhaustiveSearch(lastExhaustiveSearchBlocks, graph);

        lastExhaustiveSearchBlocks = graph.dictify_blocks(res.solution);

        if(res.score > lastExhaustiveSearchScore) {
          iterations++;

          lastExhaustiveSearchScore = res.score;
        } else {
          var endTime = Date.now();

          console.log(
              'Worker ' + process.pid + ' finished ' + iterations + ' iterations of exhaustive search on ' + currAnnealingScore + ' yielding ' + res.score + ' after ' + ((endTime - startTime) / 1000) + ' seconds.' +
                  ' Run after ' + _debug_NonExhaustiveSearchIterations + ' non-exhaustive iterations (' + ((startTime - _debug_LastExhaustiveSearchEndTime) / 1000) + ' seconds).'
          );
          _debug_LastExhaustiveSearchEndTime = endTime;
          _debug_NonExhaustiveSearchIterations = 0;

          return {
            score: res.score,
            solution: lastExhaustiveSearchBlocks
          }
        }
      }
    } else {
      _debug_NonExhaustiveSearchIterations++;

      return {
        score: currAnnealingScore,
        solution: currBlocks
      }
    }
  };

  /**
   * @function
   *
   * @param {Object} currBlocks
   * @param {Analyst.PatheryGraph} graph
   * @returns {{score: Number, solution: Number[][] }}
   */
  var performExhaustiveSearch;

  switch(ExploratoryUtilities.configuration.exhaustiveSearchDomain) {
    case 'combinatorial':
      performExhaustiveSearch = function(currBlocks, graph) {
        var blockKeys = Object.keys(currBlocks);
        var exhaustiveBestScore = null;
        var exhaustiveBestSolution = null;

        function combinatorialHelper(depth, idxStart) {
          for(var idx = idxStart; idx < blockKeys.length; idx++) {
            delete currBlocks[blockKeys[idx]];

            if(depth === 1) {
              var solution = Analyst.place_greedy(null, graph.listify_blocks(currBlocks), exhaustiveSearchDepth, undefined, undefined, undefined, undefined, graph);
              var currScore = solution[1];
              var currSolution = solution[0];

              if(exhaustiveBestScore === null || currScore > exhaustiveBestScore) {
                exhaustiveBestScore = currScore;
                exhaustiveBestSolution = currSolution;
              }
            } else {
              combinatorialHelper(depth - 1, idx + 1);
            }

            currBlocks[blockKeys[idx]] = true;
          }
        }

        combinatorialHelper(exhaustiveSearchDepth, 0);

        return {
          score: exhaustiveBestScore,
          solution: exhaustiveBestSolution
        };
      };

      break;
    case 'random':
      performExhaustiveSearch = function(currBlocks, graph) {
        for(var i = 0; i < exhaustiveSearchDepth; i++) {
          Analyst.removeRandomBlock(graph, currBlocks);
        }

        var solution = Analyst.place_greedy(null, graph.listify_blocks(currBlocks), exhaustiveSearchDepth, undefined, undefined, undefined, undefined, graph);

        return {
          score: solution[1],
          solution: solution[0]
        };
      };

      break;
    default:
      throw new Error('invariant');
  }
} else {
  exhaustiveSearchWrapper = function (score, currBlocks) {
    return {
      score: score,
      solution: currBlocks
    }
  };
}
