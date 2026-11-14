#!/usr/bin/env python3
"""Fetch real sky positions from NASA/JPL Horizons and write data/sky/*.json.

Why this script exists
----------------------
astronomy-engine (used by the site) knows the Moon and Mars, but not Ceres
or the Pioneer 10 spacecraft. JPL Horizons is NASA's official ephemeris
service. We download right ascension (RA), declination (Dec) and the
observer range (delta, in AU) so the app can also compute light-time.

Usage (from the repository root)
--------------------------------
    python tools/horizons_to_json.py
    py     tools/horizons_to_json.py
    python tools/horizons_to_json.py --all
    python tools/horizons_to_json.py --start 2026-11-01 --stop 2026-12-01 --step "6 h"

Output
------
    data/sky/ceres.json
    data/sky/pioneer10.json
    data/sky/eros.json          (optional)
    data/sky/pioneer11.json     (optional)
    data/sky/kepler.json        (optional)

Each file contains a `points` array: {t, ra, dec, dist_au}.
    t        ISO-8601 UTC timestamp, e.g. "2026-11-14T00:00:00Z"
    ra       right ascension, hours, [0, 24)
    dec      declination, degrees, [-90, +90]
    dist_au  observer range in astronomical units

No third-party dependency: only the Python standard library.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import shutil
import sys
import urllib.parse
import urllib.request
from pathlib import Path

API_ENDPOINT = "https://ssd.jpl.nasa.gov/api/horizons.api"

# Horizons COMMAND values.
# "1;" is the small-body designation for (1) Ceres.
# -23 / -24 are the spacecraft IDs for Pioneer 10 / Pioneer 11.
# 433; is (433) Eros.
# -227 is the Kepler spacecraft.
TARGETS: dict[str, dict[str, object]] = {
    "ceres": {"command": "1;", "required": True, "label": "1 Ceres"},
    "pioneer10": {"command": "-23", "required": True, "label": "Pioneer 10"},
    "eros": {"command": "433;", "required": False, "label": "433 Eros"},
    "pioneer11": {"command": "-24", "required": False, "label": "Pioneer 11"},
    "kepler": {"command": "-227", "required": False, "label": "Kepler"},
}

RA_RE = re.compile(r"^\d{1,2}\s+\d{1,2}\s+\d+(?:\.\d+)?$")
NUM_RE = re.compile(r"^[+-]?\d+(?:\.\d+)?$")

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUT = REPO_ROOT / "data" / "sky"
FALLBACK = REPO_ROOT / "docs" / "snippets-A" / "pioneer10_fallback.json"


def horizons_query(
    command: str,
    start: str,
    stop: str,
    step: str,
    timeout: float,
) -> str:
    params = {
        "format": "text",
        "COMMAND": f"'{command}'",
        "OBJ_DATA": "'NO'",
        "MAKE_EPHEM": "'YES'",
        "EPHEM_TYPE": "'OBSERVER'",
        "CENTER": "'geo'",
        "START_TIME": f"'{start}'",
        "STOP_TIME": f"'{stop}'",
        "STEP_SIZE": f"'{step}'",
        "QUANTITIES": "'1,20'",
        "CSV_FORMAT": "'YES'",
        "ANG_FORMAT": "'HMS'",
    }
    url = API_ENDPOINT + "?" + urllib.parse.urlencode(params, quote_via=urllib.parse.quote)
    request = urllib.request.Request(url, headers={"User-Agent": "Echo-Station/1.0"})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read().decode("utf-8", errors="replace")


def parse_ra(text: str) -> float:
    hours, minutes, seconds = (float(part) for part in text.split())
    return (hours + minutes / 60.0 + seconds / 3600.0) % 24.0


def parse_dec(text: str) -> float:
    sign = -1.0 if text.strip().startswith("-") else 1.0
    degrees, minutes, seconds = (float(part) for part in text.replace("+", " ").replace("-", " ").split())
    return sign * (degrees + minutes / 60.0 + seconds / 3600.0)


def parse_rows(payload: str) -> list[dict[str, object]]:
    if "$$SOE" not in payload or "$$EOE" not in payload:
        raise ValueError("Horizons returned no ephemeris table (target may not be available).")

    body = payload.split("$$SOE", 1)[1].split("$$EOE", 1)[0]
    points: list[dict[str, object]] = []

    for line in body.splitlines():
        line = line.strip().rstrip(",")
        if not line:
            continue
        fields = [field.strip() for field in line.split(",")]
        if len(fields) < 5:
            continue

        # Find the RA field (e.g. "05 17 23.44"), then Dec and delta follow.
        ra_index = next((i for i, field in enumerate(fields) if RA_RE.match(field)), None)
        if ra_index is None or ra_index + 2 >= len(fields):
            continue

        ra = parse_ra(fields[ra_index])
        dec = parse_dec(fields[ra_index + 1])
        delta = float(fields[ra_index + 2])
        if not (0.0 <= ra < 24.0 and -90.0 <= dec <= 90.0 and delta > 0.0):
            continue

        stamp = fields[0].replace(" ", "T")
        when = dt.datetime.strptime(stamp, "%Y-%b-%dT%H:%M").replace(tzinfo=dt.timezone.utc)
        points.append(
            {
                "t": when.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "ra": round(ra, 6),
                "dec": round(dec, 6),
                "dist_au": round(delta, 8),
            }
        )

    if not points:
        raise ValueError("Ephemeris table was empty after parsing.")
    return points


def write_target(
    name: str,
    command: str,
    points: list[dict[str, object]],
    out_dir: Path,
    start: str,
    stop: str,
    step: str,
) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / f"{name}.json"
    document = {
        "target": name,
        "source": "NASA/JPL Horizons (DE441)",
        "command": command,
        "center": "geo",
        "generated_utc": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "start": start,
        "stop": stop,
        "step": step,
        "points": points,
    }
    path.write_text(json.dumps(document, indent=1) + "\n", encoding="utf-8")
    return path


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Download JPL Horizons ephemerides as JSON.")
    parser.add_argument("--targets", default="ceres,pioneer10", help="comma-separated target names")
    parser.add_argument("--all", action="store_true", help="include the optional targets")
    parser.add_argument("--start", default="2026-01-01", help="UTC start date (YYYY-MM-DD)")
    parser.add_argument("--stop", default="2027-01-01", help="UTC stop date (YYYY-MM-DD)")
    parser.add_argument("--step", default="1 d", help="Horizons step size, e.g. '1 d' or '6 h'")
    parser.add_argument("--out", default=str(DEFAULT_OUT), help="output directory")
    parser.add_argument("--timeout", type=float, default=90.0, help="HTTP timeout in seconds")
    args = parser.parse_args(argv)

    out_dir = Path(args.out)
    if args.all:
        names = list(TARGETS)
    else:
        names = [name.strip() for name in args.targets.split(",") if name.strip()]

    failures: list[str] = []

    for name in names:
        spec = TARGETS.get(name)
        if spec is None:
            print(f"FAIL {name}: unknown target (known: {', '.join(TARGETS)})")
            failures.append(name)
            continue

        command = str(spec["command"])
        try:
            payload = horizons_query(command, args.start, args.stop, args.step, args.timeout)
            points = parse_rows(payload)
            path = write_target(name, command, points, out_dir, args.start, args.stop, args.step)
            print(f"OK {name}: {len(points)} points -> {path.relative_to(REPO_ROOT)}")
        except Exception as error:  # noqa: BLE001 - report every target independently
            print(f"FAIL {name}: {error}")
            failures.append(name)

            if name == "pioneer10" and FALLBACK.exists():
                out_dir.mkdir(parents=True, exist_ok=True)
                destination = out_dir / "pioneer10.json"
                shutil.copyfile(FALLBACK, destination)
                print(f"     Pioneer 10 fallback copied -> {destination.relative_to(REPO_ROOT)}")

    required_failed = [name for name in failures if TARGETS.get(name, {}).get("required")]
    if required_failed:
        print("\nRequired targets failed: " + ", ".join(required_failed))
        print("Optional targets are allowed to fail; they are not used by the site.")
        return 1

    print("\nDone. Next: git add data/sky tools && git commit -m \"Sky: Horizons positions + distances\"")
    return 0


if __name__ == "__main__":
    sys.exit(main())
