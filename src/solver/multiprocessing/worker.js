var Map = require('./../../map.js');
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
            Map.build(message.params.mapAttributes),
            message.params.initialSolution,
            message.params.options,
            function (newTopResult) { process.send({ name: 'new-result', params: newTopResult }); }
        );
      }
  }
});
