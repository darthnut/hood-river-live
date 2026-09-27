# Hood River Live

Hood River, Oregon, as live pixel art: the view south across the Columbia from the Washington shore,
with the Hood River Bridge, the town and Mt. Hood. The sun, moon and weather follow what's really
happening in Hood River, and it all runs in the visitor's browser.

This is a browser port of the scene on a 256×64 LED panel (the private `led-matrix` project). The
static layout in `assets/scene.json` is exported from that project's renderer
(`tools/export_web.py`), so both show exactly the same town.

## Run it locally

Any static file server works (ES modules don't load from `file://`):

```bash
python -m http.server 5190 --directory gorge-live
```

Then open http://127.0.0.1:5190/. For testing, the page takes URL parameters:
`?at=HH:MM`, `?date=YYYY-MM-DD`, `?speed=60` (a time-lapse), `?weather=rain` (any preset in
`src/weather.js`), `?wind=25` (a steady test wind instead of the live reading).

## Layout

- `src/scene.js` — the scene: sky, sun and moon, Mt. Hood, the town, the river, the bridge, the riders.
- `src/weather.js` — live Open-Meteo readings, weather presets and every weather effect.
- `src/sky.js` — the real sun and moon, time-of-day palettes, Hood River local time.
- `src/eggs.js` — the easter-egg framework (the eggs themselves are being ported).
- `src/pix.js`, `src/rng.js` — drawing helpers and a seeded random generator.
