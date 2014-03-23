var ChildProcess = require('child_process');

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
var WORKER_COUNT = 4;

var Analyst = require(__dirname + '/../src/analyst.js');

var graph = new Analyst.PatheryGraph(BOARD);

var topScore = null;

for(i = 0; i < WORKER_COUNT; i++) {
  var initialBlocks = {};
  for(var i = 0; i < BLOCK_COUNT; i++) {
    Analyst.placeBlock(graph, initialBlocks);
  }

  var worker = ChildProcess.fork(__dirname + '/../worker.js');

  worker.on('message', function (childTopResult) {
    if(topScore === null || childTopResult.score > topScore) {
      topScore = childTopResult.score;

      console.log("score", childTopResult.score, "solution", graph.listify_blocks(childTopResult.solution));
    }
  });

  worker.send({
    board: BOARD,
    initialSolution: graph.listify_blocks(initialBlocks)
  });
}
