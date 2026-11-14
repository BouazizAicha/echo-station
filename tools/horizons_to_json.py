#!/usr/bin/env python3
"""
Export real sky positions from NASA JPL Horizons into data/sky/<name>.json
for the targets that astronomy-engine does not know (asteroids, probes).

Run it on your own computer (needs internet), from the project root:
    python3 tools/horizons_to_json.py

If a target fails (e.g. Horizons has no trajectory for those dates),
the script says so and continues with the others.
"""
import json
import pathlib
import urllib.parse
import urllib.request
from datetime import datetime, timezone

TARGETS = {
    "ceres": "1;",       # Dawn orbits Ceres
    "eros": "433;",      # NEAR Shoemaker rests on Eros
    "pioneer10": "-23",
    "pioneer11": "-24",
    "kepler": "-227",
}
START, STOP, STEP = "2026-11-01", "2027-11-01", "1 d"
OUT = pathlib.Path(__file__).resolve().parent.parent / "data" / "sky"


def fetch(command):
    params = {
        "format": "json",
        "COMMAND": f"'{command}'",
        "OBJ_DATA": "'NO'",
        "MAKE_EPHEM": "'YES'",
        "EPHEM_TYPE": "'OBSERVER'",
        "CENTER": "'500@399'",        # Earth (geocentric)
        "START_TIME": f"'{START}'",
        "STOP_TIME": f"'{STOP}'",
        "STEP_SIZE": f"'{STEP}'",
        "QUANTITIES": "'2'",          # apparent RA/Dec
        "ANG_FORMAT": "'DEG'",
        "CSV_FORMAT": "'YES'",
    }
    url = "https://ssd.jpl.nasa.gov/api/horizons.api?" + urllib.parse.urlencode(params)
    with urllib.request.urlopen(url, timeout=60) as r:
        return json.load(r)["result"]


def parse(result):
    if "$$SOE" not in result:
        raise ValueError(result[-800:])
    body = result.split("$$SOE")[1].split("$$EOE")[0]
    points = []
    for line in body.strip().splitlines():
        cols = [c.strip() for c in line.split(",")]
        nums = []
        for c in cols[1:]:
            try:
                nums.append(float(c))
            except ValueError:
                pass  # empty columns / flags
        if len(nums) < 2:
            continue
        t = datetime.strptime(cols[0], "%Y-%b-%d %H:%M").replace(tzinfo=timezone.utc)
        points.append({
            "t": t.strftime("%Y-%m-%dT%H:%MZ"),
            "ra": round(nums[0] / 15, 5),   # degrees → hours
            "dec": round(nums[1], 5),
        })
    return points


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for name, command in TARGETS.items():
        try:
            points = parse(fetch(command))
            data = {
                "target": name,
                "source": "NASA JPL Horizons (https://ssd.jpl.nasa.gov/horizons/)",
                "frame": "apparent RA (hours) / Dec (degrees), geocentric",
                "points": points,
            }
            (OUT / f"{name}.json").write_text(json.dumps(data, indent=1))
            print(f"OK   {name}: {len(points)} points")
        except Exception as e:
            print(f"FAIL {name}: {str(e)[:300]}")


if __name__ == "__main__":
    main()
