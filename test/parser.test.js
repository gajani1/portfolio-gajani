const assert = require("assert");
const { parseWeightMeasurement, parseBodyComposition } = require("../js/parser.js");

const dv = (bytes) => new DataView(Uint8Array.from(bytes).buffer);
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);

// 70.00 kg in SI: 70 / 0.005 = 14000 = 0x36B0
near(parseWeightMeasurement(dv([0x00, 0xb0, 0x36])).kg, 70);
// 150.00 lb imperial: 15000 = 0x3A98
near(parseWeightMeasurement(dv([0x01, 0x98, 0x3a])).kg, 150 * 0.45359237);
// with timestamp flag, weight still at offset 1
near(parseWeightMeasurement(dv([0x02, 0xb0, 0x36, 0xe8, 0x07, 1, 1, 0, 0, 0])).kg, 70);
// unsuccessful measurement
assert.strictEqual(parseWeightMeasurement(dv([0x00, 0xff, 0xff])), null);
assert.strictEqual(parseWeightMeasurement(dv([0x00])), null);

// Body composition: flags = weight present (bit10) + impedance (bit9)
// fat% 0x00C8, impedance 0x01F4, weight 14000
near(parseBodyComposition(dv([0x00, 0x06, 0xc8, 0x00, 0xf4, 0x01, 0xb0, 0x36])).kg, 70);
// without weight flag
assert.strictEqual(parseBodyComposition(dv([0x00, 0x00, 0xc8, 0x00])), null);

console.log("all parser tests passed");
