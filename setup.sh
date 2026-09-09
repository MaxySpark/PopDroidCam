#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== PopDroidCam Setup ==="
echo ""

BUILD_SCRCPY=true

if [ -f /etc/arch-release ]; then
    BUILD_SCRCPY=false
    ARCH_PACKAGES=(
        alsa-lib android-tools bun curl ffmpeg git gtk3 libnotify libsecret
        libxss libxtst nodejs nss pnpm scrcpy unzip xdg-utils
        v4l2loopback-dkms v4l2loopback-utils
    )

    if [ ! -e "/usr/lib/modules/$(uname -r)/build" ]; then
        case "$(uname -r)" in
            *-arch*) ARCH_PACKAGES+=(linux-headers) ;;
            *-lts*) ARCH_PACKAGES+=(linux-lts-headers) ;;
            *-zen*) ARCH_PACKAGES+=(linux-zen-headers) ;;
            *-hardened*) ARCH_PACKAGES+=(linux-hardened-headers) ;;
            *)
                echo "ERROR: Cannot determine the headers package for kernel $(uname -r)."
                echo "Install its matching kernel headers, then run this script again."
                exit 1
                ;;
        esac
    fi

    echo ">>> Updating Arch Linux and installing dependencies..."
    sudo pacman -Syu --needed --noconfirm "${ARCH_PACKAGES[@]}"
elif command -v apt-get &> /dev/null; then
    echo ">>> Updating package lists..."
    sudo apt-get update

    echo ">>> Installing build dependencies and v4l2loopback..."
    sudo apt-get install -y \
        ffmpeg libsdl2-2.0-0 adb wget gcc git pkg-config meson ninja-build \
        libsdl2-dev libavcodec-dev libavdevice-dev libavformat-dev libavutil-dev \
        libswresample-dev libusb-1.0-0 libusb-1.0-0-dev \
        v4l2loopback-dkms v4l2loopback-utils \
        curl unzip
else
    echo "ERROR: Unsupported Linux distribution."
    echo "This setup script supports Arch Linux, Debian, Ubuntu, and Pop!_OS."
    exit 1
fi

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
pnpm exec electron --version

echo ">>> Building desktop app..."
pnpm run desktop:build

if [ "$BUILD_SCRCPY" = true ]; then
    echo ">>> Setting up build directory..."
    SCRCPY_VERSION="v4.1"
    SCRCPY_SERVER_SHA256="deacb991ed2509715160ffdc7907e47b4160eb30d1566217e9047fd5b8850cae"
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

    echo ">>> Checking out scrcpy $SCRCPY_VERSION"
    git checkout "$SCRCPY_VERSION"

    echo ">>> Downloading prebuilt server..."
    wget -O scrcpy-server "https://github.com/Genymobile/scrcpy/releases/download/${SCRCPY_VERSION}/scrcpy-server-${SCRCPY_VERSION}"
    echo "$SCRCPY_SERVER_SHA256  scrcpy-server" | sha256sum --check --status || {
        echo "ERROR: scrcpy server checksum verification failed"
        exit 1
    }

    echo ">>> Building scrcpy client..."
    meson setup x --buildtype=release --strip -Db_lto=true -Dprebuilt_server=scrcpy-server --wipe 2>/dev/null || \
        meson setup x --buildtype=release --strip -Db_lto=true -Dprebuilt_server=scrcpy-server
    ninja -C x

    echo ">>> Installing scrcpy..."
    sudo ninja -C x install

    cd "$SCRIPT_DIR"
fi

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
if ! sudo modprobe v4l2loopback card_label="PopDroidCam" exclusive_caps=1; then
    echo "WARNING: v4l2loopback could not be loaded."
    echo "If the kernel was just updated, reboot and run this setup again."
fi

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
