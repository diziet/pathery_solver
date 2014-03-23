var DummyAnalyst = (function () {
  return {
    generateResult: function () {
      return {
        score: Math.random(),
        solution: "dummy"
      }
    }
  }
})();

var topScore = null;

function loop() {
  var currentResult = {
    score: Math.random(),
    solution: "dummy"
  };

  if(topScore === null || currentResult.score > topScore) {
    process.send(currentResult);

    topScore = currentResult.score;
  }

  setTimeout(loop, 10);
}

loop();
