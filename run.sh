#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [ ! -d "venv" ]; then
    echo "Virtual environment not found. Creating one..."
    python3 -m venv venv
    source venv/bin/activate
    pip install textual
else
    source venv/bin/activate
fi

if ! lsmod | grep -q "v4l2loopback"; then
    echo "Loading v4l2loopback module..."
    sudo modprobe v4l2loopback video_nr=2 card_label="Android Cam" exclusive_caps=1
fi

if ! adb devices 2>/dev/null | grep -q "\sdevice$"; then
    echo "WARNING: No Android device found or unauthorized."
    echo "Please connect your Vivo T4x and enable USB debugging."
    read -p "Press Enter to continue anyway or Ctrl+C to abort..."
fi

echo "Starting Camera TUI..."
python3 cam_tui.py
