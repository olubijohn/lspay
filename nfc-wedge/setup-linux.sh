#!/bin/bash
# ============================================================
#  LSPay NFC Wedge — Linux One-Time Setup (systemd)
#  Run this ONCE. The wedge will auto-start on every login.
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WEDGE_SCRIPT="$SCRIPT_DIR/nfc_wedge.py"
SERVICE_NAME="lspay-nfc-wedge"
SERVICE_DIR="$HOME/.config/systemd/user"
SERVICE_FILE="$SERVICE_DIR/$SERVICE_NAME.service"
PYTHON_BIN="$(which python3)"

echo ""
echo "=============================================="
echo "  LSPay NFC Wedge — Linux One-Time Setup"
echo "=============================================="
echo ""

# ── Check Python ────────────────────────────────────────────
if [ -z "$PYTHON_BIN" ]; then
    echo "ERROR: Python 3 not found. Install with:"
    echo "  sudo apt install python3 python3-pip    # Debian/Ubuntu"
    echo "  sudo dnf install python3                # Fedora"
    exit 1
fi
echo "✓ Python 3: $PYTHON_BIN"

# ── Install pcscd (PC/SC daemon) ────────────────────────────
if ! command -v pcscd &>/dev/null; then
    echo ""
    echo "Installing PC/SC daemon (required for NFC readers)..."
    sudo apt-get install -y pcscd libpcsclite-dev 2>/dev/null || \
    sudo dnf install -y pcsc-lite pcsc-lite-devel 2>/dev/null || \
    echo "Please install pcscd manually for your distro."
fi
sudo systemctl enable pcscd --now 2>/dev/null || true
echo "✓ pcscd ready"

# ── Install Python packages ─────────────────────────────────
echo ""
echo "Installing Python packages..."
pip3 install --quiet pyscard pyautogui
echo "✓ Packages installed"

# ── Create systemd user service ─────────────────────────────
echo ""
echo "Registering as systemd user service..."

mkdir -p "$SERVICE_DIR"

cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=LSPay NFC Keyboard Wedge
After=graphical-session.target

[Service]
Type=simple
ExecStart=$PYTHON_BIN $WEDGE_SCRIPT
Restart=always
RestartSec=3

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable "$SERVICE_NAME"
systemctl --user start "$SERVICE_NAME"

echo "✓ Service registered and started"

echo ""
echo "=============================================="
echo "  ✅  SETUP COMPLETE"
echo "=============================================="
echo ""
echo "  The NFC wedge runs silently in the background."
echo "  Auto-starts on every login — no action needed."
echo ""
echo "  To check status:"
echo "    systemctl --user status $SERVICE_NAME"
echo ""
echo "  To view logs:"
echo "    journalctl --user -u $SERVICE_NAME -f"
echo ""
echo "  To uninstall:"
echo "    systemctl --user disable --now $SERVICE_NAME"
echo "    rm $SERVICE_FILE"
echo ""
