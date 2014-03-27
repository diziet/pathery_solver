var ChildProcess = require('child_process');
var Getopt = require('node-getopt');

var Analyst = require(__dirname + '/src/analyst.js');
var PatheryAPI = require(__dirname + '/src/communication/api.js');

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
  postResults: false,
  auth: null,
  userId: null
};

var getopt = new Getopt([
    // Pathery server options.
    ['', 'hostname=STRING', 'The hostname for the pathery server (default: ' + DEFAULT_HOSTNAME + ').'],
    ['', 'port=INT', 'The port for the pathery server (default: ' + DEFAULT_PORT + ').'],
    // Miscellaneous options.
    ['', 'optimal-score=INT', 'The optimal score for the map (optional). If set, execution will be terminated once this score is reached.'],
    ['', 'workers=INT', 'The number of workers to use (default: 1).'],
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
// Validate and route based on given command.

var client = new PatheryAPI.Client(configuration);

switch(command) {
  case 'map':
    var mapId = parseInt(commandParameters[0]);

    if(!mapId) {
      console.errors('Bad mapId.');

      process.exit(3);
    }

    // TODO: Handle failure.
    client.getMap(mapId).then(function (map) {
      solveMap(client, map, configuration);
    });

    break;
  default:
    console.error('Unknown command: "' + command + '".');

    process.exit(2);
}

////////////////////////////////////////////////////////////////////////////////
// Main logic.

// FIXME: Fails on map 4519.
/**
 *
 * @param {PatheryAPI.Client} client
 * @param {Map} map
 * @param {Object} configuration
 */
function solveMap(client, map, configuration) {
  var graph = new Analyst.PatheryGraph(map.board);

  var topScore = null;
  var workers = [];

  for(var i = 0; i < configuration.workerCount; i++) {
    workers.push(ChildProcess.fork(__dirname + '/worker.js'));
  }

  for(i = 0; i < workers.length; i++) {
    var worker = workers[i];

    var initialBlocks = {};
    for(var j = 0; j < map.walls; j++) {
      Analyst.placeBlock(graph, initialBlocks);
    }

    worker.send({
      board: map.board,
      initialSolution: graph.listify_blocks(initialBlocks)
    });

    // TODO: Wait some (short) amount of time before posting results.
    worker.on('message', registerChildTopResult);

    ////////////////////
    // Helper functions.

    function registerChildTopResult(childTopResult) {
      if(topScore === null || childTopResult.score > topScore) {
        var solution = graph.listify_blocks(childTopResult.solution);

        topScore = childTopResult.score;

        console.log('New top score: ' + topScore + ' reached at ' + new Date() + '. Solution:', solution);
        if(configuration.postResults) {
          // TODO: Handle failure.
          client.postSolution(map, solution).then(function (response) { console.log('response', response); });
        }

        if(configuration.optimalScore && topScore >= configuration.optimalScore) {
          console.log('Reached optimal score...stopping workers.');

          workers.forEach(function (worker) {
            worker.kill();
          });
        }
      }
    }
  }
}
