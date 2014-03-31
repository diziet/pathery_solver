var BOARD = [
  [ 's', ' ', ' ', ' ', 'r', ' ', ' ', ' ', ' ', ' ', ' ', ' ', 'f' ],
  [ 's', 'r', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', 'f' ],
  [ 's', ' ', ' ', 'r', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', 'f' ],
  [ 's', ' ', ' ', ' ', ' ', ' ', 'r', ' ', ' ', ' ', ' ', 'r', 'f' ],
  [ 's', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', 'r', 'r', ' ', 'f' ],
  [ 's', ' ', 'r', ' ', ' ', ' ', ' ', 'r', ' ', ' ', ' ', ' ', 'f' ],
  [ 's', ' ', ' ', ' ', 'r', ' ', ' ', ' ', ' ', 'r', ' ', 'r', 'f' ]
];

var TELEPORT_BOARD = [ 
  [ 's',' ',' ','r',' ','r',' ',' ',' ','r',' ','r',' ',' ',' ',' ',' ',' ','f' ],  
  [ 's','r','r',' ',' ',' ',' ',' ',' ',' ',' ',' ',' ',' ',' ',' ','r',' ','f' ],  
  [ 's',' ',' ',' ','r',' ',' ',' ',' ','t','r','r',' ',' ',' ',' ',' ',' ','f' ],  
  [ 's',' ',' ','e',' ',' ',' ',' ',' ',' ',' ',' ',' ','r',' ',' ',' ',' ','f' ],  
  [ 's',' ',' ',' ',' ',' ',' ',' ',' ','r','u',' ','r',' ',' ',' ',' ',' ','f' ],  
  [ 's',' ','r',' ',' ',' ',' ',' ','r',' ','r',' ',' ',' ',' ',' ',' ',' ','f' ],  
  [ 's',' ','c',' ',' ',' ',' ',' ',' ','r',' ',' ',' ',' ',' ',' ',' ',' ','f' ],  
  [ 's',' ',' ',' ','r',' ',' ',' ','r',' ','r',' ',' ',' ','a',' ',' ',' ','f' ],  
  [ 's',' ',' ',' ',' ',' ',' ','b',' ',' ',' ',' ','r','d',' ',' ',' ','r','f' ]
  ]
// [board, expected score, board type]
TESTCASES = [[BOARD, 13, "SIMPLE"], [TELEPORT_BOARD, 76, "TELEPORT"]]
ITERATIONS = 5000

var Analyst = require(__dirname + '/../src/analyst.js');

for (index in TESTCASES){
  testCase = TESTCASES[index]
  boardType = testCase[2]
  board = testCase[0]
  expectedScore = testCase[1]

  console.log("*************************************\n")
  console.log("DOING " + boardType)

  var graph = new Analyst.PatheryGraph(board);
  t = new Date().getTime()

  for(i = 0; i < ITERATIONS; i++) {
    result = Analyst.find_pathery_path(graph, {});
    if (result.value != expectedScore){
      console.log("GOT " + result.value + ", EXPECTING " + expectedScore + ".  SOME WENT WRONG.")
      break;
    }
  }
  var time = new Date().getTime() - t
  console.log(time + " Milliseconds")
  //I got 12225/ sec on my macbook pro 2.6GHZ intel i7
  console.log(Math.round((5000 / time) * 1000) + " PER SECOND")
 
}