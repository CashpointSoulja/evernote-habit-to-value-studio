"""Mux the recorded UI frames, the per-segment voiceover and timed subtitles into the final MP4."""
import json, subprocess

def dur(path):
    return float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path]))

def ts(t):
    return f"{int(t // 3600):02}:{int(t % 3600 // 60):02}:{t % 60:06.3f}".replace('.', ',')

marks = json.load(open('build/marks.json'))
texts = {s['id']: s['text'] for s in json.load(open('segments.json'))}
srt, inputs, filt, n = [], [], [], 1
for k, m in enumerate(marks['marks']):
    start, d = m['start'] + 0.15, dur(f"build/{m['id']}.mp3")
    chunks, cur = [], []
    for w in texts[m['id']].split():
        cur.append(w)
        line = ' '.join(cur)
        if len(line) > 52 or (w.endswith(('.', ':', ',')) and len(line) > 28):
            chunks.append(line); cur = []
    if cur: chunks.append(' '.join(cur))
    total, t = sum(len(c) for c in chunks), start
    for c in chunks:
        e = t + d * len(c) / total
        srt.append(f"{n}\n{ts(t)} --> {ts(e)}\n{c}\n"); n += 1; t = e
    inputs += ['-i', f"build/{m['id']}.mp3"]
    ms = int(start * 1000)
    filt.append(f'[{k + 1}:a]adelay={ms}|{ms}[a{k}]')
open('demo.srt', 'w').write('\n'.join(srt))
filt.append(''.join(f'[a{k}]' for k in range(len(marks['marks']))) + f"amix=inputs={len(marks['marks'])}:normalize=0[aud]")
style = "FontName=DejaVu Sans,FontSize=9,PrimaryColour=&H00FFFFFF,BackColour=&H33141414,BorderStyle=4,Outline=6,Shadow=0,MarginV=26,MarginL=14,MarginR=14,Alignment=2"
filt.append(f"[0:v]fps=30,scale=1080:1920:flags=lanczos,subtitles=demo.srt:force_style='{style}',format=yuv420p[v]")
subprocess.run(['ffmpeg', '-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', 'build/frames.txt'] + inputs + [
    '-filter_complex', ';'.join(filt), '-map', '[v]', '-map', '[aud]',
    '-c:v', 'libx264', '-crf', '21', '-preset', 'medium', '-c:a', 'aac', '-b:a', '160k',
    '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:v', '+bitexact', '-flags:a', '+bitexact',
    '-metadata', 'title=Evernote Habit-to-Value Studio demo',
    '-metadata', 'artist=Ayo Ahmed',
    '-metadata', 'comment=Independent concept. Synthetic data. Not affiliated with Evernote or Bending Spoons.',
    '-movflags', '+faststart', '-t', f"{marks['total']:.2f}", 'habit-to-value-studio-demo.mp4'], check=True)
