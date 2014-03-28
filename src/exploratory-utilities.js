/**
 * Functionality useful for experimental/exploratory purposed (e.g. configuration switching, timing, etc).
 *
 * @module pathery/exploratory-utilities
 */

var FS = require('fs');

var _ = require('underscore');

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
