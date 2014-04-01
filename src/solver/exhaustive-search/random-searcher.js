var Analyst = require('./../../analyst.js');
var ExploratoryUtilities = require('./../../exploratory-utilities.js');

/** @variable {Number */
var exhaustiveSearchDepth = ExploratoryUtilities.configuration.exhaustiveSearchDepth;

/**
 * Only process a single set of removed blocks, chosen via weighted random selection.
 *
 * @param {Analyst.PatheryGraph} graph
 * @param {Object} currBlocks
 * @returns {{score: Number, solution: Number[][] }}
 */
module.exports.search = function(currBlocks, graph) {
  for(var i = 0; i < exhaustiveSearchDepth; i++) {
    Analyst.removeRandomBlock(graph, currBlocks);
  }

  var solution = Analyst.place_greedy(null, graph.listify_blocks(currBlocks), exhaustiveSearchDepth, undefined, undefined, undefined, undefined, graph);

  return {
    score: solution[1],
    solution: solution[0]
  };
};
