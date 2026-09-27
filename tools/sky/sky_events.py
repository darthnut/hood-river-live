"""Real sky events for the Gorge scene: ISS passes over Hood River and lunar eclipses.

ISS: current orbital elements (TLE) from CelesTrak, refreshed every 12 hours, propagated with SGP4.
A pass is visible when the station is above 10 degrees, your sky is dark enough (sun below -3 degrees, as heavens-above counts it) and
the station itself is still in sunlight.

Lunar eclipses: Meeus, Astronomical Algorithms ch. 54 (umbral eclipses only; penumbral ones are
invisible to the eye), accurate to a few minutes.
"""
import math
import os
import tempfile
import threading
import time
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

LAT, LON, ALT_KM = 45.7054, -121.5215, 0.03
TLE_URL = "https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE"
R_EARTH = 6378.137


CACHE = Path(os.environ.get("LOCALAPPDATA", tempfile.gettempdir())) / "led-matrix" / "cache"


def fetch_cached(url, name, max_age_h):
    """Download `url`, reusing a copy on disk younger than max_age_h. CelesTrak blocks clients that
    re-download unchanged data within a couple of hours, so restarts must not refetch."""
    path = CACHE / name
    try:
        if time.time() - path.stat().st_mtime < max_age_h * 3600:
            return path.read_text(encoding="latin-1")
    except OSError:
        pass
    try:
        data = urllib.request.urlopen(url, timeout=30).read().decode("latin-1")
        CACHE.mkdir(parents=True, exist_ok=True)
        path.write_text(data, encoding="latin-1")
        return data
    except Exception:
        if path.exists():  # stale beats nothing
            return path.read_text(encoding="latin-1")
        raise


def julian(dt_utc: datetime) -> float:
    return dt_utc.timestamp() / 86400 + 2440587.5


def sun_eci_unit(jd: float):
    """Unit vector to the sun in an Earth-centred inertial frame (good to ~0.01 deg)."""
    n = jd - 2451545.0
    L = math.radians((280.460 + 0.9856474 * n) % 360)
    g = math.radians((357.528 + 0.9856003 * n) % 360)
    lam = L + math.radians(1.915 * math.sin(g) + 0.020 * math.sin(2 * g))
    eps = math.radians(23.439 - 0.0000004 * n)
    return math.cos(lam), math.cos(eps) * math.sin(lam), math.sin(eps) * math.sin(lam)


def sun_elevation(jd: float) -> float:
    sx, sy, sz = sun_eci_unit(jd)
    return look_angles(jd, (sx * 1.496e8, sy * 1.496e8, sz * 1.496e8))[1]


def look_angles(jd: float, r_eci):
    """(azimuth, elevation) in degrees of an ECI position (km) seen from Hood River."""
    gmst = math.radians((280.46061837 + 360.98564736629 * (jd - 2451545.0)) % 360)
    x, y, z = r_eci
    xe, ye = x * math.cos(gmst) + y * math.sin(gmst), -x * math.sin(gmst) + y * math.cos(gmst)
    lat, lon = math.radians(LAT), math.radians(LON)
    a, e2 = 6378.137, 0.00669437999014  # WGS84
    N = a / math.sqrt(1 - e2 * math.sin(lat) ** 2)
    ox = (N + ALT_KM) * math.cos(lat) * math.cos(lon)
    oy = (N + ALT_KM) * math.cos(lat) * math.sin(lon)
    oz = (N * (1 - e2) + ALT_KM) * math.sin(lat)
    dx, dy, dz = xe - ox, ye - oy, z - oz
    east = -math.sin(lon) * dx + math.cos(lon) * dy
    north = -math.sin(lat) * math.cos(lon) * dx - math.sin(lat) * math.sin(lon) * dy + math.cos(lat) * dz
    up = math.cos(lat) * math.cos(lon) * dx + math.cos(lat) * math.sin(lon) * dy + math.sin(lat) * dz
    rng = math.sqrt(dx * dx + dy * dy + dz * dz)
    return math.degrees(math.atan2(east, north)) % 360, math.degrees(math.asin(up / rng))


class ISS:
    def __init__(self, log=print, fetch=True):
        self.sat, self.log = None, log
        if fetch:
            threading.Thread(target=self._loop, daemon=True).start()

    def _loop(self):
        from sgp4.api import Satrec
        while True:
            try:
                lines = [ln.strip() for ln in fetch_cached(TLE_URL, "iss.tle", 12).splitlines() if ln.strip()]
                self.sat = Satrec.twoline2rv(lines[1], lines[2])
            except Exception as e:
                self.log(f"iss: TLE fetch failed: {e}")
            time.sleep(12 * 3600)

    def look(self, dt_utc: datetime):
        """(azimuth, elevation, sunlit) of the ISS at a UTC time, or None without orbital elements."""
        if self.sat is None:
            return None
        jd = julian(dt_utc)
        err, r, _ = self.sat.sgp4(math.floor(jd - 0.5) + 0.5, jd - (math.floor(jd - 0.5) + 0.5))
        if err:
            return None
        az, el = look_angles(jd, r)
        s = sun_eci_unit(jd)
        along = r[0] * s[0] + r[1] * s[1] + r[2] * s[2]
        perp = math.sqrt(max(0.0, r[0] ** 2 + r[1] ** 2 + r[2] ** 2 - along * along))
        sunlit = along > 0 or perp > R_EARTH  # outside Earth's cylindrical shadow
        return az, el, sunlit

    def visible(self, dt_utc: datetime):
        """(az, el) if the ISS is a naked-eye sight from Hood River right now, else None."""
        v = self.look(dt_utc)
        if v and v[1] > 10 and v[2] and sun_elevation(julian(dt_utc)) < -3:
            return v[0], v[1]
        return None

    def passes(self, start: datetime, hours=72, step=20):
        """Visible passes as (start, end, max elevation), for checking against published predictions."""
        out, cur, t = [], None, start
        while t < start + timedelta(hours=hours):
            v = self.visible(t)
            if v:
                cur = [t, t, v[1]] if cur is None else [cur[0], t, max(cur[2], v[1])]
            elif cur:
                out.append(tuple(cur))
                cur = None
            t += timedelta(seconds=step)
        return out


def lunar_eclipse_near(when: datetime):
    """The umbral lunar eclipse at the full moon nearest `when`, or None.

    Returns dict(max=UTC datetime, kind 'partial'/'total', magnitude, partial_min, total_min, gamma)."""
    year = when.year + (when.timetuple().tm_yday - 0.5) / 365.25
    k = round((year - 2000) * 12.3685 - 0.5) + 0.5
    T = k / 1236.85
    rad = math.radians
    M = rad((2.5534 + 29.10535670 * k - 0.0000014 * T * T) % 360)
    Mp = rad((201.5643 + 385.81693528 * k + 0.0107582 * T * T) % 360)
    F = rad((160.7108 + 390.67050284 * k - 0.0016118 * T * T) % 360)
    Om = rad((124.7746 - 1.56375588 * k + 0.0020672 * T * T) % 360)
    if abs(math.sin(F)) > 0.36:
        return None
    E = 1 - 0.002516 * T
    F1 = F - rad(0.02665) * math.sin(Om)
    A1 = rad((299.77 + 0.107408 * k) % 360)
    jde = 2451550.09766 + 29.530588861 * k + 0.00015437 * T * T
    jde += (-0.4065 * math.sin(Mp) + 0.1727 * E * math.sin(M) + 0.0161 * math.sin(2 * Mp) - 0.0097 * math.sin(2 * F1)
            + 0.0073 * E * math.sin(Mp - M) - 0.0050 * E * math.sin(Mp + M) - 0.0023 * math.sin(Mp - 2 * F1)
            + 0.0021 * E * math.sin(2 * M) + 0.0012 * math.sin(Mp + 2 * F1) + 0.0006 * E * math.sin(2 * Mp + M)
            - 0.0004 * math.sin(3 * Mp) - 0.0003 * E * math.sin(M + 2 * F1) + 0.0003 * math.sin(A1)
            - 0.0002 * E * math.sin(M - 2 * F1) - 0.0002 * E * math.sin(2 * Mp - M) - 0.0002 * math.sin(Om))
    P = (0.2070 * E * math.sin(M) + 0.0024 * E * math.sin(2 * M) - 0.0392 * math.sin(Mp) + 0.0116 * math.sin(2 * Mp)
         - 0.0073 * E * math.sin(Mp + M) + 0.0067 * E * math.sin(Mp - M) + 0.0118 * math.sin(2 * F1))
    Q = (5.2207 - 0.0048 * E * math.cos(M) + 0.0020 * E * math.cos(2 * M) - 0.3299 * math.cos(Mp)
         - 0.0060 * E * math.cos(Mp + M) + 0.0041 * E * math.cos(Mp - M))
    Wf = abs(math.cos(F1))
    gamma = (P * math.cos(F1) + Q * math.sin(F1)) * (1 - 0.0048 * Wf)
    u = 0.0059 + 0.0046 * E * math.cos(M) - 0.0182 * math.cos(Mp) + 0.0004 * math.cos(2 * Mp) - 0.0005 * math.cos(M + Mp)
    mag = (1.0128 - u - abs(gamma)) / 0.5450
    if mag <= 0:
        return None
    n = 0.5458 + 0.0400 * math.cos(Mp)
    p, tt = 1.0128 - u, 0.4678 - u
    partial = 60 / n * math.sqrt(max(0.0, p * p - gamma * gamma))
    total = 60 / n * math.sqrt(tt * tt - gamma * gamma) if tt * tt > gamma * gamma else 0.0
    mx = datetime(2000, 1, 1, 12, tzinfo=timezone.utc) + timedelta(days=jde - 2451545.0) - timedelta(seconds=69)
    return dict(max=mx, kind="total" if total > 0 else "partial", magnitude=mag, partial_min=partial,
                total_min=total, gamma=gamma)
