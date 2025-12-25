#!/bin/bash
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "${GREEN}✓ $1${NC}"; }
fail() { echo -e "${RED}✗ $1${NC}"; exit 1; }
warn() { echo -e "${YELLOW}⚠ $1${NC}"; }

find_v4l2loopback_device() {
    for name_file in /sys/devices/virtual/video4linux/video*/name; do
        if [ -f "$name_file" ]; then
            name=$(cat "$name_file" 2>/dev/null)
            if [[ "$name" == *"Android"* ]] || [[ "$name" == *"v4l2loopback"* ]]; then
                device=$(basename "$(dirname "$name_file")")
                echo "/dev/$device"
                return 0
            fi
        fi
    done
    echo ""
    return 1
}

echo "=== Android Camera Stream Test ==="
echo ""

echo "[1/7] Checking scrcpy installation..."
if command -v scrcpy &> /dev/null; then
    VERSION=$(scrcpy --version 2>&1 | head -1)
    pass "scrcpy installed: $VERSION"
    
    MAJOR=$(echo "$VERSION" | grep -oP 'scrcpy \K[0-9]+' || echo "0")
    if [ "$MAJOR" -lt 2 ]; then
        fail "scrcpy 2.x+ required for camera support. Found version $MAJOR.x. Run ./setup.sh"
    fi
else
    fail "scrcpy not installed. Run ./setup.sh"
fi

echo ""
echo "[2/7] Checking v4l2loopback module..."
if lsmod | grep -q v4l2loopback; then
    pass "v4l2loopback module loaded"
else
    warn "v4l2loopback not loaded. Loading now..."
    sudo modprobe v4l2loopback card_label="Android Cam" exclusive_caps=1
    sleep 1
    if lsmod | grep -q v4l2loopback; then
        pass "v4l2loopback loaded successfully"
    else
        fail "Failed to load v4l2loopback"
    fi
fi

echo ""
echo "[3/7] Finding v4l2loopback virtual camera device..."
V4L2_DEVICE=$(find_v4l2loopback_device)
if [ -n "$V4L2_DEVICE" ] && [ -e "$V4L2_DEVICE" ]; then
    pass "Virtual camera found: $V4L2_DEVICE"
else
    fail "No v4l2loopback device found. Try: sudo modprobe v4l2loopback card_label='Android Cam' exclusive_caps=1"
fi

echo ""
echo "[4/7] Checking ADB and connected device..."
if ! command -v adb &> /dev/null; then
    fail "adb not installed. Run ./setup.sh"
fi

DEVICE=$(adb devices 2>/dev/null | grep -w "device" | head -1 | cut -f1)
if [ -z "$DEVICE" ]; then
    fail "No Android device connected or authorized. Enable USB debugging and reconnect."
else
    pass "Device connected: $DEVICE"
fi

echo ""
echo "[5/7] Starting 1080p 30fps camera stream (10 second test)..."
timeout 10s scrcpy \
    --video-source=camera \
    --camera-facing=back \
    --camera-size=1920x1080 \
    --camera-fps=30 \
    --v4l2-sink="$V4L2_DEVICE" \
    --no-playback \
    --no-audio \
    2>&1 &

SCRCPY_PID=$!
sleep 3

echo ""
echo "[6/7] Checking if scrcpy is running..."
if ps -p $SCRCPY_PID > /dev/null 2>&1; then
    pass "scrcpy camera stream started (PID: $SCRCPY_PID)"
else
    fail "scrcpy failed to start camera stream"
fi

echo ""
echo "[7/7] Verifying video stream on $V4L2_DEVICE..."
if command -v v4l2-ctl &> /dev/null; then
    FORMAT=$(v4l2-ctl -d "$V4L2_DEVICE" --get-fmt-video 2>/dev/null || echo "")
    if echo "$FORMAT" | grep -q "Width"; then
        pass "Video stream active on $V4L2_DEVICE"
        echo "$FORMAT" | grep -E "Width|Height|Pixel Format" | sed 's/^/    /'
    else
        warn "Could not read format (stream may still work)"
    fi
else
    if [ -r "$V4L2_DEVICE" ]; then
        pass "$V4L2_DEVICE is readable"
    else
        warn "Cannot verify stream format (v4l2-ctl not installed)"
    fi
fi

echo ""
echo "Stopping test stream..."
kill $SCRCPY_PID 2>/dev/null || true
wait $SCRCPY_PID 2>/dev/null || true

echo ""
echo -e "${GREEN}=== All checks passed! ===${NC}"
echo ""
echo "Your Android camera is ready to use as a webcam."
echo "Select 'Android Cam' in:"
echo "  - Browser video calls (Chrome, Firefox)"
echo "  - OBS (Video Capture Device)"
echo "  - Zoom/Meet/Teams"
echo ""
echo "To start streaming manually:"
echo "  scrcpy --video-source=camera --camera-size=1920x1080 --v4l2-sink=$V4L2_DEVICE --no-playback"
