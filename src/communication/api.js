/** @module pathery/communication/api */

var http = require('http');
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
 * @returns {Q.Promise} Resolves with a Map object.
 */
module.exports.Client.prototype.getMap = function (mapId) {
  return this.getJSON('/a/map/' + mapId + '.js').then(function (rawMapObject) {
    return new Map(rawMapObject);
  });
};

/**
 * N.B.: This appears to update late (possibly due to intermediate caching).
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
  var params = [
    'isChallenge=false',
    'r=getpath',
    'mapcode=' + map.code,
    'mapid=' + map.id,
    'solution=' + solution.reduce(
        function (memo, currCell) {
          return memo + (currCell[0] + 1) + ',' + currCell[1] + '.';
        },
        '.'
    )
  ];

  return this.post('/do.php?' + params.join('&'), { doAuthenticate: true });
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
        switch(response.statusCode) {
          case 200:
            var buffer = '';

            response.setEncoding('utf8');

            response.on('data', function (chunk) {
              buffer += chunk;
            });

            response.on('end', function() {
              try {
                deferred.resolve(JSON.parse(buffer));
              } catch(e) {
                deferred.reject(response);
              }
            });

            break;
          default:
            deferred.reject(response)
        }
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
        switch(response.statusCode) {
          case 200:
          case 302:
            var buffer = '';

            response.setEncoding('utf8');

            response.on('data', function (chunk) {
              buffer += chunk;
            });

            response.on('end', function() {
              deferred.resolve(buffer);
            });

            break;
          default:
            deferred.reject(response)
        }
      }
  );

  // End the request with an empty body.
  request.end();

  return deferred.promise;
};
