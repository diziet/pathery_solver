/******************************************************************************
  Example usage:

      MAP_ID=4572 \
        OPTIMAL_SCORE=61 \
        BENCHMARK_ITERATION_COUNT=6 \
        BENCHMARK_ITERATION_TIMEOUT=60000 \
        BENCHMARK_ATTRIBUTE_NAME=placeBlockVersion \
        BENCHMARK_ATTRIBUTE_DOMAIN='["Oliver", "Michael01", "Michael02"]' \
        node test/benchmark.js

 ******************************************************************************/

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
var mapId = parseInt(process.env.MAP_ID);
if(!mapId) throw new Error('Missing required environment variable MAP_ID.');

/**
 * @variable {Number}
 */
var optimalScore = parseInt(process.env.OPTIMAL_SCORE);
if(!optimalScore) throw new Error('Missing required environment variable OPTIMAL_SCORE.');

/**
 * The number of benchmark iterations to run. Must be greater than zero and less than or equal to the number of SEEDS.
 *
 * @variable {Number}
 */
var benchmarkIterationCount = parseInt(process.env.BENCHMARK_ITERATION_COUNT) || SEEDS.length;
if(benchmarkIterationCount <= 0) throw new Error('BENCHMARK_ITERATION_COUNT must be greater than zero.');
if(benchmarkIterationCount > SEEDS.length) throw new Error('BENCHMARK_ITERATION_COUNT must be less than or equal to the number of seeds (' + SEEDS.length + ').');

/**
 * Maximum time to allow an iteration to run (in milliseconds).
 *
 * @variable {Number}
 */
var benchmarkIterationTimeout = parseInt(process.env.BENCHMARK_ITERATION_TIMEOUT) || (2 * 60 * 1000);

/**
 * The name of the attribute (from the keys of ExploratoryUtilities.CONFIGURATION_DEFAULTS) to benchmark across.
 *
 * @variable {String}
 */
var configurationAttributeToBenchmarkName = process.env.BENCHMARK_ATTRIBUTE_NAME;
if(!configurationAttributeToBenchmarkName) throw new Error('Missing required environment variable BENCHMARK_ATTRIBUTE_NAME.');
if(!ExploratoryUtilities.CONFIGURATION_DEFAULTS.hasOwnProperty(configurationAttributeToBenchmarkName)) throw new Error('Unknown BENCHMARK_ATTRIBUTE_NAME.');

/**
 * The values of the attribute to benchmark across.
 *
 * @variable {Array}
 */
var configurationAttributeToBenchmarkDomain = JSON.parse(process.env.BENCHMARK_ATTRIBUTE_DOMAIN);
if(!(configurationAttributeToBenchmarkDomain instanceof Array)) throw new Error('BENCHMARK_ATTRIBUTE_DOMAIN must be an array.');
if(configurationAttributeToBenchmarkDomain.length === 0) throw new Error('BENCHMARK_ATTRIBUTE_DOMAIN may not be empty.');

////////////////////////////////////////////////////////////////////////////////
// Setup.

ExploratoryUtilities.useRepeatableRandomNumbers(1);

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
        var workerTimeout;

        workerEnv[ExploratoryUtilities.CONFIGURATION_ENV_VARIABLE_PREFIX + 'exhaustiveSearchDelayIterations'] = 5000;
        workerEnv[ExploratoryUtilities.CONFIGURATION_ENV_VARIABLE_PREFIX + 'repeatableRandomNumbers'] = benchmarkIterationParameter.seed;
        workerEnv[ExploratoryUtilities.CONFIGURATION_ENV_VARIABLE_PREFIX + configurationAttributeToBenchmarkName] = jsonifiedVersionToBenchmark;

        worker = MultiprocessingCoordinator.startWorker(map, map.graph().listify_blocks(benchmarkIterationParameter.initialBlocks), { workerEnv: workerEnv }, function (childTopResult) {
          topResultTracker.registerResult(childTopResult);

          if(topResultTracker.isOptimal()) {
            foundOptimal = true;

            worker.kill();
          }
        });

        workerTimeout = setTimeout(function () { worker.kill(); }, benchmarkIterationTimeout);

        worker.on('exit', function () {
          clearTimeout(workerTimeout);

          if(foundOptimal) {
            recordBenchmarkResult(jsonifiedVersionToBenchmark, Date.now() - startTime);
          } else {
            console.warn('Worker for', jsonifiedVersionToBenchmark, 'terminated before reaching the optimal solution.');
          }

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
        });
      }

      function onBenchmarkingComplete() {
        for(var jsonifiedVersionToBenchmark in benchmarkResults) {
          if(benchmarkResults.hasOwnProperty(jsonifiedVersionToBenchmark)) {
            var benchmarkRuntimeListForVersion = benchmarkResults[jsonifiedVersionToBenchmark];
            var versionToBenchmark = JSON.parse(jsonifiedVersionToBenchmark);

            console.log('********************************************************************************');
            console.log('version', versionToBenchmark);
            console.log('runtimes (milliseconds)', benchmarkRuntimeListForVersion);
            console.log('unsolved count', benchmarkIterationCount - benchmarkRuntimeListForVersion.length);
            console.log(
                'average runtime (seconds)',
                benchmarkRuntimeListForVersion.reduce(
                    function (memo, runTime) {
                      return memo + runTime;
                    },
                    0
                ) / (benchmarkRuntimeListForVersion.length * 1000)
            );
          }
        }

        MultiprocessingCoordinator.stopAll();
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
