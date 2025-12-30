# PopDroidCam

**Turn your Android phone into a high-quality webcam for Linux.**

No app installation on phone required. Works over USB or WiFi. Supports 1080p, 4K, custom resolutions, and camera rotation.

## Features

- **High quality video** - 1080p, 4K, up to 30fps (device dependent)
- **Zero phone setup** - No app needed, just enable USB/Wireless debugging
- **USB or WiFi** - Connect via cable or wireless debugging
- **QR code pairing** - Easy wireless setup with automatic discovery
- **Multi-camera support** - Choose between back, front, wide, ultrawide lenses
- **Camera rotation** - Rotate output 0°, 90°, 180°, or 270°
- **Device model display** - Shows phone model name instead of cryptic serial numbers
- **Works everywhere** - Zoom, Meet, Teams, OBS, Chrome, Firefox
- **Desktop App** - Native Electron GUI with live preview
- **Web GUI** - Browser-based interface
- **CLI + TUI** - Command-line and interactive terminal interface
- **Background mode** - No window, no dock icon

<img width="1268" height="1356" alt="Image" src="https://github.com/user-attachments/assets/2e134014-7176-4e8d-8e0f-f4854c59a08e" />

## Quick Start

```bash
# One-line install
curl -fsSL https://raw.githubusercontent.com/MaxySpark/PopDroidCam/main/install.sh | bash

# 2. Connect phone via USB with debugging enabled

# 3. Launch desktop app
popdroidcam desktop

# Or start streaming from CLI
popdroidcam start

# 4. Select "PopDroidCam" in your video app
```

## Prerequisites

### System Requirements

| Requirement | Details |
|-------------|---------|
| **OS** | Linux (tested on Pop!_OS 22.04, Ubuntu 22.04+, Debian 12+) |
| **Kernel** | v4l2loopback support (most modern kernels) |
| **Architecture** | x86_64 (amd64) |

### Phone Requirements

| Requirement | Details |
|-------------|---------|
| **Android Version** | Android 12+ recommended (for wireless debugging QR pairing) |
| **Developer Options** | Must be enabled |
| **USB Debugging** | Required for USB connection |
| **Wireless Debugging** | Required for WiFi connection (Android 11+) |

### Dependencies (installed by setup.sh)

| Package | Purpose |
|---------|---------|
| **adb** | Android Debug Bridge for phone communication |
| **scrcpy 2.x+** | Camera capture from Android (built from source) |
| **v4l2loopback** | Virtual webcam kernel module |
| **ffmpeg** | Video processing |
| **Bun** | TypeScript runtime |
| **pnpm** | Package manager |
| **Electron** | Desktop app framework |

> **Note**: Ubuntu/Pop!_OS ship scrcpy 1.x which lacks camera support. The setup script automatically builds scrcpy 2.x from source.

## Tested Devices

| Device | Model | Back Camera | Front Camera |
|--------|-------|-------------|--------------|
| Samsung Galaxy F62 | SM-E625F | 1920x1080 @ 30fps | 1920x1080 @ 30fps |
| Vivo T4x | - | 4080x3060 @ 30fps | 3264x2448 @ 30fps |

> Run `popdroidcam list` to see your phone's capabilities.

## Installation

### One-Line Install (Recommended)

```bash
curl -fsSL https://raw.githubusercontent.com/MaxySpark/PopDroidCam/main/install.sh | bash
```

This will:
1. Clone the repository to `~/.local/popdroidcam`
2. Run the full setup automatically

### Manual Setup

If you prefer to clone manually:

```bash
git clone https://github.com/MaxySpark/PopDroidCam.git ~/.local/popdroidcam
cd ~/.local/popdroidcam
./setup.sh
```

The setup script:
1. Installs system dependencies (adb, ffmpeg, build tools)
2. Installs v4l2loopback kernel module
3. Installs Bun and pnpm for TypeScript runtime
4. Installs Node.js dependencies (Electron, React, Ink)
5. Builds scrcpy 2.x from source (required for camera support)
6. Builds the desktop app
7. Adds `popdroidcam` to your PATH (`~/.local/bin`)
8. Loads the v4l2loopback module

After setup, restart your terminal or run `source ~/.bashrc`.

### Manual Prerequisites

If you prefer manual installation or setup.sh fails:

```bash
# Install system packages
sudo apt install -y \
    adb ffmpeg v4l2loopback-dkms v4l2loopback-utils \
    libsdl2-2.0-0 libsdl2-dev \
    libavcodec-dev libavdevice-dev libavformat-dev libavutil-dev \
    libswresample-dev libusb-1.0-0-dev \
    gcc git pkg-config meson ninja-build curl unzip

# Install Bun
curl -fsSL https://bun.sh/install | bash

# Install pnpm
curl -fsSL https://get.pnpm.io/install.sh | sh -

# Load v4l2loopback
sudo modprobe v4l2loopback card_label="PopDroidCam" exclusive_caps=1
```

Then build scrcpy 2.x from source (see [scrcpy build instructions](https://github.com/Genymobile/scrcpy/blob/master/doc/linux.md#build)).

## Phone Setup

### Enable Developer Options

1. Go to **Settings → About Phone**
2. Tap **Build Number** 7 times
3. You'll see "You are now a developer!"

### Enable USB Debugging (for USB connection)

1. Go to **Settings → Developer Options**
2. Enable **USB debugging**
3. Connect phone via USB cable
4. Accept the "Allow USB debugging?" prompt on phone

### Enable Wireless Debugging (for WiFi connection)

1. Go to **Settings → Developer Options**
2. Enable **Wireless debugging**
3. Ensure phone and PC are on the same WiFi network

## Usage

### Interface Options

PopDroidCam offers four ways to use it:

| Interface | Command | Description |
|-----------|---------|-------------|
| **Desktop App** | `popdroidcam desktop` | Electron GUI with live preview |
| **Web GUI** | `popdroidcam ui` | Browser-based interface |
| **TUI** | `popdroidcam` | Interactive terminal interface |
| **CLI** | `popdroidcam start` | Background streaming |

### Desktop App (Recommended)

```bash
popdroidcam desktop
```

Features:
- **Live camera preview** - See your camera feed in real-time
- **Device detection** - Automatically finds connected phones with model names
- **Camera selection** - Choose between front/back and different lenses
- **Resolution & FPS** - Pick from supported options
- **Rotation control** - Rotate camera output 0°, 90°, 180°, 270°
- **WiFi pairing** - Connect to phones wirelessly

### Web GUI

```bash
popdroidcam ui
```

Opens a browser-based interface at `http://localhost:3847` with similar features to the desktop app.

### TUI (Terminal User Interface)

```bash
popdroidcam
```

Interactive terminal interface with:
- **Camera tab**: Select device, camera/lens, resolution, FPS, rotation, mirror
- **Connect tab**: Pair and connect to phones over WiFi
- Device dropdown shows phone model names
- Keyboard shortcuts: `Tab` to switch tabs, `Enter` to select, `r` to refresh, `q` to quit
- Rotation toggle with `Ctrl+T`, Mirror toggle with `Ctrl+M`

### CLI Commands

```bash
# Launch interactive TUI
popdroidcam

# Launch desktop GUI app
popdroidcam desktop

# Launch web-based GUI
popdroidcam ui

# Start camera in background (default: 1080p 30fps back camera)
popdroidcam start

# Start with custom settings
popdroidcam start --res 4k --fps 30
popdroidcam start --res 1080p --fps 30 --camera front
popdroidcam start --rotation 90
popdroidcam start --mirror on

# Stop camera
popdroidcam stop

# Check status
popdroidcam status

# List cameras on phone with resolutions
popdroidcam list

# List connected devices (shows model names)
popdroidcam devices

# Show help
popdroidcam help
```

### Wireless Connection

#### Option 1: QR Code Pairing (Easiest)

```bash
popdroidcam qr
```

Then on your phone:
1. Go to **Settings → Developer Options → Wireless debugging**
2. Tap **"Pair device with QR code"**
3. Scan the QR code shown in terminal
4. Device auto-connects after pairing!

#### Option 2: Manual Pairing

**Step 1: Enable Wireless debugging on phone**
```
Settings → Developer Options → Wireless debugging → Enable
```

**Step 2: Pair (first-time only)**
```
On phone: Tap "Pair device with pairing code"
Note the IP address, Port, and 6-digit code shown
```
```bash
popdroidcam pair <ip> <pairing-port> <code>
# Example: popdroidcam pair 192.168.1.100 37123 123456
```

**Step 3: Connect**
```
On phone: Look at the Wireless debugging screen (not pairing)
Note the IP address and Port shown at the top
```
```bash
popdroidcam connect <ip> <port>
# Example: popdroidcam connect 192.168.1.100 41255
```

**Disconnect:**
```bash
popdroidcam disconnect
```

> **Note**: Pairing port and connection port are different! After pairing once, you only need `connect` in the future.

### Start Options

| Option | Values | Default | Description |
|--------|--------|---------|-------------|
| `--res` | `720p`, `1080p`, `4k`, or `WxH` | `1080p` | Video resolution |
| `--fps` | `10`, `15`, `20`, `24`, `30` | `30` | Frame rate |
| `--camera` | `front`, `back` | `back` | Camera facing direction |
| `--camera-id` | `0`, `1`, `2`, etc. | - | Specific camera lens ID |
| `--rotation` | `0`, `90`, `180`, `270` | `0` | Rotate camera output |
| `--mirror` | `off`, `on` | `off` | Mirror/flip video horizontally |
| `--device` | Serial or IP:port | Auto-detect | Select specific phone |

**Resolution presets:**
| Preset | Resolution |
|--------|------------|
| `720p` | 1280x720 |
| `1080p` | 1920x1080 |
| `4k` | 3840x2160 |
| Custom | Any `WxH` (e.g., `4080x3060`) |

> **Tip**: Use `popdroidcam list` to see your phone's native camera resolutions and supported FPS values.

### Examples

```bash
# Launch desktop app
popdroidcam desktop

# Quick start (1080p, 30fps, back camera)
popdroidcam start

# 4K back camera
popdroidcam start --res 4k

# Front camera
popdroidcam start --camera front

# Specific lens by ID (see 'popdroidcam list')
popdroidcam start --camera-id 2

# Rotated 90 degrees (portrait to landscape)
popdroidcam start --rotation 90

# Mirror video horizontally (useful for front camera)
popdroidcam start --mirror on

# Combine options
popdroidcam start --res 1080p --fps 30 --camera-id 0 --rotation 90 --mirror on

# Check status / stop
popdroidcam status
popdroidcam stop
```

### Camera Lens Selection

Phones with multiple cameras (wide, ultrawide, telephoto) expose each as a separate camera ID:

```bash
# List available cameras to see IDs
popdroidcam list

# Example output:
#   Camera 0 (back) - Main camera
#   Camera 1 (front) - Selfie camera  
#   Camera 2 (back) - Wide angle
#   Camera 3 (back) - Telephoto

# Use specific camera by ID
popdroidcam start --camera-id 0    # Main back camera
popdroidcam start --camera-id 2    # Wide angle (if available)
```

> **Note**: `--camera` (back/front) uses the default lens. Use `--camera-id` for specific lens control.

### Camera Rotation

Rotate the camera output to match your physical phone orientation:

```bash
# No rotation (default)
popdroidcam start --rotation 0

# Rotate 90° clockwise
popdroidcam start --rotation 90

# Rotate 180° (upside down)
popdroidcam start --rotation 180

# Rotate 270° (90° counter-clockwise)
popdroidcam start --rotation 270
```

In the Desktop/Web/TUI interfaces, use the rotation dropdown or `Ctrl+T` shortcut.

### Video Mirroring

Mirror (flip horizontally) the camera output, useful for front-facing cameras:

```bash
# No mirroring (default)
popdroidcam start --mirror off

# Mirror horizontally
popdroidcam start --mirror on

# Combine with rotation
popdroidcam start --mirror on --rotation 90
```

In the Desktop/Web/TUI interfaces, use the mirror dropdown or `Ctrl+M` shortcut.

### Multiple Devices

When multiple phones are connected, use `--device` to select which one:

```bash
# List connected devices (shows model names)
popdroidcam devices

# Example output:
#   SM E625F (192.168.1.94:40679) - device
#   Pixel 7 (10BF54084E002ZB) - device

# Start with specific device (USB)
popdroidcam start --device 10BF54084E002ZB

# Start with specific device (WiFi)
popdroidcam start --device 192.168.1.100:5555
```

## Using in Apps

After starting the stream, select **"PopDroidCam"** as your camera in:

- **Browser** (Chrome, Firefox) - video calls
- **Zoom / Google Meet / Teams**
- **OBS Studio** - Video Capture Device → PopDroidCam
- Any app that uses webcam

## Building Desktop Releases

Create distributable packages for Linux:

```bash
# Build AppImage (portable, runs anywhere)
pnpm run dist:appimage

# Build .deb package (for Debian/Ubuntu)
pnpm run dist:deb

# Build both
pnpm run dist:linux
```

Output files are created in the `release/` directory.

## Project Structure

| File/Directory | Description |
|----------------|-------------|
| `popdroidcam` | Main CLI command (bash) |
| `src/desktop/main.ts` | Desktop app main process (Electron) |
| `src/desktop/preload.ts` | Electron preload script for IPC |
| `src/desktop/renderer/` | Desktop app UI (HTML/CSS/JS) |
| `src/gui/server.ts` | Web GUI server (Bun) |
| `src/gui/index.html` | Web GUI interface |
| `src/App.tsx` | Terminal UI (Ink React) |
| `src/utils.ts` | Shared utilities (device/camera management) |
| `src/qr-pair.ts` | QR code pairing with mDNS discovery |
| `setup.sh` | Install dependencies and build scrcpy |
| `uninstall.sh` | Remove installation and cleanup |

## State Files

PopDroidCam stores runtime state in `~/.local/state/popdroidcam/`:

| File | Purpose |
|------|---------|
| `pid` | Process ID of running stream |
| `config` | Current stream settings (resolution, fps, rotation, etc.) |
| `scrcpy.log` | scrcpy output for debugging |

## Troubleshooting

### "PopDroidCam" not showing in apps

1. Check stream is running:
   ```bash
   popdroidcam status
   ```

2. Ensure v4l2loopback is loaded:
   ```bash
   lsmod | grep v4l2loopback
   ```

3. If not loaded:
   ```bash
   sudo modprobe v4l2loopback card_label="PopDroidCam" exclusive_caps=1
   ```

4. Restart your video app after starting the stream

### Phone not detected

**USB:**
1. Enable USB debugging (Settings → Developer Options → USB debugging)
2. Check connection:
   ```bash
   popdroidcam devices
   ```
3. If "unauthorized", accept the prompt on your phone
4. Try a different USB cable (some cables are charge-only)

**WiFi:**
1. Enable Wireless debugging (Settings → Developer Options → Wireless debugging)
2. Pair first time: `popdroidcam qr` or `popdroidcam pair <ip> <port> <code>`
3. Connect: `popdroidcam connect <ip> <port>`
4. Ensure phone and PC are on same network (same subnet)
5. Check if firewall is blocking adb ports (5555, 5037)

### scrcpy version too old

The camera feature requires scrcpy 2.0+. Run setup.sh to build from source:

```bash
./setup.sh
```

Or check your version:
```bash
scrcpy --version
# Must be 2.0 or higher
```

### Custom resolution not working

If a custom resolution fails (e.g., 4080x3060), it's likely a **hardware encoder limitation** on your phone.

**Solution**: Use standard resolutions:
- `1920x1080` (recommended - works on all devices)
- `1280x720` (lower bandwidth)
- `3840x2160` (4K - if your phone supports it)

Check logs for details:
```bash
cat ~/.local/state/popdroidcam/scrcpy.log
```

### Desktop app won't start

1. Ensure the app is built:
   ```bash
   pnpm run desktop:build
   ```

2. Check for Electron errors:
   ```bash
   pnpm run desktop:dev
   ```

3. Ensure Electron is properly installed:
   ```bash
   node node_modules/electron/install.js
   ```

### WSL2 Limitations

WSL2 uses a custom Microsoft kernel that **does not include v4l2loopback**. This means:

- **Virtual webcam will NOT work** - You cannot use your phone as a webcam in Windows apps (Zoom, Teams, etc.)
- **Camera viewing works** - You can still view your phone's camera feed in a window using `scrcpy --video-source=camera`

**Error you'll see:**
```
modprobe: FATAL: Module v4l2loopback not found in directory /lib/modules/5.15.167.4-microsoft-standard-WSL2
```

**Workarounds:**

1. **Use native Linux** - Dual-boot or use a Linux VM with proper kernel module support
2. **Screen share the scrcpy window** - Run camera in window mode and share that window in your video call
3. **Build custom WSL2 kernel** - Advanced: Compile WSL2 kernel with v4l2loopback support ([guide](https://github.com/microsoft/WSL/issues/6348))

For full virtual webcam functionality, a native Linux installation is recommended.

### Stream quality issues

- **Laggy/choppy**: Lower resolution or FPS (`--res 720p --fps 15`)
- **Blurry**: Use higher resolution (`--res 1080p` or `--res 4k`)
- **WiFi latency**: Connect via USB for best performance

## How It Works

```
┌─────────────┐     USB/WiFi      ┌─────────────┐
│   Android   │ ←───────────────→ │    Linux    │
│   Phone     │    adb + scrcpy   │     PC      │
│  (camera)   │                   │             │
└─────────────┘                   └──────┬──────┘
                                         │
                                         ▼
                              ┌─────────────────────┐
                              │    v4l2loopback     │
                              │  (virtual webcam)   │
                              │   /dev/videoN       │
                              └──────────┬──────────┘
                                         │
                    ┌────────────────────┼────────────────────┐
                    ▼                    ▼                    ▼
              ┌──────────┐        ┌──────────┐        ┌──────────┐
              │   Zoom   │        │  Chrome  │        │   OBS    │
              └──────────┘        └──────────┘        └──────────┘
```

1. **scrcpy 2.x** captures video from Android camera over USB/WiFi (no app needed on phone)
2. **v4l2loopback** creates a virtual webcam device (`/dev/videoN`) named "PopDroidCam"
3. **popdroidcam** manages the stream and provides CLI/TUI/Desktop/Web interfaces

## Uninstall

### One-Line Uninstall

```bash
curl -fsSL https://raw.githubusercontent.com/MaxySpark/PopDroidCam/main/uninstall-remote.sh | bash
```

### Local Uninstall

If you have the source code:

```bash
./uninstall.sh
```

This removes:
- Symlink from `~/.local/bin/popdroidcam`
- State files from `~/.local/state/popdroidcam/`
- Node modules
- Build artifacts (keeps source code)

To completely remove, also delete the project directory and uninstall scrcpy if desired.

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT

---

**Made for Pop!_OS / Ubuntu Linux** | Uses [scrcpy](https://github.com/Genymobile/scrcpy) under the hood
