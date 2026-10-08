#!/bin/zsh
# usage: shot.sh <frame> <page> <ms> <name> <width> <height>
# The page seeks its animations to <ms> (the #hash) on load, then is captured.
# Headless Chrome very occasionally hangs: retry once, each try on a 20 s watchdog.
C="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
OUT=${0:h}/frames/$1.png
for try in 1 2; do
  D=$(mktemp -d)
  "$C" --headless=new --disable-gpu --user-data-dir=$D --window-size=$5,$6 --force-device-scale-factor=1.5 --virtual-time-budget=400 --screenshot=$OUT "file://$2#$3" >/dev/null 2>&1 &
  pid=$!
  ( sleep 20; kill $pid 2>/dev/null ) &
  watchdog=$!
  wait $pid 2>/dev/null
  kill $watchdog 2>/dev/null
  rm -rf $D
  [[ -s $OUT ]] && exit 0
done
echo "frame $1 failed" >&2
