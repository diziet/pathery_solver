/** @module pathery/communication/api */

var http = require('http');
var QueryString = require('querystring');

var Q = require('q');
var _ = require('underscore');

var Map = require(__dirname + '/../map.js');

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
 * @returns {Q.Promise} Resolves with a Map object.
 */
module.exports.Client.prototype.getMap = function (mapId, options) {
  var requestPath = '/a/map/' + mapId + '.js';

  // Prevent caching by CloudFlare (which appears to ignore Cache-Control from the client).
  if(options && options.preventCaching) {
    requestPath += '?' + Date.now();
  }

  return this.getJSON(requestPath).then(function (rawMapObject) {
    return new Map(rawMapObject);
  });
};

/**
 *
 * @param {Date} date
 * @param {{preventCaching: Boolean}} [options]
 * @returns {Q.Promise}
 */
module.exports.Client.prototype.getMapIdsByDate = function (date, options) {
  var requestPath = '/a/mapsbydate/' + date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate() + '.js';

  // Prevent caching by CloudFlare (which appears to ignore Cache-Control from the client).
  if(options && options.preventCaching) {
    requestPath += '?' + Date.now();
  }

  return this.getJSON(requestPath);
};

/**
 *
 * @readonly
 * @enum {number}
 */
module.exports.Client.MapDifficulty = {
  SIMPLE: 0,
  NORMAL: 1,
  COMPLEX: 2,
  SPECIAL: 3,
  ULTRA_COMPLEX: 4
};

/**
 *
 * @constructor
 * @augments Error
 */
module.exports.Client.MapsNotGenerated = function () {
  this.message = 'maps not generated';
  this.name = 'MapsNotGenerated';
  this.stack = (new Error()).stack;
};
module.exports.Client.MapsNotGenerated.prototype = new Error;
module.exports.Client.MapsNotGenerated.prototype.constructor = module.exports.Client.MapsNotGenerated;

/**
 *
 * @param {Date} date
 * @param {Client.MapDifficulty} difficulty
 * @param {Object} options - passed to #getMapIdsByDate (though _not_ #getMap).
 * @returns {Q.Promise} Results with a Map object on success. May fail with a MapsNotGenerated error if the specified difficulty is not yet available.
 */
module.exports.Client.prototype.getMapByDateAndDifficulty = function (date, difficulty, options) {
  var klass = Object.getPrototypeOf(this).constructor;
  var self = this;

  return this.getMapIdsByDate(date, options).then(function (mapIds) {
    if(mapIds === null) {
      throw new klass.MapsNotGenerated();
    } else if(mapIds.length === 1 ) {
      if(difficulty === klass.MapDifficulty.ULTRA_COMPLEX) {
        return self.getMap(mapIds[0]);
      } else {
        throw new klass.MapsNotGenerated();
      }
    } else if(mapIds.length < Object.keys(klass.MapDifficulty).length) {
      throw new Error('bad mapIds: ' + JSON.stringify(mapIds));
    } else {
      return self.getMap(mapIds[difficulty]);
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
              deferred.reject({ response: response, body: buffer });
            }
          } else {
            deferred.reject({ response: response, body: buffer });
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
            try {
              deferred.resolve(buffer);
            } catch(e) {
              deferred.reject({ response: response, body: buffer });
            }
          } else {
            deferred.reject({ response: response, body: buffer });
          }
        });
      }
  );

  // End the request with an empty body.
  request.end();

  return deferred.promise;
};
