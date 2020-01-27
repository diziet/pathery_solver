/** @module pathery */

var URL = require('url');

var strftime = require('strftime');
var _ = require('underscore');

var Analyst = require(__dirname + '/analyst.js');

/**
 *
 * @param {Object} rawObject
 * @param {Object} [urlOptions]
 * @constructor Map
 */
const Map = module.exports = function (rawObject, urlOptions) {
  /** @member {Object} */
  this.rawObject = rawObject;
  /** @member {Object} */
  this.urlOptions = urlOptions;

  // The following members are stored for convenience; all are derivable from rawObject.

  /** @member {String} */
  this.code = rawObject.code;
  /** @member {Number} */
  this.height = parseInt(rawObject.height);
  /** @member {Number} */
  this.width = parseInt(rawObject.width);

  /** @member {String[][]} */
  this.board = parseBoard(this.code, this.height, this.width);

  /** @member {Number} */
  this.id = rawObject.ID;
  /** @member {String} */
  this.name = rawObject.name;
  /** @member {Number} */
  this.walls = parseInt(rawObject.walls);
};

Map.build = function (attributes) {
  return new Map(attributes.rawObject, attributes.urlOptions);
};

/**
 * A string representing the last open date for this map, e.g. `2014-04-02`.
 *
 * @returns {String}
 */
Map.prototype.dateString = function () {
  return this._dateString || (this._dateString = strftime('%Y-%m-%d', new Date((this.rawObject.dateExpires - 1) * 1000)));
};

/**
 *
 * @returns {PatheryGraph}
 */
Map.prototype.graph = function () {
  return this._graph || (this._graph = new Analyst.PatheryGraph(this.board));
};

/**
 *
 * @returns {Object}
 */
Map.prototype.serializableHash = function () {
  return {
    rawObject: this.rawObject,
    urlOptions: this.urlOptions
  };
};

/**
 * Return a URL appropriate for viewing this map in a browser, e.g. `http://www.pathery.com/scores#2014-04-02_4543_1_`.
 *
 * @returns {String}
 */
Map.prototype.url = function () {
  if(this._url === undefined) {
    if(this.urlOptions) {
      var specializedURLOptions = _.extend(
          {
            hash: '#' + this.dateString() + '_' + this.id + '_1_',
            pathname: '/scores'
          },
          this.urlOptions
      );

      this._url = URL.format(specializedURLOptions);
    } else {
      this._url = null;
    }
  }

  return this._url;
};

/**
 * The map score if no blocks have been placed.
 *
 * N.B.: It _is_ possible to get a lower score on the map by placing blocks in such a way that they force a beneficial
 *     teleport.
 *
 * @returns {Number}
 */
Map.prototype.virginalScore = function () {
  return this._virginalScore || (this._virginalScore = Analyst.find_pathery_path(this.graph(), []).value);
};

/**
 * Adapted from Therapist.parse_board for use in Map constructor.
 *
 * @private
 * @static
 *
 * @param {String} code
 * @param {Number} height
 * @param {Number} width
 * @returns {String[][]}
 */
function parseBoard(code) {
  var head = code.split(':')[0];
  var body = code.split(':')[1];

  var head = head.split('.');
  //var dims = head[0].split('x');
  var width = parseInt(head[0]);
  var height = parseInt(head[1]);

//  if (head[1][0] != 'c') {console.log('head[1][0] was ' + head[1][0] + ' expected c');}
//  var targets = parseInt(head[1].slice(1));

//  if (head[2][0] != 'r') {console.log('head[2][0] was ' + head[2][0] + ' expected r');}

//  if (head[3][0] != 'w') {console.log('head[3][0] was ' + head[3][0] + ' expected w');}
  var walls_remaining = parseInt(head[2]);

//  if (head[4][0] != 't') {console.log('head[4][0] was ' + head[4][0] + ' expected t');}
//  var teleports = parseInt(head[4].slice(1))

  var data = new Array();
  var i, j;
  for (i = 0; i < height; i++) {
      var row = new Array();
      for (j = 0; j < width; j++) {
          row[j] = ' ';
      }
      data[i] = row;
  }

  var i = -1;
  var j = width - 1;
  var body_split = body.split('.').slice(0, -1);

  for (var k = 0; k < body_split.length; k++) {
      var item = body_split[k].split(',');
      if (item[0] == "") { item[0] = "0" }
      for (var l = 0; l < parseInt(item[0]) + 1; l++) {
          j += 1;
          if (j >= width) {
              j = 0;
              i += 1;
          }
      }
      var type = item[1];
      data[i][j] = type;
      console.log(data);
  }

  var board = [];
  for (var i in data) {
   board.push(data[i]);
  }
  return board

  // return {
  //   board: data,
  //   walls_remaining: walls_remaining,
  // };
}
