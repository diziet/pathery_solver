var BOARD = [
  [ 's', ' ', ' ', ' ', 'r', ' ', ' ', ' ', ' ', ' ', ' ', ' ', 'f' ],
  [ 's', 'r', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', 'f' ],
  [ 's', ' ', ' ', 'r', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', 'f' ],
  [ 's', ' ', ' ', ' ', ' ', ' ', 'r', ' ', ' ', ' ', ' ', 'r', 'f' ],
  [ 's', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', 'r', 'r', ' ', 'f' ],
  [ 's', ' ', 'r', ' ', ' ', ' ', ' ', 'r', ' ', ' ', ' ', ' ', 'f' ],
  [ 's', ' ', ' ', ' ', 'r', ' ', ' ', ' ', ' ', 'r', ' ', 'r', 'f' ]
];

// Solution which is a single position from optimal.
var INITIAL_SOLUTION = [
  [ 0, 11 ],
  [ 1, 6 ],
  [ 1, 11 ],
  [ 2, 7 ],
  [ 2, 11 ],
  [ 4, 5 ],
  [ 4, 8 ],
  [ 5, 4 ]
];

var TRIALS = 1000;
var OPTIMAL_SCORE = 27;

var Analyst = require(__dirname + '/../src/analyst.js');

var graph = new Analyst.PatheryGraph(BOARD);
var totalIterations = 0;

for(var i = 0; i < TRIALS; i++) {
  var iteration = 0;
  var score = 0;
  while(score !== 27) {
    var currBlocks = graph.dictify_blocks(INITIAL_SOLUTION);
    var iterationResult = Analyst.annealingIteration(graph, currBlocks);

    if(iterationResult.score === OPTIMAL_SCORE) {
      console.log(iteration, iterationResult.score, graph.listify_blocks(iterationResult.solution));

      break;
    }

    iteration++;
  }

  totalIterations += iteration;
}

console.log('Probability of reaching optimal starting from off-by-one from optimal', TRIALS / totalIterations);
