# MIDNIGHT THERAPY #

<!--
## TABLE OF CONTENTS ##
* [OVERVIEW]
* [FEATURES]
* [INSTRUCTIONS]
* [KNOWN ISSUES]
* [FUTURE WORK]
-->

## OVERVIEW ##

This project is an extension to the Pathery website (www.pathery.com).  It does two main things:

1. Extend the client (browser) to do things like show block values and save/load of solutions.
2. Lets the website interact with a personal server (running a solver), to facilitate human-computer interaction.

## HOW TO INSTALL ##


### GREASEMONKEY ###

1. Install [Tampermonkey](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo?hl=en) *(Chrome)* or [Greasemonkey](https://addons.mozilla.org/en-US/firefox/addon/greasemonkey/) *(Firefox)*

### BOOKMARKLET ###

If you can't or don't want to use Greasemonkey, use a bookmarklet.  That is, create a bookmark with the address:

`javascript: $.getScript('https://github.com/makeshifthoop/pathery_solver/blob/master/pathery-client.js')`

### CONSOLE ###

If all else fails, you can access the script by pasting

`$.getScript('https://github.com/makeshifthoop/pathery_solver/blob/master/pathery-client.js')`

into the Javascript console.


### HOTKEY ###


| Hotkey        | Action                           |
| ------------- |:-------------------------------- |
| F             | Solve (hold shift to animate)      |



## SERVERSIDE PATHING ##

### RUNNING THE SERVER ###

Unfortunately, "show values" is noticeably slow using the default method.  The following method, though more complicated, speeds up the pathfinding by a great deal.

First you'll need a server running.  I've provided one that you can use (maybe as a starting point for an AI).  To get it,

1. Clone this repo and cd into it
2. Run locally:

`node pathery-server.js` (or just `npm start`, if you have npm)

Next, add my client to the browser window.

1. Go to Pathery
2. Paste

`$.getScript('https://raw.github.com/WuTheFWasThat/midnighttherapy/master/pathery-client.js')`

into the Javascript console.  Again, you can make this easier using something like Tampermonkey/Greasemonkey (a slight modification to monkey-script.js will work), or a bookmarklet.


## FUTURE WORK: ##

- Partial-Path caching

- Better hashing algorthm for positions.  Right now the hash key is the array of block placed sorted then toString()ed.

Like {"[0,1]": 1, "[0,1],[0,2]": 1...}


