/**
 * Functionality useful for experimental/exploratory purposed (e.g. configuration switching, timing, etc).
 *
 * @module pathery/exploratory-utilities
 */

var FS = require('fs');

var _ = require('underscore');

const CONFIGURATION_DEFAULTS = {
  placeBlockVersion: 'Oliver',
  repeatableRandomNumbers: false
};

const CONFIGURATION_ENV_VARIABLE_PREFIX = 'PATHERY_EXPLORATORY_CONFIG_';

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
 * @property {Boolean} configuration.repeatableRandomNumbers
 */
var configuration = module.exports.configuration = (function () {
  var configuration = _.extend({ }, CONFIGURATION_DEFAULTS);
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

  for(var k in CONFIGURATION_DEFAULTS) {
    if(CONFIGURATION_DEFAULTS.hasOwnProperty(k)) {
      var envVariableValue = process.env[CONFIGURATION_ENV_VARIABLE_PREFIX + k];

      if(envVariableValue) {
        configuration[k] = JSON.parse(envVariableValue);
      }
    }
  }

  return configuration;
})();

if(configuration.repeatableRandomNumbers) {
  /**
   * Drop-in replacement for Math.random, returns a number between 0.0 (inclusive) and 1.0 (exclusive).
   *
   * @return {Number}
   */
  module.exports.random = (function () {
    // Taken from http://stackoverflow.com/a/19301306.

    const MASK = 0xffffffff;

    var m_w = 123456789;
    var m_z = 987654321;

    return function () {
      m_z = (36969 * (m_z & 65535) + (m_z >> 16)) & MASK;
      m_w = (18000 * (m_w & 65535) + (m_w >> 16)) & MASK;


      return (((m_z << 16) + m_w) & MASK) / 4294967296 + 0.5;
    };
  })();
} else {
  module.exports.random = Math.random;
}
