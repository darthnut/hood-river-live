// The Controls drawer: time of day, date and clock speed; weather and wind; easter eggs; the egg show.
import { PRESETS } from "./weather.js";
import { hoodRiverTime, localParts, skyState, MONTHS } from "./sky.js";
import { Planner } from "./show.js";

const CATS = [["wild", "Wildlife"], ["river", "On the river"], ["sky", "Sky"], ["season", "Seasons"],
  ["holiday", "Holidays"], ["odd", "Oddities"]];
const SPEEDS = [[0, "Pause"], [1, "1×"], [10, "10×"], [60, "60×"], [300, "300×"], [1200, "1200×"]];
const pad = n => String(n).padStart(2, "0");
const el = (tag, { dataset = {}, ...props } = {}, ...kids) => {
  const e = Object.assign(document.createElement(tag), props);
  Object.assign(e.dataset, dataset);
  e.append(...kids);
  return e;
};

export async function mountPanel(root, ctl, scene) {
  const meta = await (await fetch(new URL("../assets/eggs.json", import.meta.url))).json();
  const byId = Object.fromEntries(meta.map(m => [m.id, m]));
  const $ = s => root.querySelector(s);

  // ---- time
  const day = () => { const p = localParts(ctl.shown ?? ctl.now()); return [p.year, p.month, p.day]; };
  const setDayMinute = ([y, m, d], minutes) => ctl.setTime(hoodRiverTime(y, m, d, 0, 0) + minutes * 60e3);
  const slider = $("#c-tod"), date = $("#c-date");
  let dragging = false;
  slider.addEventListener("pointerdown", () => (dragging = true));
  addEventListener("pointerup", () => (dragging = false));
  slider.addEventListener("input", () => { const s = ctl.speed; setDayMinute(day(), Number(slider.value)); ctl.speed = s; sync(); });
  date.addEventListener("change", () => {
    if (!date.value) return;
    const p = localParts(ctl.now()), s = ctl.speed;
    setDayMinute(date.value.split("-").map(Number), p.hour * 60 + p.minute);
    ctl.speed = s; sync();
  });
  for (const [s, label] of SPEEDS) {
    $("#c-speed").append(el("button", { type: "button", textContent: label, dataset: { speed: s }, onclick: () => { ctl.setSpeed(s); sync(); } }));
  }
  const sunrise = ([y, m, d]) => { // first minute the sun clears the horizon
    let t = hoodRiverTime(y, m, d, 3, 0);
    while (skyState(t).elev < 0 && t < hoodRiverTime(y, m, d, 11, 0)) t += 60e3;
    return t;
  };
  const JUMPS = [
    ["Sunrise", d => sunrise(d) - 20 * 60e3], ["Morning", d => hoodRiverTime(...d, 9, 30)],
    ["Midday", d => hoodRiverTime(...d, 13, 0)], ["Sunset", d => new Planner(scene, Date.now()).sunset(d) - 25 * 60e3],
    ["Night", d => hoodRiverTime(...d, 22, 30)],
  ];
  for (const [label, f] of JUMPS) {
    $("#c-jumps").append(el("button", { type: "button", textContent: label, onclick: () => { const s = ctl.speed; ctl.setTime(f(day())); ctl.speed = s; sync(); } }));
  }

  // ---- weather and wind
  const wx = $("#c-weather");
  wx.append(el("button", { type: "button", textContent: "Live", dataset: { wx: "" }, onclick: () => { ctl.setWeather(null); sync(); } }));
  for (const name of Object.keys(PRESETS)) {
    wx.append(el("button", { type: "button", textContent: name.replace("riverfog", "river fog").replace("icestorm", "ice storm"),
      dataset: { wx: name }, onclick: () => { ctl.setWeather(name); sync(); } }));
  }
  const wind = $("#c-wind"), windLive = $("#c-wind-live");
  wind.addEventListener("input", () => { ctl.setWind(wind.value); sync(); });
  windLive.addEventListener("change", () => { ctl.setWind(windLive.checked ? null : wind.value); sync(); });

  // ---- eggs
  const list = $("#c-eggs"), search = $("#c-search"), jump = $("#c-jump"), note = $("#c-note");
  for (const [cat, label] of CATS) {
    const items = meta.filter(m => m.cat === cat).sort((a, b) => a.title.localeCompare(b.title));
    const grid = el("div", { className: "chips" });
    for (const m of items) {
      grid.append(el("button", { type: "button", className: "egg", textContent: m.title, title: m.doc, dataset: { id: m.id },
        onclick: () => {
          ctl.trigger(m.id, jump.checked);
          note.textContent = `${m.title}: ${m.doc}`;
          sync();
        } }));
    }
    list.append(el("section", { dataset: { cat } }, el("h4", { textContent: label }), grid));
  }
  search.addEventListener("input", () => {
    const q = search.value.trim().toLowerCase();
    for (const b of list.querySelectorAll(".egg")) {
      const m = byId[b.dataset.id];
      b.hidden = !!q && !`${m.title} ${m.doc} ${m.id}`.toLowerCase().includes(q);
    }
    for (const s of list.querySelectorAll("section")) s.hidden = !s.querySelector(".egg:not([hidden])");
  });
  try { jump.checked = localStorage.getItem("jump") !== "0"; } catch (e) {}
  jump.addEventListener("change", () => { try { localStorage.setItem("jump", jump.checked ? "1" : "0"); } catch (e) {} });

  // ---- egg show
  $("#c-show").onclick = () => { ctl.show ? ctl.stopShow() : ctl.startShow(); sync(); };
  $("#c-skip").onclick = () => ctl.skipShow();
  $("#c-reset").onclick = () => { ctl.goLive(); sync(); };

  // Messages from the scene, for feedback on a triggered egg.
  const onLog = m => {
    const hit = /^egg: (\S+)(?: \(([^)]*)\))? had nothing to act on/.exec(m);
    if (hit) {
      const id = hit[1], t = byId[id]?.title || byId[Object.keys(byId).find(k => k.startsWith(id + "-"))]?.title || id;
      note.textContent = `${t} has nothing to act on at this moment. Tick “Jump to a good time” and try again.`;
    }
  };

  // Keep the readouts in step with the clock.
  function sync() {
    const now = ctl.shown ?? ctl.now(), p = localParts(now);
    if (!dragging) slider.value = p.hour * 60 + p.minute;
    $("#c-clock").textContent = `${p.weekdayName} ${MONTHS[p.month - 1][0]}${MONTHS[p.month - 1].slice(1).toLowerCase()} ${p.day}, ${p.year} · ${pad(p.hour)}:${pad(p.minute)}`;
    if (document.activeElement !== date) date.value = `${p.year}-${pad(p.month)}-${pad(p.day)}`;
    for (const b of root.querySelectorAll("[data-speed]")) b.setAttribute("aria-pressed", !ctl.live && !ctl.show && Number(b.dataset.speed) === ctl.speed);
    for (const b of root.querySelectorAll("[data-wx]")) b.setAttribute("aria-pressed", (b.dataset.wx || null) === ctl.weather);
    windLive.checked = ctl.windMph === null;
    if (ctl.windMph !== null) wind.value = ctl.windMph;
    else if (document.activeElement !== wind) wind.value = Math.round(ctl.wind.speed);
    $("#c-wind-val").textContent = `${Math.round(ctl.wind.speed)} mph${ctl.windMph === null ? " (live)" : ""}`;
    $("#c-show").textContent = ctl.show ? "Stop the show" : "Start the egg show";
    $("#c-show").setAttribute("aria-pressed", !!ctl.show);
    $("#c-skip").hidden = !ctl.show;
    const s = ctl.show;
    $("#c-show-now").textContent = s ? `${s.i + 1} of ${s.program.length}: ${(byId[s.name] || byId[s.base] || { title: s.name }).title}` : "";
    const mode = document.getElementById("mode");
    mode.hidden = !ctl.custom;
    mode.textContent = ctl.show ? "Egg show · back to live" : `${ctl.live ? "Live time" : ctl.speed === 0 ? "Paused" : ctl.speed === 1 ? "Time travel" : `${ctl.speed}× time`} · back to live`;
    $("#c-reset").disabled = !ctl.custom;
  }
  setInterval(sync, 250);
  sync();
  return { onLog, sync };
}
