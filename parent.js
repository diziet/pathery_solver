var ChildProcess = require('child_process');

var WORKER_COUNT = 2;

var topResult = null;

for(var i = 0; i < WORKER_COUNT; i++) {
  var worker = ChildProcess.fork(__dirname + '/worker.js');

  worker.on('message', function (childTopResult) {
    if(topResult === null || childTopResult.score > topResult.score) {
      topResult = childTopResult;

      console.log("Received a new top result: ", topResult);
    }
  });
}
