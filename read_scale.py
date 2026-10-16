"""Read the weight (kg) from a Bluetooth weigh scale and print it.

Usage:
    pip install bleak
    python read_scale.py            # find the scale, step on it, prints the stable weight
    python read_scale.py --timeout 60

Works with scales that use the standard Bluetooth Weight Scale (0x181D)
or Body Composition (0x181B) service.
"""

import argparse
import asyncio
import struct
import sys

WEIGHT_SERVICE = "0000181d-0000-1000-8000-00805f9b34fb"
WEIGHT_CHAR = "00002a9d-0000-1000-8000-00805f9b34fb"
BODY_SERVICE = "0000181b-0000-1000-8000-00805f9b34fb"
BODY_CHAR = "00002a9c-0000-1000-8000-00805f9b34fb"

KG_RES = 0.005
LB_RES = 0.01
LB_TO_KG = 0.45359237
STABLE_COUNT = 4
STABLE_TOLERANCE = 0.05  # kg


def to_kg(raw, imperial):
    return raw * LB_RES * LB_TO_KG if imperial else raw * KG_RES


def parse_weight_measurement(data):
    """Weight Measurement characteristic (0x2A9D)."""
    if len(data) < 3:
        return None
    flags = data[0]
    raw = struct.unpack_from("<H", data, 1)[0]
    if raw == 0xFFFF:
        return None
    return to_kg(raw, flags & 0x01)


def parse_body_composition(data):
    """Body Composition Measurement characteristic (0x2A9C)."""
    if len(data) < 4:
        return None
    flags = struct.unpack_from("<H", data, 0)[0]
    offset = 4  # flags + body fat percentage
    if flags & 0x0002:
        offset += 7  # time stamp
    if flags & 0x0004:
        offset += 1  # user id
    for bit in range(3, 10):
        if flags & (1 << bit):
            offset += 2
    if not flags & 0x0400 or len(data) < offset + 2:
        return None
    raw = struct.unpack_from("<H", data, offset)[0]
    if raw == 0xFFFF:
        return None
    return to_kg(raw, flags & 0x0001)


async def find_scale(scan_seconds):
    from bleak import BleakScanner

    print(f"Scanning for a Bluetooth scale ({scan_seconds}s)... wake the scale by stepping on it.")
    devices = await BleakScanner.discover(timeout=scan_seconds, return_adv=True)
    for device, adv in devices.values():
        uuids = [u.lower() for u in adv.service_uuids]
        if WEIGHT_SERVICE in uuids or BODY_SERVICE in uuids:
            return device
    return None


async def read_weight(timeout):
    from bleak import BleakClient

    device = await find_scale(10)
    if device is None:
        print("No standard Bluetooth scale found. Make sure it is awake and not connected to its phone app.")
        return None

    print(f"Connecting to {device.name or device.address}...")
    recent = []
    done = asyncio.Event()

    def on_value(parser):
        def handler(_, data):
            kg = parser(bytes(data))
            if kg is None:
                return
            print(f"  {kg:.2f} kg")
            recent.append(kg)
            del recent[:-STABLE_COUNT]
            if len(recent) == STABLE_COUNT and max(recent) - min(recent) <= STABLE_TOLERANCE:
                done.set()
        return handler

    async with BleakClient(device) as client:
        chars = {c.uuid.lower() for s in client.services for c in s.characteristics}
        subscribed = False
        if WEIGHT_CHAR in chars:
            await client.start_notify(WEIGHT_CHAR, on_value(parse_weight_measurement))
            subscribed = True
        if BODY_CHAR in chars:
            await client.start_notify(BODY_CHAR, on_value(parse_body_composition))
            subscribed = True
        if not subscribed:
            print("This scale has no standard weight characteristic.")
            return None

        print("Connected. Step on the scale.")
        try:
            await asyncio.wait_for(done.wait(), timeout)
        except asyncio.TimeoutError:
            pass

    return recent[-1] if recent else None


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--timeout", type=int, default=45, help="seconds to wait for a stable reading")
    args = parser.parse_args()

    kg = asyncio.run(read_weight(args.timeout))
    if kg is None:
        print("No reading received.")
        sys.exit(1)
    print(f"\nWeight: {kg:.2f} kg")


if __name__ == "__main__":
    main()
