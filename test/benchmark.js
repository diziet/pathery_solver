//
// TODO: Document usage.
// TODO: Support parsing parameters from environment variables.
//

var _ = require('underscore');

var Analyst = require(__dirname + '/../src/analyst.js');
var ExploratoryUtilities = require(__dirname + '/../src/exploratory-utilities.js');
var MultiprocessingCoordinator = require(__dirname + '/../src/solver/multiprocessing/coordinator.js');
var PatheryAPI = require(__dirname + '/../src/communication/api.js');
var TopResultTracker = require(__dirname + '/../src/top-result-tracker.js');

////////////////////////////////////////////////////////////////////////////////
// Constants.

/**
 * Seed values to use when benchmarking.
 *
 * @constant {Number[]}
 */
const SEEDS = [
    513409157,
    123456789,
    158904762,
    158095704,
    427689215,
    896781157
];

////////////////////////////////////////////////////////////////////////////////
// Parameters.

/**
 * @variable {Number}
 */
var mapId = 4521;

/**
 * @variable {Number}
 */
var optimalScore = 47;

/**
 * The number of benchmark iterations to run. Must be greater than zero and less than or equal to the number of SEEDS.
 *
 * @variable {Number}
 */
var benchmarkIterationCount = 6;

/**
 * The name of the attribute (from the keys of ExploratoryUtilities.CONFIGURATION_DEFAULTS) to benchmark across.
 *
 * @variable {String}
 */
var configurationAttributeToBenchmarkName = 'placeBlockVersion';
/**
 * The values of the attribute to benchmark across.
 *
 * @variable {Array}
 */
var configurationAttributeToBenchmarkDomain = ['Oliver', 'Michael'];

////////////////////////////////////////////////////////////////////////////////
// Setup and sanity checks.

ExploratoryUtilities.useRepeatableRandomNumbers(1);

if(benchmarkIterationCount <= 0) {
  throw new Error('benchmarkIterationCount must be greater than zero');
}

if(benchmarkIterationCount > SEEDS.length) {
  throw new Error('benchmarkIterationCount must be less than or equal to the number of seeds');
}

if(!ExploratoryUtilities.CONFIGURATION_DEFAULTS.hasOwnProperty(configurationAttributeToBenchmarkName)) {
  throw new Error('Unknown configurationAttributeToBenchmarkName');
}

if(configurationAttributeToBenchmarkDomain.length === 0) {
  throw new Error('configurationAttributeToBenchmarkDomain may not be empty');
}

////////////////////////////////////////////////////////////////////////////////
// Main logic.

/**
 * Array of JSON representations of the values of configurationAttributeToBenchmarkDomain.
 *
 * @variable {String[]}
 */
var initialJsonifiedVersionsToBenchmark = configurationAttributeToBenchmarkDomain.map(function (versionToBenchmark) { return JSON.stringify(versionToBenchmark); });

(new PatheryAPI.Client()).getMap(mapId).done(
    function (map) {
      /**
       * Array of parameters which traverse for each value in initialJsonifiedVersionsToBenchmark.
       *
       * @variable {{initialBlocks: Number[][], seed: Number}[]}
       */
      var initialBenchmarkIterationParameters = SEEDS.slice(0, benchmarkIterationCount).map(function (seed) {
        var initialBlocks = {};

        for(var j = 0; j < map.walls; j++) {
          Analyst.placeBlock(map.graph(), initialBlocks);
        }

        return {
          initialBlocks: initialBlocks,
          seed: seed
        }
      });
      /**
       * Hash from jsonifiedVersionToBenchmark string to arrays of runtime numbers.
       *
       * @variable {{}}
       */
      var benchmarkResults = {};

      doBenchmark(initialJsonifiedVersionsToBenchmark.slice(0), initialBenchmarkIterationParameters.slice(0));

      ////////////////////
      // Helper functions.

      /**
       * Processes a single (jsonifiedVersionToBenchmark, benchmarkIterationParameter) pair and then calls itself
       * recursively to iterate through initialJsonifiedVersionsToBenchmark cross initialBenchmarkIterationParameters.
       *
       * @param {String[]} remainingJsonifiedVersionsToBenchmark - Copy of initialJsonifiedVersionsToBenchmark. At the
       *     end of this function, we shift an element off this array if all initialBenchmarkIterationParameters have
       *     been processed for the current head (i.e. remainingBenchmarkIterationParameters is empty).
       * @param {{initialBlocks: Number[][], seed: Number}[]} remainingBenchmarkIterationParameters - Copy of
       *     initialBenchmarkIterationParameters. We consume one element per call.
       */
      function doBenchmark(remainingJsonifiedVersionsToBenchmark, remainingBenchmarkIterationParameters) {
        var jsonifiedVersionToBenchmark = remainingJsonifiedVersionsToBenchmark[0];
        var benchmarkIterationParameter = remainingBenchmarkIterationParameters.shift();

        var foundOptimal = false;
        var topResultTracker = new TopResultTracker(null, map, { optimalScore: optimalScore, printResults: false });
        var startTime = Date.now();
        var worker;
        var workerEnv = _.extend({}, process.env);

        workerEnv[ExploratoryUtilities.CONFIGURATION_ENV_VARIABLE_PREFIX + 'repeatableRandomNumbers'] = benchmarkIterationParameter.seed;
        workerEnv[ExploratoryUtilities.CONFIGURATION_ENV_VARIABLE_PREFIX + configurationAttributeToBenchmarkName] = jsonifiedVersionToBenchmark;

        worker = MultiprocessingCoordinator.startWorker(map.graph(), map.graph().listify_blocks(benchmarkIterationParameter.initialBlocks), { workerEnv: workerEnv }, function (childTopResult) {
          topResultTracker.registerResult(childTopResult);

          if(topResultTracker.isOptimal()) {
            foundOptimal = true;

            worker.kill();
          }
        });

        worker.on('exit', function () {
          if(foundOptimal) {
            recordBenchmarkResult(jsonifiedVersionToBenchmark, Date.now() - startTime);

            if(remainingBenchmarkIterationParameters.length === 0) {
              remainingJsonifiedVersionsToBenchmark.shift();

              if(remainingJsonifiedVersionsToBenchmark.length === 0) {
                onBenchmarkingComplete();
              } else {
                doBenchmark(remainingJsonifiedVersionsToBenchmark, initialBenchmarkIterationParameters.slice(0));
              }
            } else {
              doBenchmark(remainingJsonifiedVersionsToBenchmark, remainingBenchmarkIterationParameters);
            }
          } else {
            console.error("Worker terminated before reaching the optimal solution");
          }
        });
      }

      function onBenchmarkingComplete() {
        for(var jsonifiedVersionToBenchmark in benchmarkResults) {
          if(benchmarkResults.hasOwnProperty(jsonifiedVersionToBenchmark)) {
            var benchmarkRuntimeListForVersion = benchmarkResults[jsonifiedVersionToBenchmark];
            var versionToBenchmark = JSON.parse(jsonifiedVersionToBenchmark);

            if(benchmarkRuntimeListForVersion.length !== benchmarkIterationCount) {
              throw new Error('invariant');
            }

            console.log('********************************************************************************');
            console.log('version', versionToBenchmark);
            console.log('runtimes (milliseconds)', benchmarkRuntimeListForVersion);
            console.log(
                'average runtime (seconds)',
                benchmarkRuntimeListForVersion.reduce(
                    function (memo, runTime) {
                      return memo + runTime;
                    },
                    0
                ) / (benchmarkIterationCount * 1000)
            );
          }
        }

        MultiprocessingCoordinator.terminate();
      }

      /**
       *
       * @param {String} jsonifiedVersionToBenchmark
       * @param {Number} runTime
       */
      function recordBenchmarkResult(jsonifiedVersionToBenchmark, runTime) {
        console.log('Recording', runTime / 1000, 'seconds for', jsonifiedVersionToBenchmark);

        (benchmarkResults[jsonifiedVersionToBenchmark] || (benchmarkResults[jsonifiedVersionToBenchmark] = [])).push(runTime);
      }
    }
);
