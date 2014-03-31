/**
 * Functionality useful for experimental/exploratory purposed (e.g. configuration switching, timing, etc).
 *
 * @module pathery/exploratory-utilities
 */

var FS = require('fs');

var _ = require('underscore');

////////////////////////////////////////////////////////////////////////////////
// Global(ish) configuration.

module.exports.CONFIGURATION_DEFAULTS = {
  placeBlockVersion: 'Oliver',
  repeatableRandomNumbers: false
};

module.exports.CONFIGURATION_ENV_VARIABLE_PREFIX = 'PATHERY_EXPLORATORY_CONFIG_';

/**
 * Experimental/exploratory configuration. Defaults specified in CONFIGURATION_DEFAULTS, which are overriden by
 * properties in config/exploratory.json if it exists (see config/exploratory.example.json for an example), which are in
 * turn overriden by the environment variable with the given name prefixed by "PATHERY_EXPLORATORY_CONFIG_" (e.g.
 * "PATHERY_EXPLORATORY_CONFIG_placeBlockVersion"), if it exists, parsed as JSON.
 *
 * N.B.: Changing these during runtime may or may not have the desired effect.
 *
 * @property {Object} configuration
 * @property {String} configuration.placeBlockVersion
 * @property {Number | Boolean} configuration.repeatableRandomNumbers
 */
module.exports.configuration = (function () {
  var configuration = _.extend({ }, module.exports.CONFIGURATION_DEFAULTS);
  var rawConfigFileContents;

  try {
    rawConfigFileContents = FS.readFileSync(__dirname + '/../config/exploratory.json', { encoding: 'utf8' })
  } catch(e) {
    if(e.code === 'ENOENT') {
      rawConfigFileContents = null;
    } else {
      throw e;
    }
  }

  if(rawConfigFileContents) {
    _.extend(configuration, JSON.parse(rawConfigFileContents));
  }

  for(var k in module.exports.CONFIGURATION_DEFAULTS) {
    if(module.exports.CONFIGURATION_DEFAULTS.hasOwnProperty(k)) {
      var envVariableValue = process.env[module.exports.CONFIGURATION_ENV_VARIABLE_PREFIX + k];

      if(envVariableValue) {
        configuration[k] = JSON.parse(envVariableValue);
      }
    }
  }

  return configuration;
})();

////////////////////////////////////////////////////////////////////////////////
// Seeded randomization.

/**
 * By default is simply an alias for Math.random. Changed to a drop-in replacement for Math.random which supports
 * seeding (and thus repeatability) if configuration.repeatableRandomNumbers is truthy or via a call to
 * useRepeatableRandomNumbers.
 *
 * @function
 *
 * @returns {Number} [0.0, 1.0)
 */
module.exports.random = Math.random;

/**
 * Set random to use a seeded random number generator.
 *
 * N.B.: If testing variations which are influenced by or modify the sequence of random numbers, comparisons made when
 *     using this must be taken with a **huge** grain of salt.
 *
 * @param {Number | *} [seed] - If a number, said value is used to see the generator function.
 */
module.exports.useRepeatableRandomNumbers = function (seed) {
  // No need to do this other than for debugging/reflection clarity.
  module.exports.configuration.repeatableRandomNumbers = seed || true;

  // Adapted from http://en.wikipedia.org/wiki/Random_number_generation#Computational_methods.

  const MASK_TO_INT_32 = 0xffffffff;

  var m_w;              // Must not be zero nor 0x464fffff.
  var m_z = 987654321;  // Must not be zero nor 0x9068ffff.

  if(typeof seed === 'number') {
    seed = seed & MASK_TO_INT_32;

    if(seed === 0 || seed === 0x464fffff) {
      throw new Error('bad seed');
    } else {
      m_w = seed;
    }
  } else {
    m_w = 123456789;
  }

  module.exports.random = function () {
    m_z = (36969 * (m_z & 65535) + (m_z >> 16)) & MASK_TO_INT_32;
    m_w = (18000 * (m_w & 65535) + (m_w >> 16)) & MASK_TO_INT_32;


    return (((m_z << 16) + m_w) & MASK_TO_INT_32) / 4294967296 + 0.5;
  };
};

if(module.exports.configuration.repeatableRandomNumbers) {
  module.exports.useRepeatableRandomNumbers(module.exports.configuration.repeatableRandomNumbers);
}

////////////////////////////////////////////////////////////////////////////////
// Utility functions.

/**
 * Convert the path as returned by the server into a listified path.
 *
 * @param serverPathObject - The path component from e.g. module:pathery/communication/api.postSolution.
 * @returns {Array}
 */
module.exports.convertServerPathToListifiedPath = function (serverPathObject) {
  var startBlock = convertServerBlock(serverPathObject.start);
  var endBlock = convertServerBlock(serverPathObject.end);
  var serverPathComponents = serverPathObject.path.split('');
  var path = [];
  var lastPushedBlock;

  if(!validDestinationComponent(serverPathComponents.shift())) {
    throw new Error('invariant');
  }
  if(serverPathComponents.pop() !== 'r') {
    throw new Error('invariant');
  }

  lastPushedBlock = startBlock;
  path.push(lastPushedBlock);

  for(var i = 0; i < serverPathComponents.length; i++) {
    var currBlock;

    switch(serverPathComponents[i]) {
      case '1':
        currBlock = [
          lastPushedBlock[0] - 1,
          lastPushedBlock[1]
        ];

        break;
      case '2':
        currBlock = [
          lastPushedBlock[0],
          lastPushedBlock[1] + 1
        ];

        break;
      case '3':
        currBlock = [
          lastPushedBlock[0] + 1,
          lastPushedBlock[1]
        ];

        break;
      case '4':
        currBlock = [
          lastPushedBlock[0],
          lastPushedBlock[1] - 1
        ];

        break;
      case 'r':
        if(!validDestinationComponent(serverPathComponents[++i])) {
          throw new Error('invariant');
        }

        currBlock = null;

        break;
      default:
        throw new Error('invariant');
    }

    if(currBlock) {
      path.push(currBlock);
      lastPushedBlock = currBlock;
    }
  }

  if(lastPushedBlock[0] !== endBlock[0] || lastPushedBlock[1] !== endBlock[1]) {
    throw new Error('invariant');
  }

  return path;

  ////////////////////
  // Helper functions.

  /**
   * Convert from the server block format to the listified format.
   *
   * @param {String} serverBlock - e.g. "12,4".
   * @returns {Number[]} E.g. [3, 12].
   */
  function convertServerBlock(serverBlock) {
    var blockComponents = serverBlock.split(',');
    var serverX = parseInt(blockComponents[1]);
    var serverY = parseInt(blockComponents[0]);

    if(isNaN(serverX) || isNaN(serverY)) {
      throw new Error('invariant');
    }

    return [serverX - 1, serverY];
  }

  function validDestinationComponent(component) {
    return {
      a: true,
      b: true,
      c: true,
      d: true,
      e: true,
      f: true
    }[component];
  }
};
