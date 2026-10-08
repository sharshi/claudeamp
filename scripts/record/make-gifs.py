"""Stitch captured frames into the README GIFs with ffmpeg (palettegen)."""
import os, subprocess, sys

out = sys.argv[1]
rows = [l.split() for l in open(f'{out}/frames.txt')]
wide = [l.split() for l in open(f'{out}/wide-frames.txt')]
by = {}
for r in rows:
    by.setdefault(r[3], []).append(r[0])


def gif(name, idxs, width, dest, fps=15):
    seq = f'{out}/seq_{name}'
    os.makedirs(seq, exist_ok=True)
    for k, i in enumerate(idxs):
        dst = f'{seq}/{k:04d}.png'
        if not os.path.exists(dst):
            os.symlink(os.path.abspath(f'{out}/frames/{i}.png'), dst)
    vf = (f'fps={fps},scale={width}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];'
          '[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', '15', '-i', f'{seq}/%04d.png',
                    '-vf', vf, '-loop', '0', f'{dest}/{name}.gif'], check=True)


dest = sys.argv[2]
gif('demo', [r[0] for r in rows], 300, dest, fps=12)
gif('spectrum', by['think'] + by['tool'] + by['write'], 300, dest)
gif('wordclaude', by['cloud'], 300, dest)
gif('lyrics', by['lyrics'], 300, dest)
gif('tetris', by['tetris'], 300, dest)
gif('finale', by['finale'], 300, dest)
gif('wide', [r[0] for r in wide if r[3] in ('cloud', 'lyrics', 'tetris', 'finale')], 600, dest, fps=10)
