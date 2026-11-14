# How accurate are Echo Station's sky positions?

Echo Station tells you where four targets really are in your sky: the Moon, Mars, the dwarf planet Ceres (where Dawn still orbits) and the direction of Pioneer 10. This page compares the positions the app computes with an **independent calculation**, and explains what limits accuracy in practice.

## Method

- **App side.** We ran the exact JavaScript the app uses (`js/engine/sky.js`) with `tools/app_positions.mjs`.
  - Moon and Mars come from astronomy-engine.
  - Ceres and Pioneer 10 come from NASA/JPL Horizons tables (`data/sky/*.json`, DE441 ephemeris, one point per day from 1 Nov 2026 to 1 Jan 2028), converted to azimuth and altitude by the app.
- **Reference side.** We used [Astropy](https://www.astropy.org/), a separate code base, with `tools/accuracy_check.py`.
  - Moon and Mars come from Astropy's built-in ephemeris (ERFA), computed as seen from the observer (topocentric) with standard atmospheric refraction.
  - Ceres and Pioneer 10 use the same NASA/JPL Horizons coordinates, converted by Astropy instead of the app's code. This checks the app's interpolation and coordinate conversion. The Horizons data itself is JPL's reference ephemeris.
- **Observer:** Tunis (36.8065° N, 10.1815° E, 10 m), the app's default location.
- **Times:** two times on 15 Nov 2026 (19:00 and 23:00 in Tunis), one during the judging period, and one six months later.

## Results

| Time (UTC) | Target | App az / alt | Reference az / alt | Difference |
|---|---|---|---|---|
| 2026-11-15 18:00 | Moon | 209.32° / +25.71° | 209.32° / +25.71° | 0.002° |
| 2026-11-15 18:00 | Mars | 7.90° / −37.68° | 7.90° / −38.06° | 0.377° * |
| 2026-11-15 18:00 | Ceres | 36.78° / −17.96° | 36.78° / −18.48° | 0.521° * |
| 2026-11-15 18:00 | Pioneer 10 | 60.60° / +4.81° | 60.60° / +4.81° | 0.008° |
| 2026-11-15 22:00 | Moon | 251.37° / −9.37° | 251.37° / −9.95° | 0.581° * |
| 2026-11-15 22:00 | Mars | 63.88° / −8.38° | 63.88° / −8.97° | 0.589° * |
| 2026-11-15 22:00 | Ceres | 74.35° / +21.30° | 74.35° / +21.30° | 0.003° |
| 2026-11-15 22:00 | Pioneer 10 | 92.80° / +50.91° | 92.80° / +50.90° | 0.001° |
| 2026-12-15 19:30 | Moon | 236.10° / +25.88° | 236.10° / +25.88° | 0.001° |
| 2026-12-15 19:30 | Mars | 52.48° / −23.59° | 52.48° / −24.07° | 0.479° * |
| 2026-12-15 19:30 | Ceres | 68.57° / +17.80° | 68.57° / +17.80° | 0.003° |
| 2026-12-15 19:30 | Pioneer 10 | 88.08° / +44.65° | 88.08° / +44.65° | 0.001° |
| 2027-06-01 02:00 | Moon | 80.78° / +8.01° | 80.78° / +8.01° | 0.003° |
| 2027-06-01 02:00 | Mars | 304.64° / −23.33° | 304.64° / −23.81° | 0.481° * |
| 2027-06-01 02:00 | Ceres | 341.66° / −23.32° | 341.66° / −23.80° | 0.481° * |
| 2027-06-01 02:00 | Pioneer 10 | 28.78° / −20.58° | 28.78° / −21.08° | 0.501° * |

**Above the horizon, the app and the independent calculation agree within 0.01°.** That is about 1/50 of the Moon's width.

\* **Below the horizon** (negative altitude), the app's altitude is about 0.5° higher than the reference. This is not a position error: the app's library keeps a small atmospheric-refraction correction even below the horizon, while the reference uses pure geometry there. Refraction has no physical meaning for an object hidden by the Earth, and 0.5° is far below what the game needs (see below). The azimuth is identical.

## What limits accuracy in practice

| Step | Typical size |
|---|---|
| Sky positions (this page) | < 0.01° above the horizon |
| Lock-on zone of the game | 6° (signal starts at 20°) |
| Phone compass and motion sensors | 5° to 15°, depends on the phone and nearby metal |

The phone's sensors are by far the biggest error, so the app:

- lets players **calibrate on the Moon** (point at it, tap once: the offset is removed);
- smooths the sensor direction and computes the back camera's direction from the full 3D rotation, which stays stable when the phone is tilted up;
- offers a **sky map** and a **list with "Tune in"** that need no sensors at all.

## Reproduce it

```bash
pip install astropy
python tools/accuracy_check.py                          # default times
python tools/accuracy_check.py 2026-11-20T20:00:00Z     # or your own times (UTC)
```

The Horizons tables can be regenerated with `python tools/horizons_to_json.py --start 2026-11-01 --stop 2028-01-01 --step "1 d"`.
