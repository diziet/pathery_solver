var BOARD = [
  [ 's', ' ', ' ', ' ', 'r', ' ', ' ', ' ', ' ', ' ', ' ', ' ', 'f' ],
  [ 's', 'r', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', 'f' ],
  [ 's', ' ', ' ', 'r', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', 'f' ],
  [ 's', ' ', ' ', ' ', ' ', ' ', 'r', ' ', ' ', ' ', ' ', 'r', 'f' ],
  [ 's', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', 'r', 'r', ' ', 'f' ],
  [ 's', ' ', 'r', ' ', ' ', ' ', ' ', 'r', ' ', ' ', ' ', ' ', 'f' ],
  [ 's', ' ', ' ', ' ', 'r', ' ', ' ', ' ', ' ', 'r', ' ', 'r', 'f' ]
];

var BLOCK_COUNT = 8;

var OPTIMAL_SCORE = 27;

var Analyst = require(__dirname + '/../src/analyst.js');

var graph = new Analyst.PatheryGraph(BOARD);

var currBlocks = {};
for(var i = 0; i < BLOCK_COUNT; i++) {
  Analyst.placeBlock(graph, currBlocks);
}

console.log('initial', graph.listify_blocks(currBlocks));

var topScore = null;
var iterations = 0;
var highestInCurrentIntervals = null;
var topScoreHitCount;

while(topScore < OPTIMAL_SCORE) {
  var result = Analyst.annealingIteration(graph, currBlocks);
  var score = result.score;

  if(topScore === null || score > topScore) {
    topScore = score;
    topScoreHitCount = 1;

    console.log('new top score', score, iterations, graph.listify_blocks(currBlocks));
  } else if(score === topScore) {
    console.log('tied top score', score, iterations, topScoreHitCount++, graph.listify_blocks(currBlocks));
  }

  if(highestInCurrentIntervals === null || score > highestInCurrentIntervals) {
    highestInCurrentIntervals = score;
  }

  if(iterations % 10000 === 0) {
    console.log(iterations, highestInCurrentIntervals);

    highestInCurrentIntervals = null;
  }

  iterations++;
}
