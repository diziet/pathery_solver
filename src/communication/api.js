/** @module pathery/communication/api */

var http = require('http');
var QueryString = require('querystring');

var Q = require('q');
var strftime = require('strftime');
var _ = require('underscore');

var Map = require(__dirname + '/../map.js');

const PROTOCOL = 'http';

/**
 *
 * @readonly
 * @enum {number}
 */
module.exports.MapDifficulty = {
  SIMPLE: 0,
  NORMAL: 1,
  COMPLEX: 2,
  SPECIAL: 3,
  ULTRA_COMPLEX: 4
};

/**
 * Thrown when an issue occurs w.r.t. API communication.
 *
 * @constructor
 * @augments Error
 *
 * @param {http.IncomingMessage} response
 * @param {String} body
 * @param {Error} [innerException]
 */
module.exports.APIError = function (response, body, innerException) {
  /** @member {http.IncomingMessage} */
  this.response = response;
  /** @member {String} */
  this.body = body;
  /** @member {Error} */
  this.innerException = innerException;

  this.message = 'There was an error communicating with the API: ' + response.statusCode;
  this.name = 'APIError';
  this.stack = (new Error()).stack;
};
module.exports.APIError.prototype = new Error;
module.exports.APIError.prototype.constructor = module.exports.APIError;

/**
 *
 * @constructor
 * @augments Error
 */
module.exports.MapNotGenerated = function () {
  this.message = 'Maps not generated';
  this.name = 'MapNotGenerated';
  this.stack = (new Error()).stack;
};
module.exports.MapNotGenerated.prototype = new Error;
module.exports.MapNotGenerated.prototype.constructor = module.exports.MapNotGenerated;

/**
 *
 * @param {Object} [attributes]
 * @constructor
 */
module.exports.Client = function (attributes) {
  attributes = _.extend(
      {
        hostname: module.exports.Client.DEFAULT_HOSTNAME,
        port: module.exports.Client.DEFAULT_PORT
      },
      attributes
  );

  /** @member {String} */
  this.auth = attributes['auth'];

  /** @member {String} */
  this.hostname = attributes['hostname'];

  /** @member {Number} */
  this.port = attributes['port'];

  /** @member {Number} */
  this.userId = attributes['userId'];
};

module.exports.Client.DEFAULT_HOSTNAME = 'www.pathery.com';
module.exports.Client.DEFAULT_PORT = 80;

/**
 *
 * @param {Number} mapId
 * @param {{preventCaching: Boolean}} [options]
 * @returns {Q.Promise} Resolves with a Map object. May fail with an APIError error if the specified map does not exist (with APIError#response.statusCode == 404).
 */
module.exports.Client.prototype.getMap = function (mapId, options) {
  var requestPath = '/a/map/' + mapId + '.js';
  var self = this;

  // Prevent caching by CloudFlare (which appears to ignore Cache-Control from the client).
  if(options && options.preventCaching) {
    requestPath += '?' + Date.now();
  }

  return this.getJSON(requestPath).then(function (rawMapObject) {
    return new Map(rawMapObject, { hostname: self.hostname, port: self.port, protocol: PROTOCOL });
  });
};

/**
 *
 * @param {Date} date
 * @param {{preventCaching: Boolean}} [options]
 * @returns {Q.Promise}
 */
module.exports.Client.prototype.getMapIdsByDate = function (date, options) {
  var requestPath = '/a/mapsbydate/' + strftime('%Y-%m-%d', date) + '.js';

  // Prevent caching by CloudFlare (which appears to ignore Cache-Control from the client).
  if(options && options.preventCaching) {
    requestPath += '?' + Date.now();
  }

  return this.getJSON(requestPath);
};

/**
 *
 * @param {Date} date
 * @param {MapDifficulty} difficulty
 * @param {Object} options - passed to #getMap and #getMapIdsByDate.
 * @returns {Q.Promise} Results with a Map object on success. May fail with a MapNotGenerated error if the specified difficulty is not yet available.
 */
module.exports.Client.prototype.getMapByDateAndDifficulty = function (date, difficulty, options) {
  var self = this;

  return this.getMapIdsByDate(date, options).then(function (mapIds) {
    if(mapIds === null) {
      throw new module.exports.MapNotGenerated();
    } else if(mapIds.length === 1 ) {
      if(difficulty === module.exports.MapDifficulty.ULTRA_COMPLEX) {
        return self.getMap(mapIds[0], options);
      } else {
        throw new module.exports.MapNotGenerated();
      }
    } else if(mapIds.length < Object.keys(module.exports.MapDifficulty).length) {
      throw new Error('bad mapIds: ' + JSON.stringify(mapIds));
    } else {
      return self.getMap(mapIds[difficulty], options);
    }
  });
};

/**
 *
 * @param {Map} map
 * @param {Array} solution
 * @returns {Q.Promise}
 */
module.exports.Client.prototype.postSolution = function (map, solution) {
  var params = {
    isChallenge: false,
    r: 'getpath',
    mapcode: map.code,
    mapid: map.id,
    solution: solution.reduce(
        function (memo, currCell) {
          return memo + (currCell[0] + 1) + ',' + currCell[1] + '.';
        },
        '.'
    )
  };

  return this.post('/do.php?' + QueryString.stringify(params), { doAuthenticate: true });
};

/**
 *
 * @private
 *
 * @param {Object} [options]
 * @returns {Object}
 */
module.exports.Client.prototype.getDefaultHeaders = function (options) {
  var headers = {};

  if(options && options.doAuthenticate) {
    if(!this.auth || !this.userId) {
      throw new Error('invariant');
    }

    headers['Cookie'] = [
      'auth=' + this.auth,
      'userID=' + this.userId,
      'doLogin=yes'
    ].join('; ');
  }

  return headers;
};

/**
 *
 * @private
 *
 * @param {String} path
 * @param {Object} [options]
 * @returns {Q.Promise}
 */
module.exports.Client.prototype.getJSON = function (path, options) {
  var headers = this.getDefaultHeaders(options);
  var deferred = Q.defer();

  if(!this.hostname || !this.port) {
    throw new Error('invariant');
  }

  var request = http.request(
      {
        headers: headers,
        hostname: this.hostname,
        path: path,
        port: this.port
      },
      function (response) {
        var buffer = '';

        response.setEncoding('utf8');

        response.on('data', function (chunk) {
          buffer += chunk;
        });

        response.on('end', function() {
          if(response.statusCode === 200) {
            try {
              deferred.resolve(JSON.parse(buffer));
            } catch(e) {
              deferred.reject(new module.exports.APIError(response, buffer, e));
            }
          } else {
            deferred.reject(new module.exports.APIError(response, buffer));
          }
        });
      }
  );

  request.end();

  return deferred.promise;
};

/**
 *
 * @private
 *
 * @param {String} path
 * @param {Object} options
 * @returns {Q.Promise}
 */
module.exports.Client.prototype.post = function (path, options) {
  var headers = this.getDefaultHeaders(options);
  var deferred = Q.defer();

  if(!this.hostname || !this.port) {
    throw new Error('invariant');
  }

  // Required for blue.pathery.net.
  headers['Content-Length'] = 0;

  var request = http.request(
      {
        headers: headers,
        hostname: this.hostname,
        method: 'POST',
        path: path,
        port: this.port
      },
      function (response) {
        var buffer = '';

        response.setEncoding('utf8');

        response.on('data', function (chunk) {
          buffer += chunk;
        });

        response.on('end', function() {
          if(response.statusCode === 200 || response.statusCode === 302) {
            deferred.resolve(buffer);
          } else {
            deferred.reject(new module.exports.APIError(response, buffer));
          }
        });
      }
  );

  // End the request with an empty body.
  request.end();

  return deferred.promise;
};
