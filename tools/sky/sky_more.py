"""More of the real sky over Hood River: planets, meteor showers, solar eclipses, Starlink trains, comets.

Everything is computed locally except two small downloads refreshed in the background: CelesTrak's
Starlink orbital elements (to find freshly launched "trains") and the Minor Planet Center's comet
orbits (to find any comet bright enough to see). Accuracy targets a 256x64 display: planets to a few
arcminutes (JPL's approximate Keplerian elements), the moon to under a minute of arc (the largest terms
of Meeus ch. 47), which puts local solar eclipse times within a minute or two.
"""
import math
import threading
import time
from datetime import date, datetime, timedelta, timezone

from sky_events import ALT_KM, LAT, LON, fetch_cached, julian, look_angles, sun_eci_unit

RAD, DEG = math.pi / 180, 180 / math.pi
AU_KM = 149597870.7
EPS_J2000 = 23.4392911


def gmst_deg(jd):
    return (280.46061837 + 360.98564736629 * (jd - 2451545.0)) % 360


def radec_to_azel(jd, ra_deg, dec_deg):
    """Azimuth/elevation (degrees) of a distant object at RA/Dec (degrees) from Hood River."""
    ha = (gmst_deg(jd) + LON - ra_deg) * RAD
    lat, dec = LAT * RAD, dec_deg * RAD
    el = math.asin(math.sin(lat) * math.sin(dec) + math.cos(lat) * math.cos(dec) * math.cos(ha))
    az = math.atan2(-math.cos(dec) * math.sin(ha), math.sin(dec) * math.cos(lat) - math.cos(dec) * math.sin(lat) * math.cos(ha))
    return (az * DEG) % 360, el * DEG


def ecl_to_equ(x, y, z, eps_deg=EPS_J2000):
    e = eps_deg * RAD
    return x, y * math.cos(e) - z * math.sin(e), y * math.sin(e) + z * math.cos(e)


def vec_radec(x, y, z):
    return (math.atan2(y, x) * DEG) % 360, math.atan2(z, math.hypot(x, y)) * DEG


# ---------------------------------------------------------------- planets

# JPL "Approximate Positions of the Planets", 1800-2050: a, e, I, L, long. perihelion, long. node
# (AU, degrees, J2000 ecliptic) and their rates per Julian century.
ELEMENTS = {
    "venus": ((0.72333566, 0.00677672, 3.39467605, 181.97909950, 131.60246718, 76.67984255),
              (0.00000390, -0.00004107, -0.00078890, 58517.81538729, 0.00268329, -0.27769418)),
    "earth": ((1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0),
              (0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0.0)),
    "mars": ((1.52371034, 0.09339410, 1.84969142, -4.55343205, -23.94362959, 49.55953891),
             (0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343)),
    "jupiter": ((5.20288700, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909),
                (-0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106)),
    "saturn": ((9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448),
               (-0.00125060, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794)),
}


def kepler_E(M, e):
    E = M + e * math.sin(M)
    for _ in range(30):
        d = (E - e * math.sin(E) - M) / (1 - e * math.cos(E))
        E -= d
        if abs(d) < 1e-10:
            break
    return E


def orbit_xyz(r, nu, w, node, inc):
    """Heliocentric ecliptic position from distance, true anomaly and orientation (radians)."""
    u = w + nu
    return (r * (math.cos(node) * math.cos(u) - math.sin(node) * math.sin(u) * math.cos(inc)),
            r * (math.sin(node) * math.cos(u) + math.cos(node) * math.sin(u) * math.cos(inc)),
            r * math.sin(u) * math.sin(inc))


def planet_helio(name, jd):
    T = (jd - 2451545.0) / 36525
    (a, e, I, L, wp, node), rates = ELEMENTS[name]
    a, e, I, L, wp, node = (v + r * T for v, r in zip((a, e, I, L, wp, node), rates))
    M = ((L - wp + 180) % 360 - 180) * RAD
    E = kepler_E(M, e)
    xp, yp = a * (math.cos(E) - e), a * math.sqrt(1 - e * e) * math.sin(E)
    return orbit_xyz(math.hypot(xp, yp), math.atan2(yp, xp), (wp - node) * RAD, node * RAD, I * RAD)


PLANET_LOOK = {  # colour and a rough brightness for drawing
    "venus": ((255, 250, 230), 1.0), "jupiter": ((255, 240, 205), 0.8),
    "mars": ((255, 150, 110), 0.6), "saturn": ((245, 225, 170), 0.55),
}


def planet_radec(name, jd):
    ex, ey, ez = planet_helio("earth", jd)
    px, py, pz = planet_helio(name, jd)
    x, y, z = ecl_to_equ(px - ex, py - ey, pz - ez)
    ra, dec = vec_radec(x, y, z)
    return ra, dec, math.sqrt(x * x + y * y + z * z)


def planets(dt_utc):
    """[(name, az, el, distance AU, hour angle deg)] for the naked-eye planets we draw."""
    jd = julian(dt_utc)
    out = []
    for name in PLANET_LOOK:
        ra, dec, dist = planet_radec(name, jd)
        az, el = radec_to_azel(jd, ra, dec)
        ha = (gmst_deg(jd) + LON - ra + 180) % 360 - 180
        out.append((name, az, el, dist, ha))
    return out


def moon_radec(dt_utc):
    """Geocentric RA/Dec (degrees) of the moon."""
    jd = julian(dt_utc)
    lon, lat, dist = moon_ecliptic(jd)
    T = (jd - 2451545.0) / 36525
    l, b = lon * RAD, lat * RAD
    return vec_radec(*ecl_to_equ(math.cos(b) * math.cos(l), math.cos(b) * math.sin(l), math.sin(b),
                                 23.4392911 - 0.0130042 * T))


def moon_planet_pairs(dt_utc, within=4.0):
    """[(planet, separation deg)] for planets within `within` degrees of the moon."""
    jd = julian(dt_utc)
    mra, mdec = moon_radec(dt_utc)
    out = []
    for name in PLANET_LOOK:
        ra, dec, _ = planet_radec(name, jd)
        cs = (math.sin(mdec * RAD) * math.sin(dec * RAD)
              + math.cos(mdec * RAD) * math.cos(dec * RAD) * math.cos((mra - ra) * RAD))
        sep = math.acos(max(-1.0, min(1.0, cs))) * DEG
        if sep < within:
            out.append((name, sep))
    return out


# ---------------------------------------------------------------- the moon and the sun, for solar eclipses

# Largest terms of Meeus ch. 47: (D, M, M', F, longitude 1e-6 deg, distance 1e-3 km)
_LR = [(0, 0, 1, 0, 6288774, -20905355), (2, 0, -1, 0, 1274027, -3699111), (2, 0, 0, 0, 658314, -2955968),
       (0, 0, 2, 0, 213618, -569925), (0, 1, 0, 0, -185116, 48888), (0, 0, 0, 2, -114332, -3149),
       (2, 0, -2, 0, 58793, 246158), (2, -1, -1, 0, 57066, -152138), (2, 0, 1, 0, 53322, -170733),
       (2, -1, 0, 0, 45758, -204586), (0, 1, -1, 0, -40923, -129620), (1, 0, 0, 0, -34720, 108743),
       (0, 1, 1, 0, -30383, 104755), (2, 0, 0, -2, 15327, 10321), (0, 0, 1, 2, -12528, 0),
       (0, 0, 1, -2, 10980, 79661), (4, 0, -1, 0, 10675, -34782), (0, 0, 3, 0, 10034, -23210),
       (4, 0, -2, 0, 8548, -21636), (2, 1, -1, 0, -7888, 24208), (2, 1, 0, 0, -6766, 30824),
       (1, 0, -1, 0, -5163, -8379), (1, 1, 0, 0, 4987, -16675), (2, -1, 1, 0, 4036, -12831),
       (2, 0, 2, 0, 3994, -10445), (4, 0, 0, 0, 3861, -11650), (2, 0, -3, 0, 3665, 14403),
       (0, 1, -2, 0, -2689, -7003), (2, 0, -1, 2, -2602, 0), (2, -1, -2, 0, 2390, 10056),
       (1, 0, 1, 0, -2348, 6322), (2, -2, 0, 0, 2236, -9884), (0, 1, 2, 0, -2120, 5751),
       (0, 2, 0, 0, -2069, 0)]
# (D, M, M', F, latitude 1e-6 deg)
_B = [(0, 0, 0, 1, 5128122), (0, 0, 1, 1, 280602), (0, 0, 1, -1, 277693), (2, 0, 0, -1, 173237),
      (2, 0, -1, 1, 55413), (2, 0, -1, -1, 46271), (2, 0, 0, 1, 32573), (0, 0, 2, 1, 17198),
      (2, 0, 1, -1, 9266), (0, 0, 2, -1, 8822), (2, -1, 0, -1, 8216), (2, 0, -2, -1, 4324),
      (2, 0, 1, 1, 4200), (2, 1, 0, -1, -3359), (2, -1, -1, 1, 2463), (2, -1, 0, 1, 2211),
      (2, -1, -1, -1, 2065), (0, 1, -1, -1, -1870), (4, 0, -1, -1, 1828), (0, 1, 0, 1, -1794),
      (0, 0, 0, 3, -1749), (0, 1, -1, 1, -1565), (1, 0, 0, 1, -1491), (0, 1, 1, 1, -1475),
      (0, 1, 1, -1, -1410), (0, 1, 0, -1, -1344), (1, 0, 0, -1, -1335), (0, 0, 3, 1, 1107)]


def moon_ecliptic(jd):
    """Geocentric ecliptic longitude, latitude (degrees, mean equinox of date) and distance (km)."""
    T = (jd + 69 / 86400 - 2451545.0) / 36525  # TT
    Lp = 218.3164477 + 481267.88123421 * T - 0.0015786 * T * T
    D = (297.8501921 + 445267.1114034 * T - 0.0018819 * T * T) * RAD
    M = (357.5291092 + 35999.0502909 * T - 0.0001536 * T * T) * RAD
    Mp = (134.9633964 + 477198.8675055 * T + 0.0087414 * T * T) * RAD
    F = (93.2720950 + 483202.0175233 * T - 0.0036539 * T * T) * RAD
    A1, A2, A3 = (119.75 + 131.849 * T) * RAD, (53.09 + 479264.290 * T) * RAD, (313.45 + 481266.484 * T) * RAD
    E = 1 - 0.002516 * T - 0.0000074 * T * T
    sl = sr = sb = 0.0
    for d, m, mp, f, cl, cr in _LR:
        k = E ** abs(m)
        arg = d * D + m * M + mp * Mp + f * F
        sl += cl * k * math.sin(arg)
        sr += cr * k * math.cos(arg)
    for d, m, mp, f, cb in _B:
        sb += cb * E ** abs(m) * math.sin(d * D + m * M + mp * Mp + f * F)
    Lr = Lp * RAD
    sl += 3958 * math.sin(A1) + 1962 * math.sin(Lr - F) + 318 * math.sin(A2)
    sb += (-2235 * math.sin(Lr) + 382 * math.sin(A3) + 175 * math.sin(A1 - F) + 175 * math.sin(A1 + F)
           + 127 * math.sin(Lr - Mp) - 115 * math.sin(Lr + Mp))
    return (Lp + sl / 1e6) % 360, sb / 1e6, 385000.56 + sr / 1000


def sun_ecliptic(jd):
    """Apparent-ish geocentric longitude of the sun (degrees, equinox of date) and distance (AU); Meeus ch. 25."""
    T = (jd + 69 / 86400 - 2451545.0) / 36525
    L0 = 280.46646 + 36000.76983 * T
    M = (357.52911 + 35999.05029 * T) * RAD
    e = 0.016708634 - 0.000042037 * T
    C = (1.914602 - 0.004817 * T) * math.sin(M) + (0.019993 - 0.000101 * T) * math.sin(2 * M) + 0.000289 * math.sin(3 * M)
    nu = M + C * RAD
    R = 1.000001018 * (1 - e * e) / (1 + e * math.cos(nu))
    return (L0 + C - 0.00569) % 360, R


def _topo(jd, lon_ecl, lat_ecl, dist_km):
    """Topocentric unit vector and distance (equatorial of date) of a body at ecliptic coordinates."""
    T = (jd - 2451545.0) / 36525
    eps = 23.4392911 - 0.0130042 * T
    l, b = lon_ecl * RAD, lat_ecl * RAD
    x, y, z = ecl_to_equ(dist_km * math.cos(b) * math.cos(l), dist_km * math.cos(b) * math.sin(l),
                         dist_km * math.sin(b), eps)
    th = (gmst_deg(jd) + LON) * RAD
    lat = LAT * RAD
    a, e2 = 6378.137, 0.00669437999014
    N = a / math.sqrt(1 - e2 * math.sin(lat) ** 2)
    ox, oy, oz = ((N + ALT_KM) * math.cos(lat) * math.cos(th), (N + ALT_KM) * math.cos(lat) * math.sin(th),
                  (N * (1 - e2) + ALT_KM) * math.sin(lat))
    dx, dy, dz = x - ox, y - oy, z - oz
    d = math.sqrt(dx * dx + dy * dy + dz * dz)
    return (dx / d, dy / d, dz / d), d


def sun_moon_local(dt_utc):
    """What an observer in Hood River sees: dict(sep, r_sun, r_moon in degrees, sun_el, pa of the moon's
    offset from the sun's centre on the sky, measured from up toward the right-hand side)."""
    jd = julian(dt_utc)
    ls, R = sun_ecliptic(jd)
    lm, bm, dm = moon_ecliptic(jd)
    us, ds = _topo(jd, ls, 0.0, R * AU_KM)
    um, dmt = _topo(jd, lm, bm, dm)
    cosd = max(-1.0, min(1.0, sum(a * b for a, b in zip(us, um))))
    sep = math.acos(cosd) * DEG
    ra_s, dec_s = vec_radec(*us)
    ra_m, dec_m = vec_radec(*um)
    az_s, el_s = radec_to_azel(jd, ra_s, dec_s)
    az_m, el_m = radec_to_azel(jd, ra_m, dec_m)
    daz = ((az_m - az_s + 180) % 360 - 180) * math.cos(el_s * RAD)
    return dict(sep=sep, r_sun=0.266563 / R, r_moon=math.asin(1737.4 / dmt) * DEG, sun_el=el_s, sun_az=az_s,
                dx=daz, dy=el_m - el_s)


def solar_eclipse_on(day: date):
    """The solar eclipse seen from Hood River on this local date, or None:
    dict(start, max, end as UTC datetimes, magnitude = fraction of the sun's diameter covered)."""
    # quick reject: only near new moon
    noon = datetime(day.year, day.month, day.day, 20, 0, tzinfo=timezone.utc)
    jd = julian(noon)
    if abs((moon_ecliptic(jd)[0] - sun_ecliptic(jd)[0] + 180) % 360 - 180) > 20:
        return None
    best, first, last = None, None, None
    t = datetime(day.year, day.month, day.day, 12, 0, tzinfo=timezone.utc)  # ~5 am PDT .. 9 pm
    for _ in range(16 * 30):
        s = sun_moon_local(t)
        if s["sun_el"] > -0.8 and s["sep"] < s["r_sun"] + s["r_moon"]:
            first = first or t
            last = t
            mag = (s["r_sun"] + s["r_moon"] - s["sep"]) / (2 * s["r_sun"])
            if best is None or mag > best[1]:
                best = (t, mag)
        t += timedelta(minutes=2)
    if not best:
        return None
    return dict(start=first, max=best[0], end=last, magnitude=best[1])


# ---------------------------------------------------------------- meteor showers

# (name, peak month, day, radiant RA, Dec (degrees), zenithal hourly rate)
SHOWERS = [("Quadrantids", 1, 4, 230, 49, 110), ("Lyrids", 4, 22, 271, 34, 18),
           ("Eta Aquariids", 5, 6, 338, -1, 50), ("Delta Aquariids", 7, 30, 340, -16, 25),
           ("Perseids", 8, 12, 48, 58, 100), ("Draconids", 10, 8, 262, 54, 10),
           ("Orionids", 10, 21, 95, 16, 20), ("Leonids", 11, 17, 152, 22, 15),
           ("Geminids", 12, 14, 112, 33, 150), ("Ursids", 12, 22, 217, 76, 10)]


def active_shower(local_now: datetime):
    """(name, activity 0..1, zhr, radiant az, radiant el) for a shower near its peak tonight, else None.
    'Tonight' runs noon to noon, so the peak night carries through the small hours."""
    night_of = (local_now - timedelta(hours=12)).date()
    for name, m, d, ra, dec, zhr in SHOWERS:
        peak = date(night_of.year, m, d)
        days = abs((night_of - peak).days)
        if days <= 2:
            jd = julian(local_now.astimezone(timezone.utc))
            az, el = radec_to_azel(jd, ra, dec)
            return name, (1.0, 0.5, 0.2)[days], zhr, az, el
    return None


# ---------------------------------------------------------------- Starlink trains


class StarlinkTrains:
    """Freshly launched Starlink satellites still low and bunched up: the 'string of pearls' train."""
    URL = "https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=tle"

    def __init__(self, log=print, background=True):
        self.log, self.sats, self.label = log, None, ""
        if background:
            threading.Thread(target=self._loop, daemon=True).start()

    def load(self):
        """Fetch the Starlink elements once and keep the satellites still in train formation."""
        from sgp4.api import Satrec
        raw = fetch_cached(self.URL, "starlink.tle", 12).splitlines()
        lines = [ln.rstrip() for ln in raw if ln.strip()]
        recs = []
        for i in range(0, len(lines) - 2, 3):
            l1, l2 = lines[i + 1], lines[i + 2]
            launch = (int(l1[9:11]), int(l1[11:14]))  # international designator: year, launch number
            mean_motion = float(l2[52:63])
            recs.append((launch, mean_motion, l1, l2))
        newest = sorted({r[0] for r in recs}, reverse=True)[:4]
        # still in the low, bunched-up phase: orbit well below the 550 km operating shell
        low = [r for r in recs if r[0] in newest and r[1] > 15.4]
        counts = {}
        for r in low:
            counts[r[0]] = counts.get(r[0], 0) + 1
        self.sats = [Satrec.twoline2rv(l1, l2) for launch, n, l1, l2 in low if counts[launch] >= 10]
        self.log(f"starlink: {len(self.sats)} satellites from recent launches still in train formation")

    def _loop(self):
        while True:
            try:
                self.load()
                time.sleep(12 * 3600)
            except Exception as e:
                self.log(f"starlink: fetch failed: {e}; retrying in an hour")
                time.sleep(3600)

    def visible(self, dt_utc):
        """[(az, el)] of train satellites a naked eye could see right now."""
        if not self.sats:
            return []
        from sky_events import sun_elevation
        jd = julian(dt_utc)
        if sun_elevation(jd) > -4:
            return []
        s = sun_eci_unit(jd)
        out = []
        jd0 = math.floor(jd - 0.5) + 0.5
        for sat in self.sats:
            err, r, _ = sat.sgp4(jd0, jd - jd0)
            if err:
                continue
            along = r[0] * s[0] + r[1] * s[1] + r[2] * s[2]
            perp = math.sqrt(max(0.0, r[0] ** 2 + r[1] ** 2 + r[2] ** 2 - along * along))
            if along < 0 and perp < 6378.137:
                continue  # in Earth's shadow
            az, el = look_angles(jd, r)
            if el > 10:
                out.append((az, el))
        return out


# ---------------------------------------------------------------- comets


class Comets:
    """Any comet bright enough for the naked eye, from the Minor Planet Center's orbit file."""
    URL = "https://www.minorplanetcenter.net/iau/MPCORB/CometEls.txt"
    LIMIT_MAG = 4.5

    def __init__(self, log=print, background=True):
        self.log, self.orbits = log, []
        if background:
            threading.Thread(target=self._loop, daemon=True).start()

    def load(self):
        """Fetch and parse the Minor Planet Center's comet orbits once."""
        orbits = []
        for ln in fetch_cached(self.URL, "comets.txt", 24).splitlines():
            try:
                tp = datetime(int(ln[14:18]), int(ln[19:21]), 1, tzinfo=timezone.utc) + timedelta(days=float(ln[22:29]) - 1)
                orbits.append(dict(name=ln[102:158].strip(), tp=julian(tp), q=float(ln[30:39]),
                                   e=float(ln[41:49]), w=float(ln[51:59]), node=float(ln[61:69]),
                                   inc=float(ln[71:79]), H=float(ln[91:95]), G=float(ln[96:100])))
            except (ValueError, IndexError):
                continue
        self.orbits = orbits
        self.log(f"comets: {len(orbits)} orbits loaded")

    def _loop(self):
        while True:
            try:
                self.load()
                time.sleep(24 * 3600)
            except Exception as e:
                self.log(f"comets: fetch failed: {e}; retrying in an hour")
                time.sleep(3600)

    @staticmethod
    def helio(o, jd):
        q, e, dt = o["q"], o["e"], jd - o["tp"]
        k = 0.01720209895
        if abs(e - 1) < 1e-4:  # parabolic: Barker's equation
            W_ = 3 * k * dt / math.sqrt(2 * q ** 3)
            Y = math.copysign(abs(W_ / 2 + math.sqrt(W_ * W_ / 4 + 1)) ** (1 / 3), W_ / 2 + math.sqrt(W_ * W_ / 4 + 1))
            s = Y - 1 / Y
            nu, r = 2 * math.atan(s), q * (1 + s * s)
        elif e < 1:
            a = q / (1 - e)
            M = k * dt / a ** 1.5
            M = (M + math.pi) % (2 * math.pi) - math.pi
            E = kepler_E(M, e)
            xp, yp = a * (math.cos(E) - e), a * math.sqrt(1 - e * e) * math.sin(E)
            nu, r = math.atan2(yp, xp), math.hypot(xp, yp)
        else:
            a = q / (e - 1)
            M = k * dt / a ** 1.5
            Hh = math.asinh(M / e)
            for _ in range(50):
                d = (e * math.sinh(Hh) - Hh - M) / (e * math.cosh(Hh) - 1)
                Hh -= d
                if abs(d) < 1e-10:
                    break
            nu = 2 * math.atan(math.sqrt((e + 1) / (e - 1)) * math.tanh(Hh / 2))
            r = a * (e * math.cosh(Hh) - 1)
        return orbit_xyz(r, nu, o["w"] * RAD, o["node"] * RAD, o["inc"] * RAD), r

    def bright(self, dt_utc):
        """[(name, magnitude, az, el, tail angle on screen)] of comets brighter than LIMIT_MAG and above the horizon."""
        jd = julian(dt_utc)
        ex, ey, ez = planet_helio("earth", jd)
        out = []
        for o in self.orbits:
            try:
                (x, y, z), r = self.helio(o, jd)
            except (ValueError, OverflowError, ZeroDivisionError):
                continue
            gx, gy, gz = x - ex, y - ey, z - ez
            delta = math.sqrt(gx * gx + gy * gy + gz * gz)
            mag = o["H"] + 5 * math.log10(delta) + 2.5 * o["G"] * math.log10(r)
            if mag > self.LIMIT_MAG:
                continue
            ra, dec = vec_radec(*ecl_to_equ(gx, gy, gz))
            az, el = radec_to_azel(jd, ra, dec)
            if el < 3:
                continue
            # the tail points away from the sun: find which way that is on the sky
            ra2, dec2 = vec_radec(*ecl_to_equ(gx + x / r * 0.05 * delta, gy + y / r * 0.05 * delta,
                                              gz + z / r * 0.05 * delta))
            az2, el2 = radec_to_azel(jd, ra2, dec2)
            out.append((o["name"], mag, az, el, math.atan2(-(el2 - el), ((az2 - az + 180) % 360 - 180))))
        return out
