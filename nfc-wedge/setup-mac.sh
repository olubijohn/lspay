#!/bin/bash
# ============================================================
#  LSPay NFC Wedge — Mac One-Time Setup
#  Run this ONCE. The wedge will auto-start on every login.
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WEDGE_SCRIPT="$SCRIPT_DIR/nfc_wedge.py"
PLIST_ID="com.lspay.nfcwedge"
PLIST_PATH="$HOME/Library/LaunchAgents/$PLIST_ID.plist"
PYTHON_BIN="$(which python3)"

echo ""
echo "=============================================="
echo "  LSPay NFC Wedge — Mac One-Time Setup"
echo "=============================================="
echo ""

# ── Check Python 3 ─────────────────────────────────────────
if [ -z "$PYTHON_BIN" ]; then
    echo "ERROR: Python 3 not found."
    echo "Install from: https://www.python.org/downloads/"
    exit 1
fi
echo "✓ Python 3: $PYTHON_BIN"

# ── Install Python packages ─────────────────────────────────
echo ""
echo "Installing Python package (pyscard)..."
pip3 install --quiet pyscard
echo "✓ Package installed"

# ── Create launchd plist ────────────────────────────────────
echo ""
echo "Registering NFC wedge as a login service (launchd)..."

mkdir -p "$HOME/Library/LaunchAgents"

cat > "$PLIST_PATH" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$PLIST_ID</string>

  <key>ProgramArguments</key>
  <array>
    <string>$PYTHON_BIN</string>
    <string>$WEDGE_SCRIPT</string>
  </array>

  <!-- Auto-start on every login -->
  <key>RunAtLoad</key>
  <true/>

  <!-- Restart automatically if it ever crashes -->
  <key>KeepAlive</key>
  <true/>

  <!-- Run silently — logs go to files, not a terminal window -->
  <key>StandardOutPath</key>
  <string>$HOME/Library/Logs/lspay-nfc-wedge.log</string>

  <key>StandardErrorPath</key>
  <string>$HOME/Library/Logs/lspay-nfc-wedge-error.log</string>
</dict>
</plist>
EOF

echo "✓ Plist written to: $PLIST_PATH"

# ── Unload any old version and load fresh ──────────────────
launchctl unload "$PLIST_PATH" 2>/dev/null || true
launchctl load -w "$PLIST_PATH"
echo "✓ Service loaded and started"

echo ""
echo "=============================================="
echo "  ✅  SETUP COMPLETE"
echo "=============================================="
echo ""
echo "  The NFC wedge is now running in the background."
echo "  It will auto-start on every login — no action needed."
echo ""
echo "  To check it's running:"
echo "    launchctl list | grep lspay"
echo ""
echo "  To view logs:"
echo "    tail -f ~/Library/Logs/lspay-nfc-wedge.log"
echo ""
echo "  To uninstall (stop + remove from startup):"
echo "    launchctl unload ~/Library/LaunchAgents/$PLIST_ID.plist"
echo "    rm ~/Library/LaunchAgents/$PLIST_ID.plist"
echo ""
