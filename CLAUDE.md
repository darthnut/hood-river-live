# gorge-live (Hood River Live)

Browser (ES module) port of the LED panel's Hood River scene, live at https://darthnut.github.io/hood-river-live/. README.md covers the layout, URL test params and dev tools.

## Run
- Preview config `gorge-live` in `Projects\.claude\launch.json`: `tools/serve.py 5191`, then http://127.0.0.1:5191/. Use serve.py, not `python -m http.server`; plain http.server served stale JS modules and hid a fix.
- Review visuals with `node tools/moments.mjs out.png "egg@HH:MM@age"` (a contact sheet). Preview-pane screenshots shrink to thumbnails. `node tools/soak.mjs` is the error and frame-time soak.

## Git / publishing
- Public repo github.com/darthnut/hood-river-live, branch `main`. Pushing to main redeploys GitHub Pages.
- Commit only as the noreply address already set in this repo's git config. Never use the user's Gmail; the repo is public.
- `.github/workflows/sky.yml` commits `assets/sky.json` daily, so `git pull --rebase` before pushing.
- Nothing from the private `led-matrix` repo (WiFi backup, birthdays) may land here.

## Keeping in sync with the board (`..\led-matrix`)
- `assets/scene.json` is exported by `led-matrix/tools/export_web.py`. Re-export after changing town.py/gorge.py generation; don't regenerate the layout in JS.
- `src/eggs1..5.js` mirror `eggs.py`, `eggs_more.py`, `_more2`, `_more3` and `_more4`. Port egg changes to the matching file and add titles to `assets/eggs.json`.
- `tools/sky/` holds copies of the board's `sky_events.py`/`sky_more.py`. Re-copy them if those change.

## Gotchas
- Scene time t = seconds since 2026-01-01 UTC, so all visitors match. The clock always uses America/Los_Angeles.
- The frame is 256x96; the board is 256x64 (tools/board.mjs sets GORGE_TOP=0 for the Pi board: keep TOP-dependent code working at TOP=0). The scene and eggs draw in board coords on the bottom 64 rows. Write pixels only through the `src/pix.js` helpers or `getFull()`/`getView()`.
- The Pi board is now 2x2 panels, 128x128: `tools/board.mjs --square` sets `globalThis.GORGE_GEOM = { square: true }` before the modules load (W=128, H=128, HORIZON=84, TOP=0) and loads `assets/scene_square.json`, built by `node tools/square_layout.mjs` (JS, board-only; the website never loads it). Fixed positions written for 256x64 go through `rx()`/`ry()` from `src/pix.js` (identity on the website); `wdepth(y)` is the river's 0..1 depth scale. New egg or scene coordinates must use them, then check with `node tools/moments.mjs --square out.png ...`. Website and 256x64 renders were byte-identical after the port.
- `?wind=` creates a fixed test-wind object. Don't mutate LiveWind; its poll overwrites it.
- Egg show PROGRAM times must stay ascending in time of day.
- Don't put a `// comment` mid-line on one-line class-field declarations in egg files. That once silently disabled the ISS egg's settings.
