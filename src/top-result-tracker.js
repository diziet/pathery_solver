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

  ////////////////////
  // Local attributes.

  /** @member {Number} */
  this.topScore = null;
};

/**
 *
 * @param {{score: Number, solution: Number[][]}} result
 */
module.exports.prototype.registerResult = function (result) {
  if(this.topScore === null || result.score > this.topScore) {
    var solution = this.map.graph().listify_blocks(result.solution);

    this.topScore = result.score;

    // TODO: Wait some (short) amount of time before posting results.
    console.log('New top score: ' + this.topScore + ' reached at ' + new Date() + '. Solution:', solution);
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
  }
};

/**
 * @returns {Boolean}
 */
module.exports.prototype.isOptimal = function () {
  return this.optimalScore && this.topScore >= this.optimalScore;
};
