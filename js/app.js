/* global parseWeightMeasurement, parseBodyComposition */

const WEIGHT_SERVICE = 0x181d;
const WEIGHT_CHAR = 0x2a9d;
const BODY_SERVICE = 0x181b;
const BODY_CHAR = 0x2a9c;
const KG_TO_LB = 2.20462262;
const STABLE_COUNT = 4;      // identical readings in a row to call it stable
const STABLE_TOLERANCE = 0.05; // kg
const HISTORY_KEY = "weigh-scale-history";
const UNIT_KEY = "weigh-scale-unit";

const $ = (id) => document.getElementById(id);
const els = {
  support: $("support"),
  connect: $("connect"),
  disconnect: $("disconnect"),
  demo: $("demo"),
  status: $("status"),
  device: $("device"),
  value: $("value"),
  unit: $("unit"),
  stable: $("stable"),
  save: $("save"),
  unitToggle: $("unit-toggle"),
  history: $("history"),
  clear: $("clear"),
};

let device = null;
let demoTimer = null;
let unit = load(UNIT_KEY, "kg");
let lastKg = null;
let recent = [];
let history = load(HISTORY_KEY, []);

function load(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}

function store(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: keep in memory only */
  }
}

function fmt(kg) {
  return unit === "kg" ? kg.toFixed(2) : (kg * KG_TO_LB).toFixed(1);
}

function setStatus(text, state) {
  els.status.textContent = text;
  els.status.dataset.state = state;
}

function setConnected(on, name) {
  els.connect.hidden = on;
  els.demo.hidden = on;
  els.disconnect.hidden = !on;
  els.device.textContent = on ? name : "No scale connected";
}

function render() {
  els.unit.textContent = unit;
  els.unitToggle.textContent = unit === "kg" ? "Show lb" : "Show kg";
  els.value.textContent = lastKg === null ? "--.--" : fmt(lastKg);
  els.save.disabled = lastKg === null;
  els.history.innerHTML = "";
  if (history.length === 0) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "No saved readings yet.";
    els.history.appendChild(li);
  }
  for (const entry of history) {
    const li = document.createElement("li");
    const w = document.createElement("strong");
    w.textContent = `${fmt(entry.kg)} ${unit}`;
    const t = document.createElement("span");
    t.textContent = new Date(entry.at).toLocaleString();
    li.append(w, t);
    els.history.appendChild(li);
  }
  els.clear.hidden = history.length === 0;
}

function onReading(kg) {
  lastKg = kg;
  recent.push(kg);
  if (recent.length > STABLE_COUNT) recent.shift();
  const stable =
    recent.length === STABLE_COUNT &&
    Math.max(...recent) - Math.min(...recent) <= STABLE_TOLERANCE;
  els.stable.textContent = stable ? "Stable" : "Measuring…";
  els.stable.dataset.stable = stable;
  render();
}

function handleNotification(parser) {
  return (event) => {
    const result = parser(event.target.value);
    if (result) onReading(result.kg);
  };
}

async function subscribe(server, serviceId, charId, parser) {
  try {
    const service = await server.getPrimaryService(serviceId);
    const ch = await service.getCharacteristic(charId);
    ch.addEventListener("characteristicvaluechanged", handleNotification(parser));
    await ch.startNotifications(); // indications are handled the same way
    return true;
  } catch {
    return false;
  }
}

async function connect() {
  try {
    setStatus("Choose your scale in the browser dialog…", "busy");
    device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [WEIGHT_SERVICE] }, { services: [BODY_SERVICE] }],
      optionalServices: [WEIGHT_SERVICE, BODY_SERVICE],
    });
    device.addEventListener("gattserverdisconnected", onDisconnected);
    setStatus(`Connecting to ${device.name || "scale"}…`, "busy");
    const server = await device.gatt.connect();
    const a = await subscribe(server, WEIGHT_SERVICE, WEIGHT_CHAR, parseWeightMeasurement);
    const b = await subscribe(server, BODY_SERVICE, BODY_CHAR, parseBodyComposition);
    if (!a && !b) throw new Error("This scale does not expose a standard weight characteristic.");
    setConnected(true, device.name || "Bluetooth scale");
    setStatus("Connected. Step on the scale.", "ok");
  } catch (err) {
    if (device?.gatt?.connected) device.gatt.disconnect();
    device = null;
    setConnected(false);
    setStatus(err.name === "NotFoundError" ? "No scale selected." : err.message, "error");
  }
}

function onDisconnected() {
  setConnected(false);
  setStatus("Scale disconnected.", "idle");
  device = null;
}

function disconnect() {
  if (demoTimer) {
    clearInterval(demoTimer);
    demoTimer = null;
    setConnected(false);
    setStatus("Demo stopped.", "idle");
    return;
  }
  if (device?.gatt?.connected) device.gatt.disconnect();
}

// Simulated scale so the app can be tried without hardware.
function startDemo() {
  const target = 55 + Math.random() * 30;
  let current = 0;
  recent = [];
  setConnected(true, "Demo scale (simulated)");
  setStatus("Demo mode: simulated readings.", "ok");
  demoTimer = setInterval(() => {
    current += (target - current) * 0.5;
    const noise = Math.abs(target - current) > 0.1 ? (Math.random() - 0.5) * 0.4 : 0;
    onReading(Math.round((current + noise) / 0.005) * 0.005);
  }, 400);
}

function saveReading() {
  if (lastKg === null) return;
  history.unshift({ kg: lastKg, at: Date.now() });
  history = history.slice(0, 50);
  store(HISTORY_KEY, history);
  render();
}

function init() {
  if (!("bluetooth" in navigator)) {
    els.support.hidden = false;
    els.connect.disabled = true;
  }
  els.connect.addEventListener("click", connect);
  els.disconnect.addEventListener("click", disconnect);
  els.demo.addEventListener("click", startDemo);
  els.save.addEventListener("click", saveReading);
  els.unitToggle.addEventListener("click", () => {
    unit = unit === "kg" ? "lb" : "kg";
    store(UNIT_KEY, unit);
    render();
  });
  els.clear.addEventListener("click", () => {
    history = [];
    store(HISTORY_KEY, history);
    render();
  });
  setConnected(false);
  setStatus("Not connected.", "idle");
  render();
}

init();
