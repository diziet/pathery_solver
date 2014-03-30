var Analyst = require(__dirname + '/../src/analyst.js');
var PatheryAPI = require(__dirname + '/../src/communication/api.js');

/**
 * Parsed as JSON from the environment variable BLOCKS.
 *
 * @variable {Number[][]}
 */
var listifiedBlocks = JSON.parse(process.env['BLOCKS']);

/**
 * Parsed the environment variable MAP_ID.
 *
 * @variable {Number}
 */
var mapId = parseInt(process.env['MAP_ID']);

if(!listifiedBlocks || !mapId) {
  throw new Error();
}

(new PatheryAPI.Client()).getMap(mapId).done(function (map) {
  var currBlocks = map.graph().dictify_blocks(listifiedBlocks);
  var solution = Analyst.find_pathery_path(map.graph(), currBlocks);
  var rawPath = solution.paths[0];

  if(rawPath) {
    var path = map.graph().listify_blocks(rawPath);
    var score = solution.value;

    console.log('path:', path);
    console.log('score:', score);
  } else {
    console.log('blocked');
  }
});
