#!/bin/sh
# Rebuilds the carousel PNGs (1920x1080) from the real panel. Needs Google Chrome and a built plugin.
# Run from the project root:  sh store-assets/carousel/build.sh
set -e
npm run pretest >/dev/null
node store-assets/carousel/make-data.js
python3 -m http.server 8765 --bind 127.0.0.1 >/dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null' EXIT
sleep 1
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
NAMES="01-start 02-ramps 03-contrast 04-extras 05-options 06-json 07-safe"
i=1
for name in $NAMES; do
  # A render that waits too long on the web font is killed after 75 seconds and tried once more.
  for attempt in 1 2; do
    perl -e 'alarm shift; exec @ARGV' 75 "$CHROME" --headless=new --disable-gpu --hide-scrollbars --window-size=1920,1080 --virtual-time-budget=9000 \
      --screenshot="store-assets/carousel/$name.png" "http://127.0.0.1:8765/store-assets/carousel/slide.html?s=$i" >/dev/null 2>&1 && break
    echo "slide $i ($name): attempt $attempt did not finish"
  done
  i=$((i+1))
done
ls -la store-assets/carousel/*.png
