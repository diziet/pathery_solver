var _ = require('underscore');

var Analyst = require('./src/analyst.js');
var Solver = require('./src/solver.js');

var workerStarted = false;

process.on('message', function (params) {
  if(workerStarted) {
    throw new Error();
  } else {
    workerStarted = true;

    Solver.solve(new Analyst.PatheryGraph(params.board), params.initialSolution, {}, function (newTopSolution) { process.send(newTopSolution); });
  }
});
