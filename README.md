# MIDNIGHT THERAPY #

<!--
## TABLE OF CONTENTS ##
* [OVERVIEW]
* [KNOWN ISSUES]
* [FUTURE WORK]
-->

## OVERVIEW ##

This project is a solver for the Pathery website (www.pathery.com). It is partially based on Jeff Wu's work at https://github.com/WuTheFWasThat/midnighttherapy


See how to run at:
https://github.com/diziet/pathery_solver/blob/master/pathery-cli.js#L66

Configure by cloning https://github.com/diziet/pathery_solver/blob/master/config/cli.example.json#L6 locally


Run via:
```
node pathery-cli map-by-id --post-results 7600

```

## KNOWN ISSUES ##

Doesn't work with newer pathery format. We need to re-do the map parsing code in `parseBoard` as here: https://github.com/WuTheFWasThat/midnighttherapy/commit/30e771b8a7759afc486809b8161410b5c803ac67 in https://github.com/diziet/pathery_solver/blob/master/src/map.js#L122

## FUTURE WORK ##

Make it work.


CREDIT:

Big thanks to BlueRaja, HRoll, Joy, skishore, wuthefwasthat, Mike Narayan, Oliver Yeh for making this possible.
