#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== PopDroidCam Setup ==="
echo ""

echo ">>> Updating package lists..."
sudo apt update

echo ">>> Installing build dependencies and v4l2loopback..."
sudo apt install -y \
    ffmpeg libsdl2-2.0-0 adb wget gcc git pkg-config meson ninja-build \
    libsdl2-dev libavcodec-dev libavdevice-dev libavformat-dev libavutil-dev \
    libswresample-dev libusb-1.0-0 libusb-1.0-0-dev \
    v4l2loopback-dkms v4l2loopback-utils \
    curl unzip

echo ">>> Installing Bun..."
if ! command -v bun &> /dev/null; then
    curl -fsSL https://bun.sh/install | bash
    export BUN_INSTALL="$HOME/.bun"
    export PATH="$BUN_INSTALL/bin:$PATH"
fi

echo ">>> Installing pnpm..."
if ! command -v pnpm &> /dev/null; then
    curl -fsSL https://get.pnpm.io/install.sh | sh -
    export PNPM_HOME="$HOME/.local/share/pnpm"
    export PATH="$PNPM_HOME:$PATH"
fi

echo ">>> Installing Node.js dependencies..."
pnpm install

echo ">>> Setting up Electron..."
node node_modules/electron/install.js

echo ">>> Building desktop app..."
pnpm run desktop:build

echo ">>> Setting up build directory..."
mkdir -p build_scrcpy
cd build_scrcpy

if [ ! -d "scrcpy" ]; then
    echo ">>> Cloning scrcpy..."
    git clone https://github.com/Genymobile/scrcpy
    cd scrcpy
else
    cd scrcpy
    git fetch --tags
fi

LATEST_TAG=$(git describe --tags --abbrev=0)
echo ">>> Checking out latest version: $LATEST_TAG"
git checkout $LATEST_TAG

echo ">>> Downloading prebuilt server..."
wget -O scrcpy-server "https://github.com/Genymobile/scrcpy/releases/download/${LATEST_TAG}/scrcpy-server-${LATEST_TAG}"

echo ">>> Building scrcpy client..."
meson setup x --buildtype=release --strip -Db_lto=true -Dprebuilt_server=scrcpy-server --wipe 2>/dev/null || \
    meson setup x --buildtype=release --strip -Db_lto=true -Dprebuilt_server=scrcpy-server
ninja -C x

echo ">>> Installing scrcpy..."
sudo ninja -C x install

cd "$SCRIPT_DIR"

echo ">>> Installing popdroidcam command..."
mkdir -p "$HOME/.local/bin"
ln -sf "$SCRIPT_DIR/popdroidcam" "$HOME/.local/bin/popdroidcam"

if [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
    echo ""
    echo ">>> Adding ~/.local/bin to PATH..."
    echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.bashrc"
    echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.zshrc" 2>/dev/null || true
    echo ""
    echo "Run 'source ~/.bashrc' or restart your terminal to use 'popdroidcam' command."
fi

echo ">>> Loading v4l2loopback module..."
sudo modprobe v4l2loopback card_label="Android Cam" exclusive_caps=1 || true

echo ">>> Verifying installation..."
scrcpy --version
bun --version

echo ""
echo "=== Setup Complete! ==="
echo ""
echo "Usage:"
echo "  popdroidcam          - Launch interactive TUI"
echo "  popdroidcam desktop  - Launch desktop GUI app"
echo "  popdroidcam start    - Start camera in background"
echo "  popdroidcam stop     - Stop camera"
echo "  popdroidcam status   - Check status"
echo "  popdroidcam help     - Show all commands"
echo ""
echo "If 'popdroidcam' command not found, run: source ~/.bashrc"
