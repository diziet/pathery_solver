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
var OPTIMAL_SCORE = 27;
var WORKER_COUNT = 4;

var Analyst = require(__dirname + '/../src/analyst.js');

var graph = new Analyst.PatheryGraph(BOARD);

var topScore = null;
var workers = [];

for(i = 0; i < WORKER_COUNT; i++) {
  workers.push(ChildProcess.fork(__dirname + '/../worker.js'));
}

for(i = 0; i < workers.length; i++) {
  var worker = workers[i];

  var initialBlocks = {};
  for(var j = 0; j < BLOCK_COUNT; j++) {
    Analyst.placeBlock(graph, initialBlocks);
  }

  worker.send({
    board: BOARD,
    initialSolution: graph.listify_blocks(initialBlocks)
  });

  worker.on('message', function (childTopResult) {
    if(topScore === null || childTopResult.score > topScore) {
      topScore = childTopResult.score;

      console.log("score", childTopResult.score, "solution", graph.listify_blocks(childTopResult.solution));

      if(topScore >= OPTIMAL_SCORE) {
        for(var j = 0; j < workers.length; j++) {
          workers[j].kill();
        }
      }
    }
  });
}
