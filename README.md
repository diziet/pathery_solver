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

1. Based off of https://github.com/WuTheFWasThat/midnighttherapy
2. Extend the client (browser) to do things like show block values and save/load of solutions.
3. Lets the website interact with a personal server (running a solver), to facilitate human-computer interaction.


### HOTKEY ###


| Hotkey        | Action                           |
| ------------- |:-------------------------------- |
| F             | Solve (hold shift to animate)      |


### RUNNING THE SERVER ###

First you'll need a server running.  

1. Clone this repo and cd into it (<a href="http://git-scm.com/book/en/Getting-Started-Installing-Git">How to install git</a>)
2. Install Node (<a href="http://howtonode.org/how-to-install-nodejs">How to</a>)
3. `npm install express`
4. Run locally: (or just `npm start`, if you have npm)

Next, add the client to the browser window.

1. Go to Pathery
2. Paste

`$.getScript('https://raw.github.com/WuTheFWasThat/midnighttherapy/master/pathery-client.js')`

into the Javascript console.


### TUNING ###
Edit DEPTH_CONSTANT in pathery_server.js to change how many blocks the solver places.  Right now on a 2013 Macbook Pro it can do ~8 block in simple ~10s.

## FUTURE WORK: ##

- Partial-Path caching

- Better hashing algorthm for positions.  Right now the hash key is the array of block placed sorted then toString()ed.

Like {"[0,1]": 1, "[0,1],[0,2]": 1...}

CREDIT:  

Big thanks to BlueRaja, HRoll, Joy, skishore, wuthefwasthat for making this possible.