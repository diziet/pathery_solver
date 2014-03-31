var _ = require('underscore');

var Analyst = require('./src/analyst.js');
var ExploratoryUtilities = require('./src/exploratory-utilities.js');

var started = false;

process.on('message', function (params) {
  if(started) {
    throw new Error();
  } else {
    started = true;

    run(params);
  }
});

function run(params) {
  var graph = new Analyst.PatheryGraph(params.board);
  var currBlocks = graph.dictify_blocks(params.initialSolution);
  var topAnnealingScore = null;
  var topTotalScore = null;

  while(true) {
    var annealingResult = Analyst.annealingIteration(graph, currBlocks);

    if(topAnnealingScore === null || annealingResult.score > topAnnealingScore) {
      topAnnealingScore = annealingResult.score;

      var exhaustiveSearchResult = exhaustiveSearchWrapper(annealingResult.score, currBlocks, graph);

      if(topTotalScore === null || exhaustiveSearchResult.score > topTotalScore) {
        topTotalScore = exhaustiveSearchResult.score;

        process.send(exhaustiveSearchResult);
      }
    }
  }
}

////////////////////////////////////////////////////////////////////////////////
// Exhaustive search functionality.

var exhaustiveSearchWrapper;
var exhaustiveSearchDepth = ExploratoryUtilities.configuration.exhaustiveSearchDepth;

if(exhaustiveSearchDepth > 0) {
  // TODO: Timeout the exhaustive search after some period of time?
  // TODO:     Additionally -- lower the depth if too many timeouts?

  exhaustiveSearchWrapper = function (score, currBlocks, graph) {
    // console.log('Worker ' + process.pid + ' started exhaustive search on ' + score + '.');

    var startTime = Date.now();
    var res = performExhaustiveSearch(_.extend({}, currBlocks), graph);
    var runTime = Date.now() - startTime;

    console.log('Worker ' + process.pid + ' finished exhaustive search on score yielding ' + res.score + ' after ' + (runTime / 1000) + ' seconds.');

    return {
      score: res.score,
      solution: graph.dictify_blocks(res.solution)
    }
  };

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
