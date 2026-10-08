#!/bin/zsh
# Re-records docs/*.gif: renders a scripted session through hooks/scenes.ts,
# screenshots every frame in headless Chrome (CSS animations advance on
# --virtual-time-budget), then stitches GIFs with ffmpeg.
# Needs: Google Chrome, ffmpeg, node (npx tsx), python3.
set -e
HERE=${0:A:h}
ROOT=${HERE:h:h}
OUT=$(mktemp -d)
cp $HERE/shot.sh $OUT/
mkdir -p $OUT/frames
npx -y tsx@4.19.2 $HERE/story.ts $OUT 360 480
npx -y tsx@4.19.2 $HERE/story.ts $OUT 900 480 wide-
# Frames seek to exact times, so parallel capture is safe.
cat $OUT/frames.txt $OUT/wide-frames.txt | xargs -P 8 -L 1 $OUT/shot.sh
python3 $HERE/make-gifs.py $OUT $ROOT/docs
echo "GIFs written to $ROOT/docs (frames in $OUT)"
