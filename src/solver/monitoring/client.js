var monitoringStarted = false;

process.on('message', function (message) {
  switch(message.name) {
    case 'monitoring-enable':
      if(monitoringStarted) {
        throw new Error();
      } else {
        monitoringStarted = true;
      }
  }
});

function sendUpdate(type, score) {
  process.send({
    name: 'monitoring-update',
    params: [type, score]
  });
}

module.exports.recordAnnealingResult = function (score) {
  if(monitoringStarted) {
    sendUpdate('annealing', score);
  }
};

module.exports.recordExhaustiveResult = function (score) {
  if(monitoringStarted) {
    sendUpdate('exhaustive', score);
  }
};
