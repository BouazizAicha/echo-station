# Echo Station

NASA Space Apps Challenge 2026 – Universal Event.

Since 1969, NASA has left robots all over the solar system. Most of them went silent.
Echo Station turns your phone into an antenna: point it at the real sky, find the robots,
and let them tell their own story.

**How it is built:** see [ARCHITECTURE.md](ARCHITECTURE.md) (languages, folders, modules, data model, how the antenna works).

## Run it locally

The app loads JSON files, so it needs a local server (opening `index.html` directly won't work):

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

Phone sensors only work over **HTTPS** → test the antenna on the GitHub Pages URL.

## Who works where

| Folder | Owner |
|---|---|
| `js/engine/` – sky positions, antenna, sky map | Dev 1 |
| `js/story/` – radio sound, dialogues, mini-game, laser finale | Dev 2 |
| `data/robots/` – one JSON file per robot | Content |
| `assets/`, `css/` – images, audio, visual style | Design |

Pull often, commit often, and stay in your folder to avoid conflicts.

## Add a robot

1. Copy `data/robots/spirit.json` to `data/robots/<id>.json` and fill it in.
2. Add `<id>` to `data/robots/index.json`.
3. Every fact needs a source in `sources`. Every image needs a credit.

Story template (each robot answers all five):
`who_i_am` → `why_sent` → `discoveries` → `where_now` → `legacy`

`sky_target` = where the antenna finds it: `moon`, `mars`, `ceres`, `eros`, `pioneer10`, `pioneer11`, `kepler`.

## Sky positions

- Moon and Mars: computed live with [astronomy-engine](https://github.com/cosinekitty/astronomy) (MIT license).
- Other targets: run `python3 tools/horizons_to_json.py` once to export positions from
  NASA JPL Horizons into `data/sky/`.

## Checkpoints

- **Sat ~18:30** – antenna test on the real Moon (go / no-go)
- **Sat ~02:00** – whole experience works start to finish
- **Sun 16:00** – feature freeze
- **Sun ~22:30** – submit

## AI use (disclosure)

AI tools helped us build Echo Station. Every AI-assisted part was reviewed, tested and edited by the team.

- **Code (AI-assisted):** most of the JavaScript, HTML and CSS was written with Claude (Anthropic), then reviewed, tested and changed by the team. The canvas scenes and game graphics are drawn by this code.
- **Texts and data (AI-assisted):** the robot stories, questions and mission data were drafted and structured with OpenAI Codex from NASA sources, then reviewed by the team. Every fact has a NASA source in `data/robots/*.json`.
- **Images (AI-generated):** the six robot illustrations (`assets/images/robots/`) were generated with AI, then vectorized and edited by our team. Each one carries a visible "AI-GENERATED" watermark.
- **Audio (AI-generated):** the recorded robot voices (`assets/audio/*.mp3`, played in Scientist mode and used in our video) were generated with AI. This is written in each file's metadata and shown on screen ("AI-generated voice") while they play. In Story mode the voices come from the browser's built-in speech synthesis.
- **Not AI:** the drawings of Belu were made by our team (Figma, Adobe Illustrator). The mission photographs are NASA/JPL images with their credits.
- The sky positions are computed with astronomy-engine and NASA JPL Horizons tables, and checked against Astropy (see `docs/accuracy.md`).
