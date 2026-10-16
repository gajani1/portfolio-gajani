// Parsers for the standard Bluetooth SIG weight characteristics.
// Both return { kg, raw } or null. Works in the browser and in Node (for tests).

const KG_RES = 0.005; // SI resolution, kg
const LB_RES = 0.01;  // imperial resolution, lb
const LB_TO_KG = 0.45359237;

// Weight Measurement characteristic (0x2A9D), Weight Scale Service (0x181D)
function parseWeightMeasurement(dataView) {
  if (dataView.byteLength < 3) return null;
  const flags = dataView.getUint8(0);
  const imperial = (flags & 0x01) !== 0;
  const raw = dataView.getUint16(1, true);
  if (raw === 0xffff) return null; // "measurement unsuccessful"
  const kg = imperial ? raw * LB_RES * LB_TO_KG : raw * KG_RES;
  return { kg, raw };
}

// Body Composition Measurement characteristic (0x2A9C), Body Composition Service (0x181B)
function parseBodyComposition(dataView) {
  if (dataView.byteLength < 4) return null;
  const flags = dataView.getUint16(0, true);
  const imperial = (flags & 0x0001) !== 0;
  let offset = 4; // flags (2) + body fat percentage (2)
  if (flags & 0x0002) offset += 7; // time stamp
  if (flags & 0x0004) offset += 1; // user id
  for (let bit = 3; bit <= 9; bit++) {
    if (flags & (1 << bit)) offset += 2; // BMR, muscle %, muscle mass, fat-free, lean, water, impedance
  }
  if (!(flags & 0x0400) || dataView.byteLength < offset + 2) return null; // no weight field
  const raw = dataView.getUint16(offset, true);
  if (raw === 0xffff) return null;
  const kg = imperial ? raw * LB_RES * LB_TO_KG : raw * KG_RES;
  return { kg, raw };
}

if (typeof module !== "undefined") {
  module.exports = { parseWeightMeasurement, parseBodyComposition };
}
