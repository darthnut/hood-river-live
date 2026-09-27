// Print the browser's sky math for a few known moments, to compare with the board's Python.
import * as m from "../src/skycalc.js";

const t = s => Date.parse(s);
const iso = ms => new Date(ms).toISOString();
for (const [y, mo, d] of [[2017, 8, 21], [2029, 1, 14]]) {
  const e = m.solarEclipseOn(y, mo, d);
  console.log(`eclipse ${y}-${mo}-${d}`, iso(e.max), e.magnitude.toFixed(3));
}
console.log("planets", m.planets(t("2026-09-26T16:00Z")).map(p => `${p[0]} ${p[1].toFixed(1)} ${p[2].toFixed(1)}`).join(" | "));
console.log("pairs", JSON.stringify(m.moonPlanetPairs(t("2023-03-24T12:00Z"), 6)));
console.log("shower", JSON.stringify(m.activeShower(t("2026-08-13T06:00Z"))));
