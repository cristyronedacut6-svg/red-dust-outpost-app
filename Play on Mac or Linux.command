#!/bin/sh
# Red Dust Outpost - play this version on a Mac or Linux computer.
# Double-click (Mac) or run this file. It starts a small local web server for the "www" folder and opens the game.
# Keep the window open while you play. Close it to stop.
cd "$(dirname "$0")/www" || exit 1
PORT=8090
( sleep 1; open "http://localhost:$PORT/index.html" 2>/dev/null || xdg-open "http://localhost:$PORT/index.html" ) &
python3 -m http.server $PORT
