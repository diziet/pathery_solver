var Analyst = require('./src/analyst.js');

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
  var topScore = null;

  while(true) {
    var result = Analyst.annealingIteration(graph, currBlocks);
    var score = result.score;

    if(topScore === null || score > topScore) {
      process.send({
        score: score,
        solution: currBlocks
      });

      topScore = score;
    }
  }
}
