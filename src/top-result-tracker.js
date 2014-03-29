/** @module pathery */

/**
 *
 * @param {Client} client
 * @param {Map} map
 * @param {Object} configuration
 * @constructor TopResultTracker
 */
module.exports = function (client, map, configuration) {
  ////////////////////
  // Input parameter attributes.

  /** @member {Client} */
  this.client = client;

  /** @member {Map} */
  this.map = map;

  ////////////////////
  // Configuration attributes.

  /** @member {Number} */
  this.optimalScore = configuration.optimalScore;

  /** @member {Boolean} */
  this.postResults = configuration.postResults;

  /** @member {Boolean} */
  this.printResults = configuration.printResults;

  ////////////////////
  // Local attributes.

  /** @member {Date} */
  this.startTime = new Date();

  /** @member {Number} */
  this.topScore = null;

  ////////////////////
  // End (general) attribute initialization.

  this.initializeDelayTopScoreNotification();
};

/**
 *
 * @param {{score: Number, solution: Number[][]}} result
 */
module.exports.prototype.registerResult = function (result) {
  if(this.topScore === null || result.score > this.topScore) {
    this.topScore = result.score;

    if(this.delayTopScoreNotifications) {
      this.delayedSolution = result.solution;
    } else {
      this.onNewTopScore(result.solution);
    }
  }
};

/**
 * @returns {Boolean}
 */
module.exports.prototype.isOptimal = function () {
  return this.optimalScore && this.topScore >= this.optimalScore;
};

/**
 *
 * @private
 */
module.exports.prototype.initializeDelayTopScoreNotification = function () {
  var self = this;

  this.delayTopScoreNotifications = true;
  this.delayedSolution = null;

  setTimeout(
      function () {
        self.delayTopScoreNotifications = false;

        if(self.delayedSolution) {
          self.onNewTopScore(self.delayedSolution);

          self.delayedSolution = null;
        }
      },
      1000
  );
};

/**
 * Call to signal that a new top score has been registered.
 *
 * @private
 */
module.exports.prototype.onNewTopScore = function (rawSolution) {
  var solution = this.map.graph().listify_blocks(rawSolution);

  if(this.printResults) {
    console.log('New top score: ' + this.topScore + ' reached after ' + ((Date.now() - this.startTime.getTime()) / 1000) + ' seconds. Solution: ' + JSON.stringify(solution));
  }

  if(this.postResults) {
    this.client.postSolution(this.map, solution).then(
        function (responseBody) {
          console.log(responseBody);
        },
        function (error) {
          var response = error.response;

          if(response) {
            console.error('failed to post solution: ' + response.statusCode + ' - "' + error.body + '"');
          } else {
            console.error(error);
          }
        }
    );
  }
};
