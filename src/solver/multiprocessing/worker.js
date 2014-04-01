var Analyst = require('./../../analyst.js');
var Solver = require('./../../solver.js');

var solverStarted = false;

process.on('message', function (message) {
  switch(message.name) {
    case 'solve':
      if(solverStarted) {
        throw new Error();
      } else {
        solverStarted = true;

        Solver.solve(
            new Analyst.PatheryGraph(message.params.board),
            message.params.initialSolution,
            message.params.options,
            function (newTopResult) { process.send({ name: 'new-result', params: newTopResult }); }
        );
      }

      break;
    default:
      throw new Error('unknown message from parent: ' + message.name);
  }
});
