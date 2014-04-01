var Analyst = require('./../../analyst.js');
var Solver = require('./../../solver.js');

var workerStarted = false;

process.on('message', function (params) {
  if(workerStarted) {
    throw new Error();
  } else {
    workerStarted = true;

    Solver.solve(new Analyst.PatheryGraph(params.board), params.initialSolution, params.options, function (newTopSolution) { process.send(newTopSolution); });
  }
});
