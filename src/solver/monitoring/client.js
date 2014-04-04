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

/**
 *
 * @param {String} type - 'annealing' or 'exhaustive'.
 * @param {String} action - 'start' or 'finish'.
 * @param {Number} [score]
 */
function sendUpdate(type, action, score) {
  if(monitoringStarted) {
    process.send({
      name: 'monitoring-update',
      params: {
        action: action,
        score: score,
        time: (new Date()),
        type: type
      }
    });
  }
}

module.exports.recordAnnealingStart = function () {
  sendUpdate('annealing', 'start');
};

module.exports.recordAnnealingResult = function (score) {
  sendUpdate('annealing', 'finish', score);
};

module.exports.recordExhaustiveStart = function () {
  sendUpdate('exhaustive', 'start');
};

// TODO: Record iterations.
module.exports.recordExhaustiveResult = function (score, iterations) {
  sendUpdate('exhaustive', 'finish', score);
};
