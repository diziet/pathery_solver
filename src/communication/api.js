/** @module pathery/communication/api */

var http = require('http');
var QueryString = require('querystring');

var Q = require('q');

var Map = require(__dirname + '/../map.js');

/**
 *
 * @param {Object} [attributes]
 * @constructor
 */
module.exports.Client = function (attributes) {
  if(attributes) {
    /** @member {String} */
    this.auth = attributes['auth'];

    /** @member {String} */
    this.hostname = attributes['hostname'];

    /** @member {Number} */
    this.port = attributes['port'];

    /** @member {Number} */
    this.userId = attributes['userId'];
  }
};

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
 * N.B.: This appears to update late (possibly due to intermediate caching). If the preventDelayed option works for
 *     #getMap, it will likely work here as well.
 *
 * @param {Date} date
 * @returns {Q.Promise}
 */
module.exports.Client.prototype.getMapIdsByDate = function (date) {
  return this.getJSON('/a/mapsbydate/' + date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate() + '.js');
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
