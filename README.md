# Weigh Scale Project

A small web app that connects to a Bluetooth weigh scale and shows the weight live.

## Features

- Connects to scales that use the standard Bluetooth **Weight Scale** (0x181D) or
  **Body Composition** (0x181B) service
- Live reading with a "Stable" indicator once the value settles
- kg / lb toggle
- Save readings (kept in your browser only)
- Demo mode with a simulated scale, for trying it without hardware

## Running it

Web Bluetooth only works in **Chrome or Edge** (desktop or Android) and only over
**HTTPS or localhost**. It does not work in Safari or on iPhone.

Locally:

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

Or publish with GitHub Pages (Settings → Pages → deploy from branch) and open the HTTPS URL.

Then click **Connect scale**, pick your scale in the browser dialog, and step on it.

## Tests

```sh
node test/parser.test.js
```

## Scales with their own protocol

Some scales (for example Xiaomi Mi Scale or many unbranded models) don't use the standard
service. They won't appear in the device list. Supporting one needs its make and model so
its data format can be added to `js/parser.js`.
