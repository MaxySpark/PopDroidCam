# PopDroidCam

**Turn your Android phone into a high-quality webcam for Linux.**

No app installation on phone required. Works over USB or WiFi. Supports 1080p, 4K, and custom resolutions.

## Features

- **High quality video** - 1080p, 4K, up to 30fps (device dependent)
- **Zero phone setup** - No app needed, just enable USB/Wireless debugging
- **USB or WiFi** - Connect via cable or wireless debugging
- **QR code pairing** - Easy wireless setup
- **Multi-camera support** - Choose between back, front, wide, ultrawide lenses
- **Works everywhere** - Zoom, Meet, Teams, OBS, Chrome, Firefox
- **CLI + TUI** - Command-line and interactive terminal interface
- **Background mode** - No window, no dock icon

## Quick Start

```bash
# 1. Clone and install
git clone https://github.com/YourUsername/PopDroidCamera.git
cd PopDroidCamera
./setup.sh

# 2. Connect phone via USB with debugging enabled

# 3. Start streaming
popdroidcam start

# 4. Select "Android Cam" in your video app
```

## Requirements

- Linux (tested on Pop!_OS 22.04, Ubuntu 22.04+)
- Android phone with Developer Options enabled
- USB cable (easiest) or WiFi on same network

## Tested Devices

| Device | Back Camera | Front Camera |
|--------|-------------|--------------|
| Vivo T4x | 4080x3060 @ 30fps | 3264x2448 @ 30fps |

> Run `popdroidcam list` to see your phone's capabilities.

## Installation

```bash
git clone https://github.com/YourUsername/PopDroidCamera.git
cd PopDroidCamera
./setup.sh
```

The setup script:
- Installs Bun and pnpm for TypeScript runtime
- Installs Node.js dependencies (OpenTUI, qrcode)
- Builds scrcpy 2.x from source (required for camera support)
- Sets up v4l2loopback kernel module
- Adds `popdroidcam` to your PATH

After setup, restart your terminal or run `source ~/.bashrc`.

## Usage

### CLI Commands

```bash
# Launch interactive TUI
popdroidcam

# Start camera in background (default: 1080p 30fps back camera)
popdroidcam start

# Start with custom settings
popdroidcam start --res 4k --fps 30
popdroidcam start --res 1080p --fps 30 --camera front

# Stop camera
popdroidcam stop

# Check status
popdroidcam status

# List cameras on phone
popdroidcam list

# List connected devices
popdroidcam devices

# Show help
popdroidcam help
```

### Wireless Connection

Connect to your phone over WiFi instead of USB cable.

#### Option 1: QR Code Pairing (Easiest)

```bash
popdroidcam qr
```

Then on your phone:
1. Go to **Settings → Developer Options → Wireless debugging**
2. Tap **"Pair device with QR code"**
3. Scan the QR code shown in terminal
4. Once paired, connect with the port shown on phone's Wireless debugging screen:
   ```bash
   popdroidcam connect <ip> <port>
   ```

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

### Options for `start`

| Option | Values | Default |
|--------|--------|---------|
| `--res` | `720p`, `1080p`, `4k`, or custom (e.g., `4080x3060`) | `1080p` |
| `--fps` | `10`, `15`, `20`, `24`, `30` (device dependent) | `30` |
| `--camera` | `front`, `back` | `back` |
| `--camera-id` | Camera ID for specific lens (see `popdroidcam list`) | - |
| `--device` | Device serial (e.g., `10BF54084E002ZB` or `192.168.1.100:5555`) | Auto-detect |

**Resolution presets:**
| Preset | Resolves to |
|--------|-------------|
| `720p` | 1280x720 |
| `1080p` | 1920x1080 |
| `4k` | 3840x2160 |
| Custom | Pass exact `WxH` (e.g., `4080x3060`) |

> **Tip**: Use `popdroidcam list` to see your phone's native camera resolutions and supported FPS values.

### Examples

```bash
# Quick start (1080p, 30fps, back camera)
popdroidcam start

# 4K back camera
popdroidcam start --res 4k

# Front camera
popdroidcam start --camera front

# Specific lens by ID (see 'popdroidcam list')
popdroidcam start --camera-id 2

# Check status / stop
popdroidcam status
popdroidcam stop
```

### Camera Lens Selection

Phones with multiple cameras (wide, ultrawide, telephoto) expose each as a separate camera ID. Use `--camera-id` to select a specific lens:

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

In the TUI, enter the camera ID in the "Camera ID" field after clicking "Detect Cameras".

> **Note**: `--camera` (back/front) is simpler but uses the default lens. Use `--camera-id` for specific lens control.

### Multiple Devices

When multiple phones are connected, use `--device` to select which one:

```bash
# List connected devices
popdroidcam devices

# Start with specific device (USB)
popdroidcam start --device 10BF54084E002ZB

# Start with specific device (WiFi)
popdroidcam start --device 192.168.1.100:5555
```

In the TUI, use the device dropdown at the top of the Camera tab to select which phone to use.

## Using in Apps

After starting the stream, select **"Android Cam"** as your camera in:

- **Browser** (Chrome, Firefox) - video calls
- **Zoom / Google Meet / Teams**
- **OBS Studio** - Video Capture Device
- Any app that uses webcam

## TUI (Terminal User Interface)

Run `popdroidcam` without arguments to launch the interactive interface:

- **Camera tab**: Select device, camera/lens, resolution, FPS, and start/stop stream
- **Connect tab**: Pair and connect to phones over WiFi (use `popdroidcam qr` for QR pairing)
- Device dropdown auto-populates with connected phones (USB and WiFi)
- Camera ID field for specific lens selection (click "Detect Cameras" first)
- Real-time status display (shows if stream started via CLI too)
- Press `r` to refresh status, `q` to quit

## Files

| File | Description |
|------|-------------|
| `popdroidcam` | Main CLI command (bash) |
| `src/App.tsx` | Terminal UI (OpenTUI React) |
| `src/utils.ts` | Utility functions for device/camera management |
| `src/qr-pair.ts` | QR code pairing with mDNS discovery |
| `setup.sh` | Install dependencies, build scrcpy 2.x from source |
| `uninstall.sh` | Remove installation and cleanup |
| `test_stream.sh` | Verify streaming works |

## State Files

PopDroidCam stores runtime state in `~/.local/state/popdroidcam/`:

| File | Purpose |
|------|---------|
| `pid` | Process ID of running stream |
| `config` | Current stream settings |
| `scrcpy.log` | scrcpy output for debugging |

## Troubleshooting

### "Android Cam" not showing in apps

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
   sudo modprobe v4l2loopback card_label="Android Cam" exclusive_caps=1
   ```

### Phone not detected

**USB:**
1. Enable USB debugging on phone (Settings → Developer Options → USB debugging)
2. Check connection:
   ```bash
   popdroidcam devices
   ```
3. If "unauthorized", accept the prompt on your phone

**WiFi:**
1. Enable Wireless debugging (Settings → Developer Options → Wireless debugging)
2. Pair first time: `popdroidcam pair <ip> <port> <code>`
3. Connect: `popdroidcam connect <ip> <port>`
4. Ensure phone and PC are on same network

### scrcpy version too old

Run `./setup.sh` to build scrcpy 2.x+ from source (required for camera support).

### Custom resolution not working

If a custom resolution fails (e.g., 4080x3060), it's likely a **hardware encoder limitation** on your phone. The camera sensor can capture at that resolution, but the phone's MediaCodec can't encode it for streaming.

**Solution**: Use standard resolutions that encoders support well:
- `1920x1080` (recommended - works on all devices)
- `1280x720` (lower bandwidth)
- `3840x2160` (4K - if your phone supports it)

Check `~/.local/state/popdroidcam/scrcpy.log` for error details if streaming fails.

## How It Works

1. **scrcpy 2.x** captures video from Android camera over USB/WiFi (no app needed on phone)
2. **v4l2loopback** creates a virtual webcam device (`/dev/videoN`)
3. **popdroidcam** manages the stream and provides easy CLI/TUI controls

> **Note**: Ubuntu/Pop!_OS ships scrcpy 1.x which lacks camera support. The setup script builds scrcpy 2.x from source.

## Uninstall

```bash
./uninstall.sh
```

This removes:
- Symlink from `~/.local/bin/popdroidcam`
- State files from `~/.local/state/popdroidcam/`
- Node modules
- Build artifacts (keeps source code)

## License

MIT

---

**Made for Pop!_OS / Ubuntu Linux** | Uses [scrcpy](https://github.com/Genymobile/scrcpy) under the hood
