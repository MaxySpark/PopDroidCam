# PopDroidCam

Use your Android phone as a high-quality webcam on Linux over USB.

## Features

- 1080p / 4K video streaming at 30/60 fps
- Works with Zoom, Google Meet, Teams, OBS, and browsers
- USB connection (no WiFi latency)
- Simple CLI and TUI interface
- Background streaming with start/stop commands

## Requirements

- Linux (tested on Pop!_OS)
- Android phone with USB debugging enabled
- USB cable

## Installation

```bash
git clone <repo>
cd PopDroidCamera
./setup.sh
```

After setup, restart your terminal or run:
```bash
source ~/.bashrc
```

## Usage

### CLI Commands

```bash
# Launch interactive TUI
popdroidcam

# Start camera in background (default: 1080p 30fps back camera)
popdroidcam start

# Start with custom settings
popdroidcam start --res 4k --fps 60
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

### Options for `start`

| Option | Values | Default |
|--------|--------|---------|
| `--res` | `720p`, `1080p`, `4k` | `1080p` |
| `--fps` | `30`, `60` | `30` |
| `--camera` | `front`, `back` | `back` |

### Examples

```bash
# Quick start with defaults
popdroidcam start

# 4K 60fps back camera
popdroidcam start --res 4k --fps 60

# Front camera for selfie view
popdroidcam start --camera front

# Check if running
popdroidcam status

# Stop when done
popdroidcam stop
```

## Using in Apps

After starting the stream, select **"Android Cam"** as your camera in:

- **Browser** (Chrome, Firefox) - video calls
- **Zoom / Google Meet / Teams**
- **OBS Studio** - Video Capture Device
- Any app that uses webcam

## TUI (Terminal User Interface)

Run `popdroidcam` without arguments to launch the interactive interface:

- Select camera, resolution, and FPS
- Start/Stop stream with buttons
- See real-time status (shows if stream started via CLI too)

## Files

| File | Description |
|------|-------------|
| `popdroidcam` | Main CLI command |
| `setup.sh` | Install dependencies and configure |
| `cam_tui.py` | Terminal UI |
| `test_stream.sh` | Verify streaming works |

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

1. Enable USB debugging on phone (Settings → Developer Options)
2. Check connection:
   ```bash
   popdroidcam devices
   ```
3. If "unauthorized", accept the prompt on your phone

### scrcpy version too old

Run `./setup.sh` to build scrcpy 2.x+ from source (required for camera support).

## How It Works

1. **scrcpy** captures video from Android camera over USB (no app needed on phone)
2. **v4l2loopback** creates a virtual webcam device
3. **popdroidcam** manages the stream and provides easy controls
