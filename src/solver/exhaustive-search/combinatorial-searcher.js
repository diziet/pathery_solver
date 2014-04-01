var Analyst = require('./../../analyst.js');
var ExploratoryUtilities = require('./../../exploratory-utilities.js');

/** @variable {Number */
var exhaustiveSearchDepth = ExploratoryUtilities.configuration.exhaustiveSearchDepth;

/**
 * Iterate through all `Choose(currBlocks.length, exhaustiveSearchDepth)` possible block removals.
 *
 * @param {Analyst.PatheryGraph} graph
 * @param {Object} currBlocks
 * @returns {{score: Number, solution: Number[][] }}
 */
module.exports.search = function(graph, currBlocks) {
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
