"""Precompute the next 72 hours of live sky events over Hood River for the website: visible ISS passes,
freshly launched Starlink trains, and any naked-eye comet. Writes assets/sky.json.

Run it once a day (a GitHub Action does this for the published site). Visitors' browsers only read the
file, so the orbit sources (CelesTrak, the Minor Planet Center) see one download a day, not one per visitor.

    pip install sgp4
    python tools/skyjob.py [out.json]

The orbit and visibility code in tools/sky/ is the LED board's own (led-matrix tools/sky_events.py and
sky_more.py), validated against heavens-above passes and known comets.
"""
import json
import math
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE / "sky"))
import sky_events  # noqa: E402
import sky_more  # noqa: E402

HOURS = 72
ISS_STEP_S, TRAIN_STEP_S, COMET_STEP_S = 10, 10, 300


def ms(dt):
    return int(dt.timestamp() * 1000)


def iss_passes(start, log):
    """Visible ISS passes as {start, step, pts: [[az, el], ...]}."""
    from sgp4.api import Satrec
    lines = [ln.strip() for ln in sky_events.fetch_cached(sky_events.TLE_URL, "iss.tle", 6).splitlines() if ln.strip()]
    iss = sky_events.ISS(log=log, fetch=False)
    iss.sat = Satrec.twoline2rv(lines[1], lines[2])
    out, cur, t = [], None, start
    while t < start + timedelta(hours=HOURS):
        v = iss.visible(t)
        if v:
            if cur is None:
                cur = {"start": ms(t), "step": ISS_STEP_S * 1000, "pts": []}
            cur["pts"].append([round(v[0], 2), round(v[1], 2)])
        elif cur:
            out.append(cur)
            cur = None
        t += timedelta(seconds=ISS_STEP_S)
    if cur:
        out.append(cur)
    return out


def starlink_windows(start, log, trains=None):
    """Windows when a train is visible, as {start, step, tracks: [[[az, el] | null, ...] per satellite]}."""
    if trains is None:
        trains = sky_more.StarlinkTrains(log=log, background=False)
        trains.load()
    if not trains.sats:
        return []
    out, cur, t = [], None, start
    while t < start + timedelta(hours=HOURS):
        # coarse scan every minute, then sample each visible stretch finely
        if trains.visible(t) or (cur is not None):
            step_t = t
            frames = []
            while True:
                vis = per_sat_visible(trains, step_t)
                if not any(vis):
                    break
                frames.append(vis)
                step_t += timedelta(seconds=TRAIN_STEP_S)
            if frames:
                tracks = [[f[k] for f in frames] for k in range(len(trains.sats))]
                tracks = [tr for tr in tracks if any(tr)]
                out.append({"start": ms(t), "step": TRAIN_STEP_S * 1000, "tracks": tracks})
                t = step_t
            cur = None
        t += timedelta(seconds=60)
    return out


def per_sat_visible(trains, dt_utc):
    """[[az, el] or None] for each train satellite at this moment (None when not a naked-eye sight)."""
    jd = sky_events.julian(dt_utc)
    if sky_events.sun_elevation(jd) > -4:
        return [None] * len(trains.sats)
    s = sky_events.sun_eci_unit(jd)
    jd0 = math.floor(jd - 0.5) + 0.5
    out = []
    for sat in trains.sats:
        err, r, _ = sat.sgp4(jd0, jd - jd0)
        if err:
            out.append(None)
            continue
        along = r[0] * s[0] + r[1] * s[1] + r[2] * s[2]
        perp = math.sqrt(max(0.0, r[0] ** 2 + r[1] ** 2 + r[2] ** 2 - along * along))
        if along < 0 and perp < 6378.137:
            out.append(None)  # in Earth's shadow
            continue
        az, el = sky_events.look_angles(jd, r)
        out.append([round(az, 2), round(el, 2)] if el > 10 else None)
    return out


def bright_comets(start, log):
    """Naked-eye comets above the horizon as {name, samples: [[ms, mag, az, el, tail], ...]}."""
    comets = sky_more.Comets(log=log, background=False)
    comets.load()
    # find candidates cheaply: anything brighter than the limit at some point in the window
    comets.LIMIT_MAG = 30
    cand = set()
    for h in range(0, HOURS + 1, 6):
        t = start + timedelta(hours=h)
        jd = sky_events.julian(t)
        ex, ey, ez = sky_more.planet_helio("earth", jd)
        for o in comets.orbits:
            try:
                (x, y, z), r = comets.helio(o, jd)
                delta = math.dist((x, y, z), (ex, ey, ez))
                if o["H"] + 5 * math.log10(delta) + 2.5 * o["G"] * math.log10(r) < sky_more.Comets.LIMIT_MAG + 0.5:
                    cand.add(o["name"])
            except (ValueError, OverflowError, ZeroDivisionError):
                continue
    comets.orbits = [o for o in comets.orbits if o["name"] in cand]
    comets.LIMIT_MAG = sky_more.Comets.LIMIT_MAG
    tracks = {}
    t = start
    while t < start + timedelta(hours=HOURS):
        for name, mag, az, el, tail in comets.bright(t):
            tracks.setdefault(name, []).append([ms(t), round(mag, 2), round(az, 2), round(el, 2), round(tail, 3)])
        t += timedelta(seconds=COMET_STEP_S)
    return [{"name": n, "samples": s} for n, s in tracks.items()]


def main():
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE.parent / "assets" / "sky.json"
    log = lambda m: print(m, flush=True)  # noqa: E731
    start = datetime.now(timezone.utc).replace(second=0, microsecond=0)
    t0 = time.time()
    data = {"generated": ms(start), "until": ms(start + timedelta(hours=HOURS)), "iss": [], "starlink": [], "comets": []}
    for key, fn in (("iss", iss_passes), ("starlink", starlink_windows), ("comets", bright_comets)):
        try:
            data[key] = fn(start, log)
        except Exception as e:  # a failed source leaves the others working
            log(f"{key}: failed: {e}")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(data, separators=(",", ":")))
    log(f"wrote {out}: {len(data['iss'])} ISS passes, {len(data['starlink'])} Starlink windows, "
        f"{len(data['comets'])} comets, {out.stat().st_size // 1024} KB in {time.time() - t0:.0f} s")


if __name__ == "__main__":
    main()
