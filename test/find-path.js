/******************************************************************************
  Examples:

  1.  [Map 4534](http://www.pathery.com:80/scores#2014-03-31_4534_1_) - Simple. Score should be 16.

          MAP_ID=4534 \
            BLOCKS='[[0,10],[1,5],[1,10],[2,4],[3,4],[4,3],[5,2]]' \
            node test/find-path.js

  2.  [Map 4578](http://www.pathery.com:80/scores#2014-04-10_4578_1_) - Dualing paths. Score should be 240.

          MAP_ID=4578 \
            BLOCKS='[[1,7],[1,9],[3,5],[3,11],[4,6],[4,12],[5,4],[5,13],[5,16],[6,9],[7,6],[7,14],[8,4]]' \
            node test/find-path.js

 ******************************************************************************/

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
    var path = rawPath.map(function (blockKey) { return map.graph().unkeyify(blockKey); });
    var score = solution.value;

    console.log('path:', path);
    console.log('score:', score);
  } else {
    console.log('blocked');
  }
});
