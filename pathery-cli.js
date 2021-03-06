var FS = require('fs');

var Getopt = require('node-getopt');
var strftime = require('strftime');
var _ = require('underscore');

var Analyst = require(__dirname + '/src/analyst.js');
var PatheryAPI = require(__dirname + '/src/communication/api.js');
var MultiprocessingCoordinator = require(__dirname + '/src/solver/multiprocessing/coordinator.js');
var TopResultTracker = require(__dirname + '/src/top-result-tracker.js');

////////////////////////////////////////////////////////////////////////////////
// Constants and globals.

const DATE_DOMAIN_DESCRIPTION = 'TODAY, TOMORROW, or an appropriate value for Date.parse';
const DIFFICULTY_DOMAIN_DESCRIPTION = 'an integer between 0 and ' + (Object.keys(PatheryAPI.MapDifficulty).length - 1) + ' or one of ' + Object.keys(PatheryAPI.MapDifficulty).join(', ');

var configuration = {
  hostname: PatheryAPI.Client.DEFAULT_HOSTNAME,
  mapsCache: PatheryAPI.Client.DEFAULT_MAPS_CACHE,
  port: PatheryAPI.Client.DEFAULT_PORT,
  monitoringReportDirectory: null,
  optimalScore: null,
  stopMonitoringServer: true,
  printResults: true,
  softRestartAfter: null,
  workerCount: 1,
  startAt: null,
  retryOnNotFoundDelay: null,
  postResults: false,
  auth: null,
  userId: null
};
var commandInfo;

////////////////////////////////////////////////////////////////////////////////
// Setup and run Getopt.

var getopt = new Getopt([
    // Config file. Should be parsed first.
    ['', 'config-file=PATH', 'Path to a JSON file with a hash of values which will be merged into configuration. See config/cli.example.json for an example.'],
    // Pathery server options.
    ['', 'hostname=STRING', 'The hostname for the pathery server (default: ' + PatheryAPI.Client.DEFAULT_HOSTNAME + ').'],
    ['', 'maps-cache=STRING', 'Path where maps are stored locally (default: ' + PatheryAPI.Client.DEFAULT_MAPS_CACHE + '). If empty, the local cache will not be used.'],
    ['', 'port=INT', 'The port for the pathery server (default: ' + PatheryAPI.Client.DEFAULT_PORT + ').'],
    // Miscellaneous options.
    ['', 'monitoring-report-directory=PATH', 'If set, a report will be written to this directory by Solver.Monitoring.Server (assuming it is enabled) when the process exits (optional).'],
    ['', 'optimal-score=INT', 'The optimal score for the map (optional). If set, execution will be terminated once this score is reached.'],
    ['', 'no-stop-monitoring-server', 'Do not stop the monitoring HTTP server when the optimal score is reached (primarily useful for debugging/developing the server output).'],
    ['', 'no-print-results', 'Do not print top results.'],
    ['', 'soft-restart-after=INT', 'Restart the workers (_not_ the main server) every X minutes (optional; 11 seems to be a good value for this).'],
    ['', 'workers=INT', 'The number of workers to use (default: 1).'],
    // Retry and timing options.
    ['', 'start-at=DATE', 'Wait until the specified date/time to start running, e.g. "2014-03-01 23:59:30", (optional).'],
    ['', 'retry-on-not-found-delay=INT', 'Number of seconds to wait after a 404 error before retrying the request (optional).'],
    // Result posting.
    ['', 'post-results', 'Post top results to the pathery server.'],
    ['', 'auth=STRING', 'Authentication key to use when authenticating with the pathery server (required to post results).'],
    ['', 'user-id=INT', 'User ID to use when authenticating with the pathery server (required to post results).'],
    // Help.
    ['h', 'help', 'Display this help.']
]);

getopt.bindHelp();
getopt.setHelp(
    'Usage: node pathery-cli.js [OPTIONS] <command> <command-parameters>\n' +
        '\n' +
        'Commands:\n' +
        '    map-by-id <MAP_ID>\n' +
        '    map-by-date-and-difficulty <DATE> <DIFFICULTY>\n' +
        '        DATE - ' + DATE_DOMAIN_DESCRIPTION + '. If set to TOMORROW, the --start-at option will be set to an appropriate value around midnight.\n' +
        '        DIFFICULTY - ' + DIFFICULTY_DOMAIN_DESCRIPTION + '.\n' +
        '\n' +
        'Options:\n' +
        '[[OPTIONS]]'
);

var opts = getopt.parse(process.argv.slice(2));

////////////////////////////////////////////////////////////////////////////////
// Parse the options.

var options = opts.options;

// Should be parsed first, so that other arguments will override it.
if(options.hasOwnProperty('config-file')) {
  _.extend(
      configuration,
      JSON.parse(FS.readFileSync(options['config-file'], { encoding: 'utf8' }))
  );
}

if(options.hasOwnProperty('hostname')) {
  configuration.hostname = options['hostname'];
}

if(options.hasOwnProperty('maps-cache')) {
  var rawMapsCache = options['maps-cache'];

  if(rawMapsCache) {
    configuration.mapsCache = rawMapsCache;
  } else {
    configuration.mapsCache = null;
  }
}

if(options.hasOwnProperty('port')) {
  configuration.port = parseInt(options['port']);

  if(!configuration.port) {
    console.error('--port requires an integral argument.');

    process.exit(2);
  }
}

if(options.hasOwnProperty('monitoring-report-directory')) {
  configuration.monitoringReportDirectory = options['monitoring-report-directory'];

  if(!configuration.monitoringReportDirectory) {
    console.error('--monitoring-report-directory requires a non-blank argument.');

    process.exit(2);
  }
}

if(options.hasOwnProperty('optimal-score')) {
  configuration.optimalScore = parseInt(options['optimal-score']);

  if(!configuration.optimalScore) {
    console.error('--optimal-score requires an integral argument.');

    process.exit(2);
  }
}

if(options.hasOwnProperty('no-stop-monitoring-server')) {
  configuration.stopMonitoringServer = !options['no-stop-monitoring-server'];
}

if(options.hasOwnProperty('no-print-results')) {
  configuration.printResults = !options['no-print-results'];
}

if(options.hasOwnProperty('soft-restart-after')) {
  var rawSoftRestartAfter = options['soft-restart-after'];

  if(rawSoftRestartAfter) {
    configuration.softRestartAfter = parseInt(rawSoftRestartAfter);

    if (!configuration.softRestartAfter) {
      console.error('--soft-restart-after requires an integral argument.');

      process.exit(2);
    }
  } else {
    configuration.softRestartAfter = null;
  }
}

if(options.hasOwnProperty('workers')) {
  configuration.workerCount = parseInt(options['workers']);

  if(!configuration.workerCount) {
    console.error('--workers requires an integral argument.');

    process.exit(2);
  }
}

if(options.hasOwnProperty('start-at')) {
  configuration.startAt = new Date(options['start-at']);

  if(!configuration.startAt) {
    console.error('--start-at requires a date argument.');

    process.exit(2);
  }
}

if(options.hasOwnProperty('retry-on-not-found-delay')) {
  var rawRetryOnNotFoundDelay = options['retry-on-not-found-delay'];

  if(rawRetryOnNotFoundDelay) {
    configuration.retryOnNotFoundDelay = parseInt(rawRetryOnNotFoundDelay);

    if(!configuration.retryOnNotFoundDelay) {
      console.error('--retry-on-not-found-delay requires an integral argument.');

      process.exit(2);
    }
  } else {
    configuration.retryOnNotFoundDelay = null;
  }
}

if(options.hasOwnProperty('post-results')) {
  configuration.postResults = options['post-results'];
}

if(options.hasOwnProperty('auth')) {
  configuration.auth = options['auth'];
}

if(options.hasOwnProperty('user-id')) {
  configuration.userId = parseInt(options['user-id']);

  if(!configuration.userId) {
    console.error('--user-id requires an integral argument.');

    process.exit(2);
  }
}

////////////////////////////////////////////////////////////////////////////////
// Parse the command and command parameters.

var args = opts.argv;
var command = args.shift();

switch(command) {
  case 'map-by-id':
    var mapId = parseInt(args.shift());

    if(isNaN(mapId)) {
      console.error('Bad MAP_ID.');

      commandInfo = null;
    } else {
      commandInfo = {
        execute: executeMapByIdCommand,
        parameters: {
          mapId: mapId
        }
      };
    }

    break;
  case 'map-by-date-and-difficulty':
    /** @variable {Date} */
    var date = (function (rawDate) {
      var dateMilliseconds;

      if(rawDate === 'TODAY') {
        dateMilliseconds = Date.now();
      }
      else if(rawDate === 'TOMORROW') {
        const OFFSET_FOR_TOMORROW = 3 * 60 * 60 * 1000;

        var startAt;

        dateMilliseconds = Date.now() + 24 * 60 * 60 * 1000;

        // If retryOnNotFoundDelay is set and less than 20 seconds, set start at to slightly before midnight, otherwise to 5 minutes after midnight.
        if(configuration.retryOnNotFoundDelay && configuration.retryOnNotFoundDelay <= 20) {
          startAt = new Date();

          startAt.setHours(23);
          startAt.setMinutes(59);
          startAt.setSeconds(55);
          startAt.setMilliseconds(0);
        } else {
          startAt = new Date(dateMilliseconds);

          startAt.setHours(0);
          startAt.setMinutes(5);
          startAt.setSeconds(0);
          startAt.setMilliseconds(0);
        }

        if(configuration.startAt) {
          console.log('Overriding --start-at parameter since DATE = TOMORROW');
        }

        configuration.startAt = new Date(startAt - OFFSET_FOR_TOMORROW);
      } else {
        dateMilliseconds = Date.parse(rawDate);
      }

      if(dateMilliseconds) {
        return new Date(dateMilliseconds);
      } else {
        console.error('Bad DATE - should be ' + DATE_DOMAIN_DESCRIPTION + '.');

        process.exit(3);
        return null;
      }
    })(args.shift());

    /** @variable {PatheryAPI.MapDifficulty} */
    var difficulty = (function (rawDifficulty) {
      var scratch;

      if(rawDifficulty && PatheryAPI.MapDifficulty.hasOwnProperty((scratch = rawDifficulty.toUpperCase()))) {
        return PatheryAPI.MapDifficulty[scratch];
      } else if(!isNaN(scratch = parseInt(rawDifficulty)) && scratch >= 0 && scratch < Object.keys(PatheryAPI.MapDifficulty).length) {
        return scratch;
      } else {
        console.error('Bad DIFFICULTY - should be ' + DIFFICULTY_DOMAIN_DESCRIPTION + '.');

        process.exit(3);
        return null;
      }
    })(args.shift());

    if(date === null || difficulty === null) {
      commandInfo = null;
    } else {
      commandInfo = {
        execute: executeMapByDateAndDifficultyCommand,
        parameters: {
          date: date,
          difficulty: difficulty
        }
      };
    }

    break;
  default:
    console.error('Unknown command: "' + command + '".');

    process.exit(3);
}

if(!commandInfo) {
  process.exit(3);
} else if(args.length !== 0) {
  console.error('Extraneous arguments', args);

  process.exit(3);
}

////////////////////////////////////////////////////////////////////////////////
// Validate the configuration.

if(configuration.monitoringReportDirectory) {
  var validMonitoringReportDirectory;

  try {
    var monitoringReportDirectoryStats = FS.statSync(configuration.monitoringReportDirectory);

    validMonitoringReportDirectory = monitoringReportDirectoryStats.isDirectory();
  } catch(e) {
    validMonitoringReportDirectory = false;
  }

  if(!validMonitoringReportDirectory) {
    console.error('The --monitoring-report-directory option requires a path to an existing directory.')

    process.exit(2);
  }
}

if(configuration.postResults) {
  if(!configuration.auth) {
    console.error('The --auth option is required if --post-results is set.');

    process.exit(2);
  }

  if(!configuration.userId) {
    console.error('The --user-id option is required if --post-results is set.');

    process.exit(2);
  }
}

////////////////////////////////////////////////////////////////////////////////
// Wait for the start time (if specified) and then execute the given command.

if(configuration.startAt) {
  var waitMilliseconds = configuration.startAt.getTime() - (new Date()).getTime();

  if(waitMilliseconds > 0) {
    console.log('Waiting', waitMilliseconds / 60000, 'minutes to start until', configuration.startAt, '(' + waitMilliseconds + ' milliseconds)');

    setTimeout(doExecuteCommand, waitMilliseconds);
  } else {
    doExecuteCommand(true);
  }
} else {
  doExecuteCommand(true);
}

/**
 * @param {Boolean} [wasNotDelayed] - Will be nil (i.e. not truthy) if called from a setTimeout.
 */
function doExecuteCommand(wasNotDelayed) {
  var client = new PatheryAPI.Client(configuration);

  if(!wasNotDelayed) {
    console.log('Started command execution at', new Date());
  }

  commandInfo.execute.call(null, client, configuration, commandInfo.parameters);
}

////////////////////////////////////////////////////////////////////////////////
// Command execution functions.

function executeMapByIdCommand(client, configuration, commandParameters) {
  /** @variable {Number} */
  var mapId = commandParameters.mapId;

  doGetMapAndSolve(true);

  ////////////////////
  // Helper functions.

  /**
   * @param {Boolean} [wasNotDelayed] - Will be nil (i.e. not truthy) if called from a setTimeout.
   */
  function doGetMapAndSolve(wasNotDelayed) {
    client.getMap(mapId, { preventHTTPCaching: !wasNotDelayed }).done(
        function (map) {
          solveMap(client, map, configuration);
        },
        function (error) {
          if(error instanceof PatheryAPI.APIError) {
            if(error.response.statusCode === 404 && configuration.retryOnNotFoundDelay) {
              console.log('map ' + mapId + ' not found -- retrying in ' + configuration.retryOnNotFoundDelay + ' seconds');

              setTimeout(doGetMapAndSolve, configuration.retryOnNotFoundDelay * 1000);
            } else {
              console.error('failed to get map ' + mapId + ': ' + error.response.statusCode + ' - "' + error.body + '"');
            }
          } else {
            throw error;
          }
        }
    );
  }
}

function executeMapByDateAndDifficultyCommand(client, configuration, commandParameters) {
  /** @variable {Date} */
  var date = commandParameters.date;
  /** @variable {PatheryAPI.MapDifficulty} */
  var difficulty = commandParameters.difficulty;

  doGetMapAndSolve(true);

  ////////////////////
  // Helper functions.

  /**
   * @param {Boolean} [wasNotDelayed] - Will be nil (i.e. not truthy) if called from a setTimeout.
   */
  function doGetMapAndSolve(wasNotDelayed) {
    client.getMapByDateAndDifficulty(date, difficulty, { preventHTTPCaching: !wasNotDelayed }).done(
        function (map) {
          console.log('Successfully retrieved map', map.id, 'at', new Date());

          solveMap(client, map, configuration);
        },
        function (error) {
          if(error instanceof PatheryAPI.MapNotGenerated && configuration.retryOnNotFoundDelay) {
            console.log('map for ' + date + ' with difficulty ' + difficulty + ' not found -- retrying in ' + configuration.retryOnNotFoundDelay + ' seconds');

            setTimeout(doGetMapAndSolve, configuration.retryOnNotFoundDelay * 1000);
          } else {
            throw error;
          }
        }
    );
  }
}

////////////////////////////////////////////////////////////////////////////////
// General functionality.

/**
 *
 * @param {PatheryAPI.Client} client
 * @param {Map} map
 * @param {Object} configuration
 */
function solveMap(client, map, configuration) {
  var softRestartTimer = null;
  var topResultTracker = new TopResultTracker(client, map, configuration);

  initializeAndRestartWorkers();

  process.on('SIGINT', function () {
    console.log('SIGINT received...exiting.');

    if(softRestartTimer) {
      clearTimeout(softRestartTimer);
    }

    MultiprocessingCoordinator.stopWorkers();

    handleMonitoringCleanup(true);
  });

  ////////////////////
  // Helper functions.

  /**
   *
   * @param {Boolean} [exitWhenFinished]
   */
  function handleMonitoringCleanup(exitWhenFinished) {
    if(configuration.monitoringReportDirectory) {
      var reportPath = configuration.monitoringReportDirectory + '/' + map.id + '.' + strftime('%Y%m%d%H%M%S', new Date()) + '.html';

      MultiprocessingCoordinator.writeMonitoringReport(reportPath, stopMonitoringServerIfSpecified);
    } else {
      stopMonitoringServerIfSpecified();
    }

    ////////////////////
    // Helper functions.

    function stopMonitoringServerIfSpecified() {
      if(exitWhenFinished) {
        MultiprocessingCoordinator.stopAll();

        // If we don't exit, then we will have to wait for any in-transit HTTP requests, as well as an requests to the
        // Solver.Monitoring.Server where 'Connection: keep-alive' is being honored.
        process.exit(0);
      } else if(configuration.stopMonitoringServer) {
        MultiprocessingCoordinator.stopAll();
      }
    }
  }

  /**
   * Start the workers, first stopping them if they were already running.
   */
  function initializeAndRestartWorkers() {
    MultiprocessingCoordinator.stopWorkers();

    for(var i = 0; i < configuration.workerCount; i++) {
      var initialBlocks = {};
      var wallsToPlace;

      if(map.walls === 999) {
        wallsToPlace = Math.floor(35 + Math.random() * 11);
      } else {
        wallsToPlace = map.walls;
      }

      for(var j = 0; j < wallsToPlace; j++) {
        Analyst.randomlyPlaceBlock(map.graph(), initialBlocks);
      }

      MultiprocessingCoordinator.startWorker(map, map.graph().listify_blocks(initialBlocks), {}, onNewChildResult);
    }

    if(configuration.softRestartAfter) {
      softRestartTimer = setTimeout(initializeAndRestartWorkers, configuration.softRestartAfter * 60 * 1000);
    }
  }

  /**
   *
   * @param {{score: Number, solution: Number[][]}} childTopResult
   */
  function onNewChildResult(childTopResult) {
    topResultTracker.registerResult(childTopResult);

    if(topResultTracker.isOptimal()) {
      console.log('Reached optimal score...stopping workers.');

      MultiprocessingCoordinator.stopWorkers();

      handleMonitoringCleanup();
    }
  }
}
