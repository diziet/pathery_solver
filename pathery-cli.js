var ChildProcess = require('child_process');
var FS = require('fs');

var Getopt = require('node-getopt');
var _ = require('underscore');

var Analyst = require(__dirname + '/src/analyst.js');
var PatheryAPI = require(__dirname + '/src/communication/api.js');
var TopResultTracker = require(__dirname + '/src/top-result-tracker.js');

////////////////////////////////////////////////////////////////////////////////
// Parameter parsing.

const DEFAULT_HOSTNAME = 'www.pathery.com';
const DEFAULT_PORT = 80;

var command;
var commandParameters;
var configuration = {
  hostname: DEFAULT_HOSTNAME,
  port: DEFAULT_PORT,
  optimalScore: null,
  workerCount: 1,
  startAt: null,
  retryOnNotFoundDelay: null,
  postResults: false,
  auth: null,
  userId: null
};

var getopt = new Getopt([
    // Config file. Should be parsed first.
    ['', 'config-file=PATH', 'Path to a JSON file with a hash of values which will be merged into configuration. See config/example.json for an example.'],
    // Pathery server options.
    ['', 'hostname=STRING', 'The hostname for the pathery server (default: ' + DEFAULT_HOSTNAME + ').'],
    ['', 'port=INT', 'The port for the pathery server (default: ' + DEFAULT_PORT + ').'],
    // Miscellaneous options.
    ['', 'optimal-score=INT', 'The optimal score for the map (optional). If set, execution will be terminated once this score is reached.'],
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
    'Usage: node pathery-cli.js [OPTIONS] map <mapID>\n' +
        '\n' +
        '[[OPTIONS]]'
);

var opts = getopt.parse(process.argv.slice(2));
var args = opts.argv;
var options = opts.options;

command = args.shift();
commandParameters = args;

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

if(options.hasOwnProperty('port')) {
  configuration.port = parseInt(options['port']);

  if(!configuration.port) {
    console.error('--port requires an integral argument.');

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
// Validate configuration.

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
// Wait for the start time (if specified) and then route based on the given command.

if(configuration.startAt) {
  var waitMilliseconds = configuration.startAt.getTime() - (new Date()).getTime();

  if(waitMilliseconds > 0) {
    console.log('Waiting', waitMilliseconds / 60000, 'minutes to start until', configuration.startAt, '(' + waitMilliseconds + ' milliseconds)');

    setTimeout(doRouteCommand, waitMilliseconds);
  } else {
    doRouteCommand(true);
  }
} else {
  doRouteCommand(true);
}

/**
 * @param {Boolean} [wasNotDelayed] - Will be nil (i.e. not truthy) if called from a setTimeout.
 */
function doRouteCommand(wasNotDelayed) {
  var client = new PatheryAPI.Client(configuration);

  if(!wasNotDelayed) {
    console.log('Started command routing at', new Date());
  }

  switch(command) {
    case 'map':
      executeMapCommand(client, commandParameters, configuration);

      break;
    default:
      console.error('Unknown command: "' + command + '".');

      process.exit(2);
  }
}

////////////////////////////////////////////////////////////////////////////////
// Command-specific logic.

function executeMapCommand(client, commandParameters, configuration) {
  var mapId = parseInt(commandParameters[0]);

  if(!mapId) {
    console.errors('Bad mapId.');

    process.exit(3);
  }

  doGetMapAndSolve(true);

  ////////////////////
  // Helper functions.

  /**
   * @param {Boolean} [wasNotDelayed] - Will be nil (i.e. not truthy) if called from a setTimeout.
   */
  function doGetMapAndSolve(wasNotDelayed) {
    client.getMap(mapId, { preventCaching: !wasNotDelayed }).then(
        function (map) {
          if(!wasNotDelayed) {
            console.log('Successfully retrieved map at', new Date());
          }

          solveMap(client, map, configuration);
        },
        function (error) {
          var response = error.response;

          if(response) {
            if(response.statusCode === 404 && configuration.retryOnNotFoundDelay) {
              console.log('map ' + mapId + ' not found -- retrying in ' + configuration.retryOnNotFoundDelay + ' seconds');

              setTimeout(doGetMapAndSolve, configuration.retryOnNotFoundDelay * 1000);
            } else {
              console.error('failed to get map ' + mapId + ': ' + response.statusCode + ' - "' + error.body + '"');
            }
          } else {
            console.error(error);
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
  var topResultTracker = new TopResultTracker(client, map, configuration);
  var workers = [];

  for(var i = 0; i < configuration.workerCount; i++) {
    workers.push(ChildProcess.fork(__dirname + '/worker.js'));
  }

  for(i = 0; i < workers.length; i++) {
    var worker = workers[i];

    var initialBlocks = {};
    for(var j = 0; j < map.walls; j++) {
      Analyst.placeBlock(map.graph(), initialBlocks);
    }

    worker.send({
      board: map.board,
      initialSolution: map.graph().listify_blocks(initialBlocks)
    });

    worker.on('message', function (childTopResult) {
      topResultTracker.registerResult(childTopResult);

      if(topResultTracker.isOptimal()) {
        console.log('Reached optimal score...stopping workers.');

        workers.forEach(function (worker) {
          worker.kill();
        });
      }
    });
  }
}
