    ////////////////////////////////////////////////////////////
// ANALYST
////////////////////////////////////////////////////////////

// The analyst does all the heavy computation.  It can be in the client, but it is recommended that you run it through the server.

(function(exports) {

var ExploratoryUtilities = require(__dirname + '/exploratory-utilities.js');

var ROCK_1             = 'r1';
var ROCK_2             = 'r2';  // never used?
var ROCK_3             = 'r3';  // used in seeing double, same as rock?

var PATCH              = 'p1';  // can't place blocks, but path can pass

var GREEN_THROUGH_ONLY = 'x2';  // colored green, blocks red
var RED_THROUGH_ONLY   = 'x1';  // colored red, blocks green

var GREEN_START        = 's1';
var RED_START          = 's2';

var FINISH             = 'f1';

// Checkpoints are c+number, and can be unlimited now.

// Takes in the 1-indexed checkpoint number and returns the checkpoint name.
// Example: 3 -> 'c3'
function getCheckpointName(n) {
  return 'c'+n;
}

// Arbitrary max num of checkpoints.
MAX_CHECKPOINT_NUM = 100000

// The CHECKPOINT variables are saved for now for the map_maker files.
var CHECKPOINT_1       = 'c1';
var CHECKPOINT_2       = 'c2';
var CHECKPOINT_3       = 'c3';
var CHECKPOINT_4       = 'c4';
var CHECKPOINT_5       = 'c5';
var CHECKPOINTS        = [CHECKPOINT_1, CHECKPOINT_2, CHECKPOINT_3, CHECKPOINT_4, CHECKPOINT_5];


// Teleports are t+number and u+number for in and out, and can be unlimited now.

var TELE_IN_PATTERN = /^t[0-9]+$/
var TELE_OUT_PATTERN = /^u[0-9]+$/

// The TELE_IN, TELE_OUT variables are saved for now for the map_maker files.
// dark blue
var TELE_IN_1          = 't1';
var TELE_OUT_1         = 'u1';
// green
var TELE_IN_2          = 't2';
var TELE_OUT_2         = 'u2';
// red
var TELE_IN_3          = 't3';
var TELE_OUT_3         = 'u3';
// light blue
var TELE_IN_4          = 't4';
var TELE_OUT_4         = 'u4';
// light green
var TELE_IN_5          = 't5';
var TELE_OUT_5         = 'u5';

var NOTURN             = 'z5';

var PATH_BLOCKED_CONSTANT = NaN; // TODO: use this

teleports_map = {};
teleports_map[TELE_IN_1] = TELE_OUT_1;
teleports_map[TELE_IN_2] = TELE_OUT_2;
teleports_map[TELE_IN_3] = TELE_OUT_3;
teleports_map[TELE_IN_4] = TELE_OUT_4;
teleports_map[TELE_IN_5] = TELE_OUT_5;

PATH_BLOCKED_CONSTANT = NaN; // TODO: use this

function PatheryGraph(board) {

  this.board = board; // i,j -> val
  this.n = board.length;
  this.m = board[0].length;

  this.serial_board = []; // same as board, but uses keyified index
  this.boardstuff = {}; // reverse of serial board.  val -> list of keyified blocks

  // Note that these lists start from top-left and go right, then down
  // In particular, starts and finishes are ordered top to bottom
  // Also when there are multiple outs for teleports, same ordering is used
  for (var i = 0; i < this.n; i++) {
    for (var j = 0; j < this.m; j++) {
      var stuff = this.board[i][j];
      var key = this.keyify_coordinates(i,j);
      this.serial_board.push(stuff);
      if (stuff != ' ') {
        if (this.boardstuff.hasOwnProperty(stuff)) {
          this.boardstuff[stuff].push(key);
        } else {
          this.boardstuff[stuff] = [key]
        }
      }
    }
  }

  this.green_starts = this.boardstuff[GREEN_START]; // list of keyified starts
  this.has_regular = (this.green_starts !== undefined);

  this.red_starts = this.boardstuff[RED_START]; // list of keyified alt-starts
  this.has_reverse = (this.red_starts !== undefined);

  this.has_two_paths = this.has_regular && this.has_reverse;

  this.checkpoints = []; // list of lists of intermediate targets, including starts and ends, all keyified

  var checkpoint_types = [CHECKPOINT_1, CHECKPOINT_2, CHECKPOINT_3, CHECKPOINT_4, CHECKPOINT_5];
  for (var i = 0; i < 5; i++) {
    var checkpoint_type = checkpoint_types[i];
    if (!(this.boardstuff.hasOwnProperty(checkpoint_type))) {
      break;
    }
    this.checkpoints.push(this.boardstuff[checkpoint_type]);
  }

  this.finishes = this.boardstuff[FINISH]; // list of keyified finishes

  this.teleports = {};
  this.has_teleports = false
  for (teleport_key in teleports_map) {
    // TODO: NOT TRUE IN GENERAL!!!
    var teleport_ins = this.boardstuff[teleport_key];
    if (! teleport_ins) {continue;}
    var teleport_outs = this.boardstuff[teleports_map[teleport_key]];

    for (var i = 0; i < teleport_ins.length; i++) {
      this.teleports[teleport_ins[i]] = teleport_outs;
      this.has_teleports = true
    }
  }

  // NOTE: Order is important.  DETERMINES MOVE PRIORITIES
  this.moves = [[-1, 0], [0, 1], [1, 0], [0, -1]];

  this.possible_neighbors = [[-1, 0], [-1,-1], [1,1], [1,-1], [-1,1], [0, 1], [1, 0], [0, -1]]
  this.determine_ordinal = function(vector) {
    if (vector[0] == 0 && vector[1] == 1){
      return 1
    } else if (vector[0] == 1 && vector[1] == 0){
      return 2
    } else if (vector[0] == 0 && vector[1] == -1){
      return 3
    } else if (vector[0] == -1 && vector[1] == 0){
      return 4
    } else {
      return -1
    }
  }
  // Preprocess neighbors
  // Index is the keyified block
  this.neighbors = [];
  var neighbors_list;
  var xp;
  var yp;
  for (var x = 0; x < this.n; x++) {
    for (var y = 0; y < this.m; y++) {
      neighbors_list = [];
      for (var i = 0; i < this.moves.length; i++) {
        xp = x + this.moves[i][0];
        yp = y + this.moves[i][1];

        // fill edge with rocks so we don't need this check?
        if (((0 <= xp) && (xp < this.n)) && ((0 <= yp) && (yp < this.m))) {
          val = this.board[xp][yp];
          if (val == ROCK_1) {continue;}
          if (val == ROCK_2) {continue;}
          if (val == ROCK_3) {continue;}
          neighbors_list.push(this.keyify_coordinates(xp, yp));
        }
      }
      this.neighbors.push(neighbors_list);
    }
  }

}

exports.PatheryGraph = PatheryGraph;

PatheryGraph.prototype.keyify_coordinates = function(x, y) {
  return x * this.m + y;
}

PatheryGraph.prototype.keyify = function(block) {
  return this.keyify_coordinates(block[0] , block[1]);
}

PatheryGraph.prototype.unkeyify = function(blockkey) {
  return [Math.floor(blockkey / this.m), blockkey % this.m];
}

PatheryGraph.prototype.snapify = function(keyed) {
  var unkeyed = this.unkeyify(keyed);
  return [unkeyed[1], unkeyed[0] + 1];
}

PatheryGraph.prototype.path_dir = function(oldkey, newkey) {
  var diff = newkey - oldkey;
  switch(diff) {
    case -this.m:
      return '1'; // up
    case 1:
      return '2'; // right
    case this.m:
      return '3'; // down
    case -1:
      return '4'; // left
    default:
      throw new Error("unexpected value in pathing");
  }
}

PatheryGraph.prototype.dictify_blocks = function(blocks_list) {
  var blocks_dict = {};
  for (var i =0; i < blocks_list.length; i++) {
    blocks_dict[this.keyify(blocks_list[i])] = true;
  }
  return blocks_dict;
}

PatheryGraph.prototype.listify_blocks = function(blocks_dict) {
  var blocks_list = [];
  for (var block in blocks_dict) {
    blocks_list.push(this.unkeyify(block));
  }
  return blocks_list;
}

PatheryGraph.prototype.teleport = function(block, used_teleports) {
  var stuff = this.serial_board[block];
  if ( teleports_map[stuff] ) {
    if (!(used_teleports[stuff])) {
      used_teleports[stuff] = true;
      return this.teleports[block]
    }
  }
  return null;
}

/**
 *
 * @param {Object} blocksDict
 * @returns {String}
 */
PatheryGraph.prototype.toString = function (blocksDict) {
  var i, j;
  var ret = '';

  // Draw the top row.
  ret += '┌─';
  for(j = 1; j < this.m; j++) {
    ret += '┬─'
  }
  ret += '┐\n';

  for(i = 0; i < this.serial_board.length; i++) {
    // Draw the beginning of the row.
    if(i % this.m === 0)  {
      ret += '│';
    }

    // Draw the current vertex.
    if(blocksDict && blocksDict[i]) {
      ret += 'w';
    } else {
      ret += this.serial_board[i];
    }
    ret += '│';

    // Draw the end of the row.
    if((i + 1) % this.m === 0) {
      ret += '\n';

      // Draw a middle row.
      if((i + 1) / this.m !== this.n) {
        ret += '├─';
        for(j = 1; j < this.m; j++) {
          ret += '┼─'
        }
        ret += '┤\n';
      }
    }
  }

  // Draw the bottom row.
  ret += '└─';
  for(j = 1; j < this.m; j++) {
    ret += '┴─'
  }
  ret += '┘\n';

  return ret;
};

// var BFS_queue = new Int32Array(graph.m * graph.n); // new Array(...)
var BFS_queue = new Int32Array(1000); // new Array(...)
var find_path_ret_val = new Int32Array(2500); // Can probably make this smaller (3/4 * 2500)
var BFS_parent_map = new Int32Array(2500);
var BFS_pm_mask = 0; // Used to read old values in the parent map as cleared
var BFS_pm_mask_incr = 1 << 12; // Since values go from 0 to 2499 (up to 12 bits [4096 = 2^12]), the other bits can be the mask
var BFS_pm_mask_limit = 1 << 30; // reset the table every 2^18 times it's used
var BFS_pm_bitmask = (1 << 30) - (1 << 12);

// Returns: Object with fields
// path: (typed) array of block keys in path
// numel: the number of elements this path should be taken up to.
// Note: the elements should be accessed backwards, from numel-1 to 0.
// If no path found, instead returns null.

PatheryGraph.prototype.find_path = function(
             blocks, // currently placed blocks
             extra_block, // unpassable square (used for green or red only)
             sources, // list of source vertices, in order of priority
             targets // set of target vertices
             //helper_solution,  // solution before the last block placed
             //last_block_placed // last block placed.
            ) {
  // parent_map = {}; // keyified index ->  parent key (or -1 if was source, and undefined if not yet reached)
  // parent_map: array w/ keyified index -> BFS_pm_mask + parent key (or -1 if was source).
  // values with the wrong BFS_pm_mask are not yet reached
  var parent_map = BFS_parent_map;
  BFS_pm_mask += BFS_pm_mask_incr;
  // clean the BFS map? it happens not very often though
  if (BFS_pm_mask >= BFS_pm_mask_limit) {
    BFS_pm_mask = BFS_pm_mask_incr;
    for (var i = 0; i < parent_map.length; i++) {
      parent_map[i] = 0;
    }
  }
  var queue = BFS_queue;
  var queue_start = 0,
      queue_end = 0;

  for (var k = 0; k < sources.length; k++) {
    var source = sources[k];
    queue[queue_end++] = source;
    parent_map[source] = BFS_pm_mask-1;
  }

  while (queue_start != queue_end) {
    var u = queue[queue_start++];

    var neighbors = this.neighbors[u];
    for (var i = 0, il = neighbors.length; i < il; i++) {
      var v = neighbors[i];

      // already found this square
      // if (parent_map.hasOwnProperty(v)) { continue;}
      if ((BFS_pm_bitmask & (parent_map[v]+1)) == BFS_pm_mask) { continue; }
      if (blocks[v]) {continue;}

      // impassable square
      if (this.serial_board[v] === extra_block) {continue;}

      parent_map[v] = BFS_pm_mask + u;

      // found target!
      if (targets[v]) {
        var path = find_path_ret_val;
        var idx = 0;
        while (v !== -1) {
          path[idx++] = v;
          v = parent_map[v] - BFS_pm_mask;
        }
        //console.log(path);
        return {'path': path, 'numel': idx};
      }

      // add to queue
      queue[queue_end++] = v;
    }
  }
  return null;
}
// previous solution is an array of keyified blocks
// ie.  [1,55,330] which represents the previous solution for path caching

function find_full_path(graph, blocks, reversed, previous_solution, last_block_placed, relevant_blocks){
  var used_teleports = {};
  var index = 0;
  var fullpath = [];
  var cur; // current list of start points
  var extra_block;

  // XXX: If there are teleports, disable the previous solution based shortcuts.
  // TODO: Making shortcuts work with teleports would likely be worth a 10% - 20% performance increase. Would require
  //     tracking the individual paths found by find_path, rather than the entire final path.
  if(graph.has_teleports || graph.has_two_paths) {
    previous_solution = false;
  }

  if (reversed) {     // red path
    cur = graph.red_starts;
    extra_block = GREEN_THROUGH_ONLY;
  } else {            // green path
    cur = graph.green_starts;
    extra_block = RED_THROUGH_ONLY;
  }
  var num_teleports_used = 0;
  // TODO: REMOVE BRIDGES FROM RELEVANT BLOCKS (i.e. take care of all those - values in one sweep)
  // http://www.geeksforgeeks.org/bridge-in-a-graph/
  // http://en.wikipedia.org/wiki/Bridge_(graph_theory)#Tarjan.27s_Bridge-finding_algorithm

  while (index < graph.checkpoints.length  + 1) {
    //console.log("NEW CHECKPOINT")
    var target_dict = {}
    if (index == graph.checkpoints.length) {
      var targets = graph.finishes;
    } else if (reversed)  {
      var targets = graph.checkpoints[graph.checkpoints.length - 1 - index];
    } else {
      var targets = graph.checkpoints[index];
    }
    for (var i in targets) {
      var target = targets[i];
      target_dict[target] = true;

    }


    // Traverse through the previous solution.  If the previous solution
    // never hits the block just placed, then don't recalculate the BFS
    // and just use the previous version

    if (previous_solution){
      var ii;
      var shortcut = false;

      for (ii = 0, q = previous_solution.length; ii < q; ii++){
        block = previous_solution[ii]
        if (block == last_block_placed) {
          shortcut = false;
          break;
        }
        if (target_dict[block] == true){

          //console.log("DOING SHORTCUT!")
          shortcut = true;
          break;
        }
      }
      if (shortcut) {
        cur = [previous_solution[ii]];

        if(index === graph.checkpoints.length) {
          if(ii + 1 !== previous_solution.length) {
            // If we've reached the end, the previous solution better not have more stuff.
            throw new Error('invariant');
          }

          fullpath = fullpath.concat(previous_solution);
        } else {
          fullpath = fullpath.concat(previous_solution.slice(0, ii));

          previous_solution = previous_solution.slice(ii);
        }

        index++;

        continue;
      }
    }
    var pathObj = graph.find_path(blocks, extra_block, cur, target_dict);
    //console.log("pathObj")
    //console.log(pathObj)
    if (pathObj == null) {
      return {
        path: null,
        value: PATH_BLOCKED_CONSTANT
      };
    }
    var out_blocks = null;

    var block;
    // blocking these could affect things
    // only calculate when not brute forcing
    var path_len = pathObj.numel;
    var path = pathObj.path;
    if(relevant_blocks) {
      for (var k = path_len - 1; k >= 0; k--) {
        relevant_blocks[path[k]] = true;
      }
    }

    // push things onto actual path, until we hit a teleport
    has_teleports = graph.has_teleports
    for (var k = path_len - 1; k >= 0; k--) {
      block = path[k];
      //console.log(block)
      if (has_teleports){
        out_blocks = graph.teleport(block, used_teleports);
        if (out_blocks != null) {
          fullpath.push(block);
          num_teleports_used += 1;
          cur = out_blocks;
          break;
        }
      }
      // if no teleport, and last block of not last leg, skip (to avoid overcount)
      if ((k > 0) || (index == graph.checkpoints.length)) {
        fullpath.push(block);
      }
    }
    if (out_blocks == null) {
      index += 1;
      cur = [block];
      if(previous_solution) {
        previous_solution = previous_solution.slice(previous_solution.indexOf(block))
      }
    }
  }

  var solution_length = fullpath.length - 1 - num_teleports_used;
  // if (last_block_placed == block_in_question){
  //   console.log("FINAL FULLPATH")
  //   //console.log(fullpath)
  //   for (iii = 0; iii < fullpath.length; iii++){
  //      console.log(graph.unkeyify(fullpath[iii]))
  //    }
  //   console.log("SCORE")
  //   console.log(fullpath.length)
  // }
  return {
    path: fullpath,
    value: solution_length
  };
}

function find_pathery_path(graph, blocks, previous_solution, last_block_placed, relevant_blocks){
  var paths = [];
  var values = [];
  //console.log("FIND PATHERY PATH")
  //console.log(last_block_placed)
  if (graph.has_regular) {
    solution_green = find_full_path(graph, blocks, false, previous_solution, last_block_placed, relevant_blocks);
    paths.push(solution_green.path);
    values.push(solution_green.value);
  }

  if (graph.has_reverse) {
    solution_red = find_full_path(graph, blocks, true, previous_solution, last_block_placed, relevant_blocks);
    paths.push(solution_red.path);
    values.push(solution_red.value);
  }
  return {
    paths: paths,
    values: values,
    value: sum_values(values)
  };
}

exports.find_pathery_path = find_pathery_path;


function compute_solution(board, cur_blocks, previous_solution, cb) {
  // console.log("COMPUTE SOLUTION")
    if (cur_blocks === undefined) {cur_blocks = []}
    var graph = new PatheryGraph(board);

    var current_blocks = graph.dictify_blocks(cur_blocks);
    var solution = find_pathery_path(graph, current_blocks, previous_solution);

    if (cb) {cb(solution)}
    return solution;
}
exports.compute_solution= compute_solution;

function compute_value(board, cur_blocks, cb) {
    var solution = compute_solution(board, cur_blocks, [], function(solution) {
      if (cb) {cb(solution.values);}
    });
    return solution.values;
}
exports.compute_value = compute_value;

function sum_values(array) {
  if (array.length == 0) {return PATH_BLOCKED_CONSTANT;}
  return array.reduce(function(x, y) {return x + y})
}
exports.sum_values = sum_values;

function stringify_block(block) {
  return block[0] + ',' + block[1];
}

function compute_values(board, cur_blocks, cb) {
    if (cur_blocks === undefined) {cur_blocks = []}
    var graph = new PatheryGraph(board);

    var current_blocks = graph.dictify_blocks(cur_blocks);
    var relevant_blocks = {};
    var solution = find_pathery_path(graph, current_blocks, undefined, undefined, relevant_blocks);

    var solution_path = solution.paths;
    var solution_value = solution.value;

    var find_pathery_path_count = 0;

    var values_list = [];
    var value; var diff; var blocking;

    for (var i = 0; i < graph.n; i ++) {
        for (var j = 0; j < graph.m; j++) {
            var block = graph.keyify_coordinates(i, j);
            if (graph.serial_board[block] == ' ') {
                if(isNaN(solution_value)) {
                  if(block in current_blocks) {
                    blocking = true;
                    diff = '-';
                  } else {
                    blocking = false;
                    diff = '';
                  }
                } else {
                  if (block in current_blocks) {
                    blocking = true;
                    delete current_blocks[block];
                    value = find_pathery_path(graph, current_blocks).value;
                    find_pathery_path_count++;
                    diff = solution_value - value;
                    current_blocks[block] = true;
                  } else if (block in relevant_blocks) {
                    blocking = false;
                    current_blocks[block] = true;
                    value = find_pathery_path(graph, current_blocks).value;
                    find_pathery_path_count++;
                    diff = value - solution_value;
                    if (isNaN(diff)) {diff = '-';}
                    delete current_blocks[block];

                    if (Math.abs(diff) > 2222222222) {diff = '-';} // TODO : make less hackish
                  } else {
                    diff = '';
                    blocking = false;
                  }
                }

                values_list.push({i: i, j: j, val: diff, blocking: blocking});
            }
        }
    }
    var retval = {value: solution_value, values_list: values_list, find_pathery_path_count: find_pathery_path_count};
    if (cb) {cb(retval);}
    return retval;
}
exports.compute_values = compute_values;

function sortByNumber(a, b){
  return (b - a)
}

/**
 * Simplified version of [`random-weighted-choice`](https://github.com/parmentf/random-weighted-choice), more performant
 * as it does not deal with the temperature nor influence parameters.
 *
 * @param {{id: Number, weight: Number}[]} table
 * @returns {Number}
 */
function randomWeightedChoice(table) {
  var accumulator = 0;
  var i;
  var choice;

  for(i = 0; i < table.length; i++) {
    accumulator += table[i].weight;
  }

  choice = accumulator * ExploratoryUtilities.random();
  accumulator = 0;

  for(i = 0; i < table.length; i++) {
    // OPTIMIZE: Could cache this earlier if we want to modify the elements of table.
    accumulator += table[i].weight;

    if(choice < accumulator) {
      return table[i].id;
    }
  }

  throw new Error('invariant');
}

function removeBlock(graph, currBlocks, weightFunction) {
  weightFunction = weightFunction || defaultWeightFunction;

  var table = [];
  for (var blockKey in currBlocks) {
    delete currBlocks[blockKey];

    var path = find_pathery_path(graph, currBlocks);
    var blockScore = path.value;

    // XXX: Removing a block _can_ actually result in a blocked path due to an oddity with teleports.
    if(!isNaN(blockScore)) {
      table.push({ id: blockKey, weight: weightFunction(blockScore) });
    }

    currBlocks[blockKey] = true;
  }

  if(table.length === 0) {
    // Presumably this can never happen; minimally we should be able to go back to the previous iteration.
    throw new Error('invariant');
  }

  var blockKeyToRemove = randomWeightedChoice(table);

  delete currBlocks[blockKeyToRemove];

  return blockKeyToRemove;

  ////////////////////
  // Helper functions.

  /**
   *
   * @param {Number} blockScore
   * @returns {Number}
   */
  function defaultWeightFunction(blockScore) {
    //
    // REVIEW: This weight function does not appear to make any sense, however, it works well. Alternatives which seem
    // to make more sense but do not work as well:
    //
    //     Math.abs(Math.pow(blockScore || 1, -0.5));
    //     1 / Math.abs(blockScore || 1);
    //
    return Math.ceil(Math.pow((blockScore || 1) / 10, 4));
  }
}
exports.removeBlock = removeBlock;


// Places a block totally at random. This can be needed by any of the placeBlock versions when putting a block anywhere
// along the current path would cause a dead-end. See [Map 4500](http://www.pathery.com/scores#2014-03-23_4500_1_) for
// an example.
function randomlyPlaceBlock(graph, currBlocks) {
  var maxRandomBlock = graph.m * graph.n - 1;

  while(true) {
    var newBlockKey = Math.floor(maxRandomBlock * ExploratoryUtilities.random());

    if (graph.serial_board[newBlockKey] === ' ' && !currBlocks[newBlockKey]) {
      currBlocks[newBlockKey] = true;

      var updatedPath = find_pathery_path(graph, currBlocks);

      if(updatedPath === null || !updatedPath.value) {
        delete currBlocks[newBlockKey];
      } else {
        return {
          blockKey: newBlockKey,
          score: updatedPath.value,
          solution: currBlocks
        }
      }
    }
  }
}
exports.randomlyPlaceBlock = randomlyPlaceBlock;

var placeBlock;
switch(ExploratoryUtilities.configuration.placeBlockVersion) {
  case 'Oliver01':
    placeBlock = function (graph, currBlocks) {
      var i = 0;
      while (i < 1000) {
        i++;
        var pathSansBlock = find_pathery_path(graph, currBlocks);
        var relevantBlocks = pathSansBlock.paths[0];
        if (relevantBlocks == [] || relevantBlocks == undefined){
          console.log(pathSansBlock)
          console.log(currBlocks)
        }

        // REVIEW: This is going to be biased against the first block. Conversely, it should probably _never_ pick the first (or last) blocks, as the will be the start/end blocks.
        var newBlockKey = relevantBlocks[Math.round((relevantBlocks.length - 1 ) * ExploratoryUtilities.random())];

        if (graph.serial_board[newBlockKey] === ' ' && currBlocks[newBlockKey] !== true) {
          currBlocks[newBlockKey] = true;

          var updatedPath = find_pathery_path(graph, currBlocks);

          if(!updatedPath || !updatedPath.paths || !updatedPath.paths[0]) {
            delete currBlocks[newBlockKey];
          } else {
            return {
              blockKey: newBlockKey,
              score: updatedPath.value,
              solution: currBlocks
            }
          }
        }
      }

      return randomlyPlaceBlock(graph, currBlocks);
    };

    break;
  case 'Oliver02':
    placeBlock = function (graph, currBlocks) {
      var pathSansBlock = find_pathery_path(graph, currBlocks);
      var relevantBlocks;

      if(graph.has_two_paths) {
        if(Math.random() < 0.5) {
          relevantBlocks = pathSansBlock.paths[0];
        } else {
          relevantBlocks = pathSansBlock.paths[1];
        }
      } else {
        relevantBlocks = pathSansBlock.paths[0];
      }

      for(var i = 0; i < 1000; i++) {
        var newBlockKey = relevantBlocks[Math.floor((relevantBlocks.length - 2) * ExploratoryUtilities.random()) + 1];

        if (graph.serial_board[newBlockKey] === ' ') {
          currBlocks[newBlockKey] = true;

          var updatedPath = find_pathery_path(graph, currBlocks);

          if(!updatedPath.value) {
            delete currBlocks[newBlockKey];
          } else {
            return {
              blockKey: newBlockKey,
              score: updatedPath.value,
              solution: currBlocks
            }
          }
        }
      }

      return randomlyPlaceBlock(graph, currBlocks);
    };

    break;
  case 'Michael01':
    placeBlock = function (graph, currBlocks) {
      var pathSansBlock = find_pathery_path(graph, currBlocks);
      // REVIEW: Might also try passing in a relevant block parameter to find_pathery_path. That would add the
      //     possibility of placing blocks after a teleport and also remove duplicate blocks. The latter though points
      //     to a reason it might not be a good idea...this way blocks which are hit more than once are more likely
      //     to be chosen.
      var relevantBlocks = pathSansBlock.paths[0];
      var newBlockKey;
      var updatedPath;

      while (relevantBlocks.length > 2) {
        var newBlockIdx = Math.floor((relevantBlocks.length - 2) * ExploratoryUtilities.random()) + 1;
        newBlockKey = relevantBlocks[newBlockIdx];

        if (graph.serial_board[newBlockKey] === ' ') {
          currBlocks[newBlockKey] = true;

          updatedPath = find_pathery_path(graph, currBlocks);

          if(!updatedPath || !updatedPath.paths || !updatedPath.paths[0]) {
            delete currBlocks[newBlockKey];

            relevantBlocks.splice(newBlockIdx, 1);
          } else {
            return {
              blockKey: newBlockKey,
              score: updatedPath.value,
              solution: currBlocks
            }
          }
        }
      }

      return randomlyPlaceBlock(graph, currBlocks);
    };

    break;
  case 'Michael02':
    // Differs from Michael01: Pass in a relevant_blocks parameter to find_pathery_path. This adds the possibility of
    // placing blocks after a teleport and also removes duplicate blocks. The latter though points to a reason this may
    // not be a good idea...in Michael01, blocks which are hit more than once are more likely to be chosen.
    placeBlock = function (graph, currBlocks) {
      var relevantBlocksLookup = {};
      find_pathery_path(graph, currBlocks, undefined, undefined, relevantBlocksLookup);
      var relevantBlocks = Object.keys(relevantBlocksLookup);
      var newBlockKey;
      var updatedPath;

      while (relevantBlocks.length > 0) {
        var newBlockIdx = Math.floor((relevantBlocks.length) * ExploratoryUtilities.random());
        newBlockKey = relevantBlocks[newBlockIdx];

        if (graph.serial_board[newBlockKey] === ' ') {
          currBlocks[newBlockKey] = true;

          updatedPath = find_pathery_path(graph, currBlocks);

          if(!updatedPath || !updatedPath.paths || !updatedPath.paths[0]) {
            delete currBlocks[newBlockKey];

            relevantBlocks.splice(newBlockIdx, 1);
          } else {
            return {
              blockKey: newBlockKey,
              score: updatedPath.value,
              solution: currBlocks
            }
          }
        }
      }

      return randomlyPlaceBlock(graph, currBlocks);
    };

    break;
  default:
    throw new Error();
}
exports.placeBlock = placeBlock;

function annealingIteration(graph, currBlocks) {
  // TODO: Maybe remove/place n blocks with a probability of `1/(b ^ (n - 1))`?
  removeBlock(graph, currBlocks);
  return placeBlock(graph, currBlocks);
}
exports.annealingIteration = annealingIteration;

function reseedBoard(graph, numBlocks){
  var currBlocks = {};

  while (true){
    for(var i = 0; i < numBlocks; i++) {
      placeBlock(graph, currBlocks);
    }
    if (find_pathery_path(graph, currBlocks).paths[0] != undefined){
      break
    }

    // REVIEW: This has to be a typo.
    currentBlocks = {};
  }

  return currBlocks;
}

function place_greedy2(board, currBlocks, depth, total, previous_solution, previous_block, blocked_list, graph, already_tried_combination, cb) {
  if (graph == undefined){
    var graph = new PatheryGraph(board);
  } else{
    graph.used_teleports = {};
  }
  if (already_tried_combination == undefined){
    already_tried_combination = {}
  }
  if (blocked_list == undefined){
    blocked_list = []
  }

  iterations = 0;
  topScore = 0;
  while(iterations < 15000) {
    if(iterations % 15000 == 0) {
      currBlocks = reseedBoard(graph, total)
      // console.log("RESEEDING")
      // console.log(currBlocks)
      topScore = 0
    }

    var result = annealingIteration(graph, currBlocks);
    var score = result.score;
    var prevScore = score
    if(topScore === null || score > topScore * 0.8) {
      // console.log("BRUTE FORCING")
        block1 = removeBlock(graph, currBlocks)
         block2 = removeBlock(graph, currBlocks)
        //block3 = removeBlock(graph, currBlocks)
        //block4 = removeBlock(graph, currBlocks)
        //block3 = removeBlock(graph, currBlocks)
        //block4 = removeBlock(graph, currBlocks)
         // console.log("currBlocks")
         // console.log(currBlocks)

        solution = place_greedy(board,graph.listify_blocks(currBlocks),2)

        currBlocks = graph.dictify_blocks(solution[0])

        score = solution[1];

      // block1 = removeBlock(graph, currBlocks)
      // block2 = removeBlock(graph, currBlocks)

      // solution = place_greedy(board,graph.listify_blocks(currBlocks),2)
      // currBlocks = graph.dictify_blocks(solution[0])
      // block1 = removeBlock(graph, currBlocks)
      // block2 = removeBlock(graph, currBlocks)

      // solution = place_greedy(board,graph.listify_blocks(currBlocks),2)

      // currBlocks = graph.dictify_blocks(solution[0])

      //       block1 = removeBlock(graph, currBlocks)
      // block2 = removeBlock(graph, currBlocks)

      // solution = place_greedy(board,graph.listify_blocks(currBlocks),2)

      // currBlocks = graph.dictify_blocks(solution[0])


      if (score > topScore){
        topScore = score
        topResult = solution[0].slice(0,9999999);
      }

      // console.log(currBlocks)
      // console.log("LISTIFY")
      // console.log(listified)
      topScoreHitCount = 1;

       // currBlocks[block1] = true
       // currBlocks[block2] = true
        //currBlocks[block3] = true
      if (score > 0){
        console.log("PREV SCORE")
        console.log(prevScore)
        console.log("HIGH SCORE")
        console.log(solution[1])
        console.log(currBlocks)
         console.log('new top score', topScore, iterations, currBlocks);
       console.log('with ' + Object.keys(currBlocks).length + ' keys')

      }
    }

    iterations++;
  }
  return [topResult]
}

exports.place_greedy2 = place_greedy2;

///////////////////////////////////////////////////////////////////////////////////////////////
// SOLVER
///////////////////////////////////////////////////////////////////////////////////////////////

const CONNECTED_IGNORE_LOOKUP = {
  ' ': true,
  a: true,
  b: true,
  c: true,
  d: true,
  e: true,
  f: true,
  p: true,
  S: true,
  s: true,
  t: true
};

const HAS_BLOCKS_IGNORE_LOOKUP = {
  g: true,
  h: true,
  i: true,
  j: true,
  k: true,
  l: true,
  m: true,
  n: true,
  t: true,
  u: true
};

var assertFindPathShortcutCorrectWarningSent;

function place_greedy(board, cur_blocks, depth, total, previous_solution, previous_block, blocked_list, graph, already_tried_combination, cb) {
  var i;

  //console.log("PLACE GREEDY!!!" )
  //console.log("DEPTH: " + depth)
  if (graph == undefined){
    var graph = new PatheryGraph(board);
  } else{
    graph.used_teleports = {};
  }
  if (already_tried_combination == undefined){
    already_tried_combination = {}
  }
  if (blocked_list == undefined){
    blocked_list = []
  }

  var best_val = 0;
  var best_blocks = [];

  var current_blocks = graph.dictify_blocks(cur_blocks);
  var relevant_blocks = {};
  var solution = find_pathery_path(graph, current_blocks, previous_solution, previous_block, relevant_blocks);

  if(ExploratoryUtilities.configuration.assertFindPathShortcutCorrect) {
    if(!assertFindPathShortcutCorrectWarningSent) {
      assertFindPathShortcutCorrectWarningSent = true;

      console.warn('ExploratoryUtilities.configuration.assertFindPathShortcutCorrect was set; performing shortcut checking');
    }

    var solutionSansShortcuts = find_pathery_path(graph, current_blocks);
    solution.paths.forEach(function (pathUsingShortcuts, idx) {
      if(pathUsingShortcuts) {
        var pathSansShortcuts = solutionSansShortcuts.paths[idx];

        if(pathUsingShortcuts.length === pathSansShortcuts.length) {
          for(i = 0; i < pathUsingShortcuts.length; i++) {
            if(pathUsingShortcuts[i] !== pathSansShortcuts[i]) {
              throw new Error('invariant');
            }
          }
        } else {
          throw new Error('invariant');
        }
      }
    });
  }

  var possible_next_moves;

  // Unable to find solution, so push last block to blocked list
  if (solution.paths[0] == null){
    blocked_list.push(previous_block);
    possible_next_moves = [];
  } else {
    possible_next_moves = Object.keys(relevant_blocks);
  }
  // clone the block list so different iterations of BFS would not interfere with each other
  blocked_list = blocked_list.slice(0, blocked_list.length)

  if (depth == 0){
    return [cur_blocks, solution.value]
  }

  for (i = 0; i < possible_next_moves.length; i++) {
    // if (ExploratoryUtilities.random() > 0.70){
    //   continue;
    // }
    var block = possible_next_moves[i]

    unkeyed = graph.unkeyify(block)


    if (blocked_list.indexOf(block) != -1){
      continue;
    }
    var x = unkeyed[0];
    var y = unkeyed[1];

    // can't put a block when there's already something there
    if (graph.serial_board[block] != ' ') {
      continue;
    }

    // This checks to see if the new block is connected to anything else
    // if its not connected to anything, then prune this branch of the tree.
    if (depth > 0){
      var connected_to_something = false

      // Assume its connected to something when its on the edge
      if (x == 0 || y == 1 || x == graph.n -1 || y == graph.m -1){
        connected_to_something = true
      }
        var has_blocks_dirs = []
      if (connected_to_something == false){
        var dirs = graph.possible_neighbors
        for (var ni = 0, nilength = dirs.length; ni < nilength; ni++) {
          dir = dirs[ni]
          var temp_x = x + dir[0]
          var temp_y = y + dir[1]
          var neighbor_square = graph.serial_board[graph.keyify_coordinates(temp_x, temp_y)]
          // not empty, checkpoint a/b/c, finish or start
          if (!CONNECTED_IGNORE_LOOKUP[neighbor_square]) {
            connected_to_something = true;

            // REVIEW: Added teleport-out blocks. Not quite sure I understand what's going on here at all.
            if(!HAS_BLOCKS_IGNORE_LOOKUP[neighbor_square]) {
              has_blocks_dirs.push(graph.determine_ordinal(dir));
            }
          }

          // check for direction
          //  Don't need to put a block at X
          //  b b b
          //    x b
          //    x b
          if (current_blocks[graph.keyify_coordinates(temp_x, temp_y)]){
            has_blocks_dirs.push(graph.determine_ordinal(dir))
            connected_to_something = true
          }

        }
      }

      //
      // See Map 4784 for the reason we can only do this if depth is 1. The optimal solution is:
      //
      //     [[0,7],[1,4],[1,5],[2,8],[3,16],[3,4],[3,6],[4,15],[5,14],[5,5],[5,6],[6,10],[6,7],[7,8],[7,9]]
      //
      // however, removing `[1,4]` and `[1,5]` will result in a non-optimal solution, as the block `[1,5]` is in the
      // path, but not connected, and the block `[1,4]` is connected, but not in the path.
      //
      // ### Alternatives
      //
      // *   Check that the block is connected within the specified depth (likely take too long).
      // *   Search on all paths giving the current score. Numerous problems, including that it is possibly invalid.
      //
      if (!connected_to_something && depth === 1){
        continue
      }

      // check the 4 possible ordinal directions.  Don't check if theres
      // already a block north/east, north/west, west/south, or east/south
      if (connected_to_something && has_blocks_dirs.length > 1) {

        if (has_blocks_dirs.indexOf(1) != -1 && has_blocks_dirs.indexOf(2) != -1){
          continue
        }
        if (has_blocks_dirs.indexOf(1) != -1 && has_blocks_dirs.indexOf(4) != -1){
          continue
        }
        if (has_blocks_dirs.indexOf(2) != -1 && has_blocks_dirs.indexOf(3) != -1){
          continue
        }
        if (has_blocks_dirs.indexOf(3) != -1 && has_blocks_dirs.indexOf(4) != -1){
          continue
        }
      }
    }
    // Cache already checked positions.  First sort the blocks placed and then use the string
    // string representation as a key in the cache.
    var temp_blocks = cur_blocks.concat([unkeyed])
    temp_blocks = temp_blocks.sort()
    var string_representation  = temp_blocks.toString()
    if (already_tried_combination[string_representation] != undefined){
      continue;
    }

    already_tried_combination[string_representation] = 1


    var response = place_greedy(board, temp_blocks, depth -1, total ,solution.paths[0], block, blocked_list, graph, already_tried_combination)
    var possible_blocks = response[0]
    var val = response[1]

    // determine the best combination based on the score
    if (val > best_val){
      // console.log("LFJEWOIFEWJOI")
      // console.log(best_blocks)
      best_blocks = possible_blocks
      best_val = val
    }
  }
  if (cb) {cb(best_blocks);}
  return [best_blocks, best_val];
}

exports.place_greedy = place_greedy;


})(typeof exports === "undefined" ? Analyst : module.exports)
