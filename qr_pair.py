#!/usr/bin/env python3

import subprocess
import sys
import threading
from random import randint

import qrcode
from zeroconf import IPVersion, ServiceBrowser, ServiceInfo, ServiceListener, Zeroconf

TYPE = "_adb-tls-pairing._tcp.local."
NAME = "popdroidcam"
PASSWORD = randint(100000, 999999)
QR_FORMAT = f"WIFI:T:ADB;S:{NAME};P:{PASSWORD};;"


class ADBPairingListener(ServiceListener):
    def __init__(self, done_event: threading.Event):
        self.paired = False
        self.device_ip = None
        self.device_port = None
        self.done_event = done_event

    def remove_service(self, zc: Zeroconf, type_: str, name: str) -> None:
        pass

    def add_service(self, zc: Zeroconf, type_: str, name: str) -> None:
        info = zc.get_service_info(type_, name)
        if not info:
            return
        self.pair(info)

    def update_service(self, zc: Zeroconf, type_: str, name: str) -> None:
        pass

    def pair(self, info: ServiceInfo) -> None:
        addresses = info.ip_addresses_by_version(IPVersion.V4Only)
        if not addresses:
            addresses = info.ip_addresses_by_version(IPVersion.All)
        if not addresses:
            print("\033[91m✗ Could not get device IP\033[0m")
            return

        ip = addresses[0].exploded
        port = info.port

        print(f"\n\033[96mDevice found: {ip}:{port}\033[0m")
        print(f"\033[96mPairing...\033[0m")

        result = subprocess.run(
            ["adb", "pair", f"{ip}:{port}", str(PASSWORD)],
            capture_output=True,
            text=True
        )

        output = result.stdout + result.stderr
        if "success" in output.lower() or "paired" in output.lower():
            print(f"\033[92m✓ Successfully paired with {ip}:{port}\033[0m")
            self.paired = True
            self.device_ip = ip
        else:
            print(f"\033[91m✗ Pairing failed: {output}\033[0m")
        
        self.done_event.set()


def print_qr_terminal(data: str) -> None:
    qr = qrcode.QRCode(border=2)
    qr.add_data(data)
    qr.make(fit=True)
    qr.print_ascii(invert=True)


def main():
    print("\033[1m=== PopDroidCam QR Pairing ===\033[0m\n")
    print("Scan this QR code with your phone:\n")
    print("  Phone → Settings → Developer Options → Wireless debugging")
    print("  → Pair device with QR code\n")

    print_qr_terminal(QR_FORMAT)

    print(f"\n\033[93mWaiting for device to scan QR code...\033[0m")
    print("(Press Ctrl+C to cancel)\n")

    done_event = threading.Event()
    zeroconf = Zeroconf()
    listener = ADBPairingListener(done_event)

    try:
        ServiceBrowser(zeroconf, TYPE, listener)
        done_event.wait()
    except KeyboardInterrupt:
        print("\n\033[93mCancelled.\033[0m")
    finally:
        zeroconf.close()

    if listener.paired and listener.device_ip:
        print(f"\n\033[92mPairing complete!\033[0m")
        print(f"\nNow connect with:")
        print(f"  \033[96mpopdroidcam connect {listener.device_ip} <port>\033[0m")
        print(f"\n(Get the port from Wireless debugging screen on phone)")
        return 0
    return 1


if __name__ == "__main__":
    sys.exit(main())
