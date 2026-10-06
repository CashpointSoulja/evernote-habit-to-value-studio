# Demo video

- `habit-to-value-studio-demo.mp4`: vertical 1080×1920, about 2 min 17 s, H.264/AAC. A live recording of the local app with a highlighted cursor, generated voiceover and burned-in subtitles.
- `demo.srt`: the same subtitles as a sidecar file.
- `script.md` / `segments.json`: the voiceover source text.

Rebuild it (needs a local Chrome/Chromium, Node with `playwright-core`, ffmpeg, and a text-to-speech step that writes `build/<segment>.mp3` for each segment):

```bash
npm run dev                       # in another terminal
CHROME_PATH=/path/to/chrome node video/record.mjs
cd video && python3 mux.py
```
