/** @module pathery */

//
// TODO: Support configuring exhaustiveSearchDepth, probably via ExploratoryUtilities.
// TODO: Make this more extensible, particularly w.r.t. DelayTopScoreNotification and ExhaustiveScoreProcessing...maybe use mixins?
// FIXME: Reaching the optimal score via ExhaustiveScoreProcessing will not stop the workers until one of the workers gets a new top score.
// TODO: Fully iterate through all map.walls Choose exhaustiveSearchDepth possible removed walls?
// TODO: Timeout the exhaustive search after some period of time?
// TODO:     Additionally -- lower the depth is too many timeouts?
//

var Analyst = require(__dirname + '/analyst.js');
var ExploratoryUtilities = require(__dirname + '/exploratory-utilities.js');

/**
 *
 * @param {Client} client
 * @param {Map} map
 * @param {Object} configuration
 * @constructor TopResultTracker
 */
module.exports = function (client, map, configuration) {
  ////////////////////
  // Input parameter attributes.

  /** @member {Client} */
  this.client = client;

  /** @member {Map} */
  this.map = map;

  ////////////////////
  // Configuration attributes.

  /** @member {Number} */
  this.optimalScore = configuration.optimalScore;

  /** @member {Boolean} */
  this.postResults = configuration.postResults;

  /** @member {Boolean} */
  this.printResults = configuration.printResults;

  ////////////////////
  // Local attributes.

  /** @member {Date} */
  this.startTime = new Date();

  /** @member {Number} */
  this.topScore = null;

  ////////////////////
  // End (general) attribute initialization.

  this.initializeDelayTopScoreNotification();

  this.initializeExhaustiveScoreProcessing();
};

/**
 *
 * @param {{score: Number, solution: Number[][]}} result
 */
module.exports.prototype.registerResult = function (result) {
  if(this.topScore === null || result.score > this.topScore) {
    this.topScore = result.score;

    if(this.delayTopScoreNotifications) {
      this.delayedSolution = result.solution;
    } else {
      this.onNewTopScore(result.solution);
    }
  }
};

/**
 * @returns {Boolean}
 */
module.exports.prototype.isOptimal = function () {
  return this.optimalScore && this.topScore >= this.optimalScore;
};

/**
 *
 * @private
 */
module.exports.prototype.initializeDelayTopScoreNotification = function () {
  var self = this;

  this.delayTopScoreNotifications = true;
  this.delayedSolution = null;

  setTimeout(
      function () {
        self.delayTopScoreNotifications = false;

        if(self.delayedSolution) {
          self.onNewTopScore(self.delayedSolution);

          self.delayedSolution = null;
        }
      },
      1000
  );
};

/**
 *
 * @private
 */
module.exports.prototype.initializeExhaustiveScoreProcessing = function () {
  this.exhaustiveSearchDepth = 2;
};


/**
 * N.B.: This is currently running in the main process (i.e. _not_ in any of the workers). As a result, the new
 *     solutions are never fed back into the annealing search.
 *
 * @param currBlocks
 */
module.exports.prototype.exhaustiveSearchTopScore = function (currBlocks) {
  var exhaustiveSearchDepth = this.exhaustiveSearchDepth;

  if(exhaustiveSearchDepth > 0 && !this.isOptimal()) {
    var scoreForCurrBlocks = this.topScore;
    var self = this;

    setTimeout(doExhaustiveSearchTopScore, 1000);

    function doExhaustiveSearchTopScore() {
      if(self.topScore === scoreForCurrBlocks) {
        var map = self.map;
        var graph = map.graph();

        console.log('doing exhaustive on ' + scoreForCurrBlocks);

        var exhaustiveSearchStartTime = Date.now();
        var exhaustiveSearchRes = performExhaustiveSearch(map, graph, currBlocks, exhaustiveSearchDepth);
        var exhaustiveSearchRunTime = Date.now() - exhaustiveSearchStartTime;

        if(exhaustiveSearchRes.score > self.topScore) {
          console.log('exhaustive search generated a new top score: ' + exhaustiveSearchRes.score + '  in ' + exhaustiveSearchRunTime + ' milliseconds');

          self.registerResult({
            score: exhaustiveSearchRes.score,
            solution: graph.dictify_blocks(exhaustiveSearchRes.solution)
          });
        } else {
          console.log('exhaustive search generated an irrelevant score: ' + exhaustiveSearchRes.score + '  in ' + exhaustiveSearchRunTime + ' milliseconds');
        }
      } else {
        console.log('skipping exhaustive on ' + scoreForCurrBlocks);
      }
    }
  }

  ////////////////////
  // Helper functions.

  var performExhaustiveSearch;

  switch(ExploratoryUtilities.configuration.exhaustiveSearchDomain) {
    case 'combinatorial':
      performExhaustiveSearch = function(map, graph, currBlocks, exhaustiveSearchDepth) {
        var blockKeys = Object.keys(currBlocks);
        var exhaustiveBestScore = null;
        var exhaustiveBestSolution = null;

        function combinatorialHelper(depth, idxStart) {
          for(var idx = idxStart; idx < blockKeys.length; idx++) {
            delete currBlocks[blockKeys[idx]];

            if(depth === 1) {
              var solution = Analyst.place_greedy(map.board, graph.listify_blocks(currBlocks), exhaustiveSearchDepth);
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
      performExhaustiveSearch = function(map, graph, currBlocks, exhaustiveSearchDepth) {
        for(var i = 0; i < exhaustiveSearchDepth; i++) {
          Analyst.removeRandomBlock(graph, currBlocks);
        }

        var solution = Analyst.place_greedy(map.board, graph.listify_blocks(currBlocks), exhaustiveSearchDepth);

        return {
          score: solution[1],
          solution: solution[0]
        };
      };

      break;
    default:
      throw new Error('invariant');
  }
};

/**
 * Call to signal that a new top score has been registered.
 *
 * @private
 */
module.exports.prototype.onNewTopScore = function (rawSolution) {
  var solution = this.map.graph().listify_blocks(rawSolution);

  if(this.printResults) {
    console.log('New top score: ' + this.topScore + ' reached after ' + ((Date.now() - this.startTime.getTime()) / 1000) + ' seconds. Solution: ' + JSON.stringify(solution));
  }

  if(this.postResults) {
    this.client.postSolution(this.map, solution).done(
        function (responseBody) {
          console.log(responseBody);
        },
        function (error) {
          var response = error.response;

          if(response) {
            console.error('failed to post solution: ' + response.statusCode + ' - "' + error.body + '"');
          } else {
            console.error(error);
          }
        }
    );
  }

  this.exhaustiveSearchTopScore(rawSolution);
};
