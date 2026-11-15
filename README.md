# Echo Station – Help Belu find NASA's silent robots

**NASA Space Apps Challenge 2026.** A free web app for explorers aged 9 to 15.

**Live app:** https://bouazizaicha.github.io/echo-station/ (best on a phone, outside at night; works on a computer too)

Belu, a young beluga who "sees" with echoes, has lost his friends: six real NASA robots that went silent across the solar system.
Point your phone at the real sky: the signal grows when you aim at the true position of a robot. Find it, hear its true story,
play its mission, and make it Belu's friend.

## What you can do

- **Story with Belu:** a short animated prologue, a moving arrow and Belu's "Click!" sonar to find each robot, a 7-card story per robot
  (the robot speaks, Belu answers), real NASA images, five mission games, the Apollo 11 laser-mirror finale, and a celebration when all six are found.
- **Scientist mode:** live azimuth, altitude, RA/Dec, distance and light time for each target, with mission data and sources.
- **Accessible:** audio guide, captions for every sound, three text sizes, high contrast, calm mode, vibration, keyboard controls,
  and a sky map that works without phone sensors.

The robots: Eagle (Moon), Spirit, Opportunity and Ingenuity (Mars), Dawn (Ceres) and Pioneer 10 (deep space).

## How it works

- Moon and Mars are computed live with [astronomy-engine](https://github.com/cosinekitty/astronomy) (MIT license).
- Ceres and Pioneer 10 come from NASA JPL Horizons tables in `data/sky/` (one point per day until 2028).
- Positions are converted to azimuth and altitude for your location and time. The phone's compass and gyroscope give the direction
  of the back camera (full 3-D rotation, calibration on the Moon).
- **Accuracy:** checked against Astropy, less than 0.01° of difference above the horizon. See [docs/accuracy.md](docs/accuracy.md).
- Every fact about the robots has a NASA source in `data/robots/*.json`.

More detail: [ARCHITECTURE.md](ARCHITECTURE.md).

## Built with

HTML, CSS and JavaScript (ES modules, no build step), Canvas 2D, Web Audio, Web Speech and DeviceOrientation APIs,
astronomy-engine, NASA JPL Horizons, Python and Astropy (accuracy check), Playwright and Node tests, GitHub Pages.
Drawings: Figma.

## Run it locally

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

Phone sensors only work over HTTPS: use the live link above to try the antenna. Tests: `node --test tests/*.test.mjs`.

## AI use (disclosure)

AI tools helped us build Echo Station. Every AI-assisted part was reviewed, tested and edited by the team.

- **Code (AI-assisted):** most of the JavaScript, HTML and CSS was written with Claude (Anthropic), then reviewed, tested and changed by the team. The canvas scenes and game graphics are drawn by this code.
- **Texts and data (AI-assisted):** the robot stories, questions and mission data were drafted and structured with OpenAI Codex from NASA sources, then reviewed by the team. Every fact has a NASA source in `data/robots/*.json`.
- **Images (AI-generated):** the six robot illustrations (`assets/images/robots/`) were generated with AI, then vectorized and edited by our team. Each one carries a visible "AI-GENERATED" watermark.
- **Audio (AI-generated):** the recorded robot voices (`assets/audio/*.mp3`, played in Scientist mode and used in our video) were generated with AI. This is written in each file's metadata and shown on screen ("AI-generated voice") while they play. In Story mode the voices come from the browser's built-in speech synthesis.
- **Not AI:** the drawings of Belu were made by our team (Figma). The mission photographs are NASA/JPL images with their credits.
- The sky positions are computed with astronomy-engine and NASA JPL Horizons tables, and checked against Astropy (see `docs/accuracy.md`).

## Team

Aicha (team lead, story and games) · Younes (sky and antenna) · Tesnim (science and content) · Oumayma (design and art).

Belu is a fictional character; every fact about the robots is real. Data and images: NASA/JPL. Not an official NASA product.
