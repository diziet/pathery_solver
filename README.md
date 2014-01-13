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


### HOTKEY ###


| Hotkey        | Action                           |
| ------------- |:-------------------------------- |
| F             | Solve (hold shift to animate)      |


### RUNNING THE SERVER ###

First you'll need a server running.  

1. Clone this repo and cd into it
2. Run locally:

`npm install express` `node pathery-server.js` (or just `npm start`, if you have npm)

Next, add my client to the browser window.

1. Go to Pathery
2. Paste

`$.getScript('https://raw.github.com/WuTheFWasThat/midnighttherapy/master/pathery-client.js')`

into the Javascript console.

## FUTURE WORK: ##

- Partial-Path caching

- Better hashing algorthm for positions.  Right now the hash key is the array of block placed sorted then toString()ed.

Like {"[0,1]": 1, "[0,1],[0,2]": 1...}

CREDIT:  

Big thanks to BlueRaja, HRoll, Joy, skishore, wuthefwasthat for making this possible.