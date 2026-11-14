"""Checks the sky positions of Echo Station against an independent calculation.

App side: the exact JavaScript the app runs (js/engine/sky.js, via tools/app_positions.mjs).
Reference side: Astropy (independent code base).
  - Moon, Mars: Astropy's built-in ephemeris (ERFA), topocentric, with standard refraction.
  - Ceres, Pioneer 10: the same NASA/JPL Horizons RA/Dec the app uses (data/sky/*.json),
    converted to azimuth/altitude by Astropy instead of the app's code.
Observer: Tunis (36.8065 N, 10.1815 E, 10 m), the app default.

Usage:  pip install astropy   then   python tools/accuracy_check.py
"""
import json
import pathlib
import subprocess
import sys

import astropy.units as u
from astropy.coordinates import AltAz, EarthLocation, GCRS, SkyCoord, get_body, solar_system_ephemeris
from astropy.time import Time

ROOT = pathlib.Path(__file__).resolve().parent.parent
TIMES = sys.argv[1:] or [
    "2026-11-15T18:00:00Z",   # Sunday 15 Nov 2026, 19:00 in Tunis
    "2026-11-15T22:00:00Z",   # 23:00 in Tunis
    "2026-12-15T19:30:00Z",   # during the judging period
    "2027-06-01T02:00:00Z",   # six months later, end of the night
]
TUNIS = EarthLocation(lat=36.8065 * u.deg, lon=10.1815 * u.deg, height=10 * u.m)


def app_positions():
    out = subprocess.run(["node", str(ROOT / "tools" / "app_positions.mjs"), *TIMES],
                         check=True, capture_output=True, text=True).stdout
    return json.loads(out)


def table_radec(name, when):
    """Linear interpolation in the Horizons table (independent of the app's code)."""
    data = json.loads((ROOT / "data" / "sky" / f"{name}.json").read_text())
    pts = data["points"]
    t = Time(when).unix
    for a, b in zip(pts, pts[1:]):
        ta, tb = Time(a["t"]).unix, Time(b["t"]).unix
        if ta <= t <= tb:
            k = (t - ta) / (tb - ta)
            dra = ((b["ra"] - a["ra"] + 12) % 24) - 12
            return (a["ra"] + k * dra) % 24, a["dec"] + k * (b["dec"] - a["dec"]), a["dist_au"] + k * (b["dist_au"] - a["dist_au"])
    raise ValueError(f"{when} outside the {name} table")


def frame_for(when, refraction):
    kw = dict(obstime=Time(when), location=TUNIS)
    if refraction:
        kw.update(pressure=1013.25 * u.hPa, temperature=10 * u.deg_C, relative_humidity=0, obswl=0.55 * u.micron)
    return AltAz(**kw)


def reference(target, when):
    t = Time(when)
    if target in ("moon", "mars"):
        with solar_system_ephemeris.set("builtin"):
            coord = get_body(target, t, TUNIS)
    else:
        ra, dec, dist = table_radec(target, when)
        coord = SkyCoord(GCRS(ra=ra * 15 * u.deg, dec=dec * u.deg, distance=dist * u.au, obstime=t))
    geometric = coord.transform_to(frame_for(when, False))
    # refraction lifts objects near the horizon; models differ below it, so only apply it above
    if geometric.alt.deg > -1:
        return coord.transform_to(frame_for(when, True))
    return geometric


def main():
    rows, worst = [], {}
    for p in app_positions():
        ref = reference(p["id"], p["t"])
        app = SkyCoord(az=p["az"] * u.deg, alt=p["alt"] * u.deg, frame=ref.frame)
        sep = app.separation(ref).deg
        worst[p["id"]] = max(worst.get(p["id"], 0), sep)
        rows.append((p["t"], p["id"], p["az"], p["alt"], ref.az.deg, ref.alt.deg, sep))
    print("| Time (UTC) | Target | App az / alt | Reference az / alt | Difference |")
    print("|---|---|---|---|---|")
    for t, i, aaz, aalt, raz, ralt, sep in rows:
        print(f"| {t[:16].replace('T', ' ')} | {i} | {aaz:.2f}° / {aalt:+.2f}° | {raz:.2f}° / {ralt:+.2f}° | {sep:.3f}° |")
    print()
    for i, w in worst.items():
        print(f"largest difference {i}: {w:.3f}°")


if __name__ == "__main__":
    main()
