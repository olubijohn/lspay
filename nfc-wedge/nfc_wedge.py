#!/usr/bin/env python3
"""
LSPay NFC Keyboard Wedge — Universal, Cross-platform
=====================================================
Works with ANY USB NFC / RFID card reader that supports PC/SC.

Compatible readers include (but are not limited to):
  • ACS ACR122U, ACR1251U, ACR1252U, ACR1281U
  • HID OMNIKEY 5022, 5025, 5027, 5427
  • Identiv uTrust 3700F, 3701F, 4701F
  • Feitian R502, bR500
  • SCM SCR335, SCR3310, SCR3500
  • Cherry TC-series, Gemalto PC Twin, Alcor Micro AU9540
  • Generic / cheap USB NFC readers from Amazon/AliExpress
  • Virtually ANY reader advertised as "ISO 14443" or "PC/SC"

Card types supported:
  • MIFARE Classic (1K, 4K)
  • MIFARE Ultralight / Ultralight C
  • MIFARE DESFire
  • NTAG 213 / 215 / 216
  • ISO 14443-A / -B cards
  • FeliCa (Sony)
  • Most NFC Forum Type 1–4 tags

INSTALL ONCE:
  Mac:              pip3 install pyscard   (pyautogui NOT needed on Mac)
  Windows / Linux:  pip install pyscard pyautogui

RUN:
  python nfc_wedge.py          (uses first reader found)
  python nfc_wedge.py --all    (monitors ALL connected readers simultaneously)
"""

import time
import sys
import datetime
import argparse
import threading

# ── Dependency checks ─────────────────────────────────────────────────────────
try:
    from smartcard.System import readers as get_readers
    from smartcard.Exceptions import CardConnectionException, NoReadersException
except ImportError:
    print("ERROR: pyscard not installed.")
    print("  Mac:            pip3 install pyscard")
    print("  Windows/Linux:  pip install pyscard")
    sys.exit(1)

# On Mac we use osascript (AppleScript) — no pyautogui needed.
# pyautogui pulls in pyobjc-core on Mac which requires a C compiler.
_IS_MAC = sys.platform == "darwin"

if not _IS_MAC:
    try:
        import pyautogui
        pyautogui.FAILSAFE = False
    except ImportError:
        print("ERROR: pyautogui not installed.")
        print("  Run: pip install pyautogui")
        sys.exit(1)

# ── Standard universal GET UID APDU ──────────────────────────────────────────
# This command works on virtually ALL ISO 14443 / NFC PC/SC readers.
GET_UID_APDU = [0xFF, 0xCA, 0x00, 0x00, 0x00]

# How long (seconds) to wait after the same card is scanned before scanning again
DEBOUNCE_SECONDS = 0.5

# How often (seconds) to poll for a card
POLL_INTERVAL_WITH_CARD    = 0.3
POLL_INTERVAL_WITHOUT_CARD = 0.2
POLL_INTERVAL_NO_READER    = 2.0


def log(msg, prefix=""):
    ts = datetime.datetime.now().strftime("%H:%M:%S")
    print(f"[{ts}]{' ' + prefix if prefix else ''} {msg}", flush=True)


def get_uid_from_reader(reader) -> str | None:
    """
    Connect to whatever card is on `reader` and return its UID as an
    uppercase hex string (e.g. '04A3F21B'). Returns None if no card
    is present or the reader can't be reached.
    Works with every reader that supports the ISO 14443 GET UID APDU.
    """
    try:
        conn = reader.createConnection()
        conn.connect()
        data, sw1, sw2 = conn.transmit(GET_UID_APDU)
        conn.disconnect()
        if sw1 == 0x90 and sw2 == 0x00 and data:
            return "".join(f"{b:02X}" for b in data)
    except Exception:
        pass
    return None


def type_uid(uid: str):
    """Simulate keyboard: type the UID then press Enter into the focused app."""
    time.sleep(0.05)  # small pause to ensure browser field has focus

    if _IS_MAC:
        # AppleScript via osascript — built into every Mac, no packages needed.
        # Requires Accessibility permission for Terminal / Python (asked once by macOS).
        import subprocess
        # Escape any characters that could break the AppleScript string
        safe_uid = uid.replace('"', '').replace('\\', '')
        script = (
            f'tell application "System Events"\n'
            f'    keystroke "{safe_uid}"\n'
            f'    key code 36\n'          # key code 36 = Return/Enter
            f'end tell'
        )
        subprocess.run(["osascript", "-e", script], check=False)
    else:
        pyautogui.typewrite(uid, interval=0.012)
        pyautogui.press("enter")


def monitor_reader(reader, label: str = ""):
    """
    Poll a single reader in a loop. When a new card is detected, type its UID.
    Runs forever until interrupted.
    """
    tag = f"[{label}] " if label else ""
    last_uid = None

    log(f"Monitoring: {reader}", prefix=label)
    log("Waiting for card tap...", prefix=label)

    while True:
        uid = get_uid_from_reader(reader)

        if uid and uid != last_uid:
            log(f"Card UID: {uid}", prefix=label)
            type_uid(uid)
            last_uid = uid
            time.sleep(DEBOUNCE_SECONDS)

        elif not uid:
            last_uid = None           # card removed — reset for next tap
            time.sleep(POLL_INTERVAL_WITHOUT_CARD)

        else:
            time.sleep(POLL_INTERVAL_WITH_CARD)


def run_single():
    """
    Monitor the first reader found. If it disconnects, wait and reconnect
    automatically. New readers plugged in after startup are detected.
    """
    current_reader = None

    while True:
        try:
            reader_list = get_readers()

            if not reader_list:
                if current_reader is not None:
                    log("Reader disconnected. Waiting for any reader...")
                    current_reader = None
                time.sleep(POLL_INTERVAL_NO_READER)
                continue

            # Pick the first available reader (works for any brand/model)
            reader = reader_list[0]

            if str(reader) != str(current_reader):
                current_reader = reader
                log(f"Reader detected: {reader}")

            uid = get_uid_from_reader(current_reader)

            if uid:
                # Use a local last-uid variable
                pass  # handled in inner loop below

        except Exception as e:
            log(f"Error: {e}")
            current_reader = None
            time.sleep(POLL_INTERVAL_NO_READER)
            continue

        # Inner loop: keep polling the current reader
        last_uid = None
        log(f"Ready — tap any card on: {current_reader}")

        while True:
            try:
                # Check if reader is still the first one available
                reader_list = get_readers()
                if not reader_list or str(reader_list[0]) != str(current_reader):
                    log("Reader changed or disconnected.")
                    current_reader = None
                    last_uid = None
                    break

                uid = get_uid_from_reader(current_reader)

                if uid and uid != last_uid:
                    log(f"✓ Card UID: {uid}")
                    type_uid(uid)
                    last_uid = uid
                    time.sleep(DEBOUNCE_SECONDS)

                elif not uid:
                    last_uid = None
                    time.sleep(POLL_INTERVAL_WITHOUT_CARD)

                else:
                    time.sleep(POLL_INTERVAL_WITH_CARD)

            except KeyboardInterrupt:
                raise
            except Exception as e:
                log(f"Read error: {e}")
                current_reader = None
                break


def run_all():
    """
    Monitor ALL connected readers simultaneously (one thread per reader).
    Useful when multiple readers are plugged in at once.
    New readers added after startup are detected on next scan cycle.
    """
    active_readers: dict[str, threading.Thread] = {}

    log("Monitoring ALL readers simultaneously.")
    log("Plug in as many readers as needed.")

    while True:
        try:
            reader_list = get_readers()
            current_keys = {str(r): r for r in reader_list}

            # Start threads for any new readers
            for key, reader in current_keys.items():
                if key not in active_readers or not active_readers[key].is_alive():
                    t = threading.Thread(
                        target=monitor_reader,
                        args=(reader, key[:30]),   # label = first 30 chars of reader name
                        daemon=True,
                    )
                    t.start()
                    active_readers[key] = t

            # Clean up dead threads for disconnected readers
            gone = [k for k in active_readers if k not in current_keys]
            for k in gone:
                log(f"Reader removed: {k}")
                del active_readers[k]

            if not reader_list:
                log("No readers found. Waiting...")

        except KeyboardInterrupt:
            raise
        except Exception as e:
            log(f"Error scanning readers: {e}")

        time.sleep(POLL_INTERVAL_NO_READER)


# ── Entry point ───────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(
        description="LSPay NFC Keyboard Wedge — Universal, Cross-platform"
    )
    parser.add_argument(
        "--all", action="store_true",
        help="Monitor ALL connected readers at once (default: first reader only)"
    )
    args = parser.parse_args()

    print()
    print("=" * 55)
    print("  LSPay NFC Keyboard Wedge  —  Universal Edition")
    print("=" * 55)
    print("  Works with ANY USB NFC/RFID reader (PC/SC)")
    print("  Tap a card → UID typed + Enter into browser")
    print("  Press Ctrl+C to stop")
    print()

    try:
        if args.all:
            run_all()
        else:
            run_single()
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
