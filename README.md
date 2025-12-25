# PopDroidCam

Use your Android phone as a high-quality webcam on Linux over USB.

## Features

- **High resolution streaming** - 1080p, 4K, or native camera resolution (e.g., 4080x3060)
- **Flexible frame rates** - 10, 15, 20, 24, 30 fps (device dependent)
- **Works everywhere** - Zoom, Google Meet, Teams, OBS, Chrome, Firefox
- **USB connection** - No WiFi latency, reliable and fast
- **CLI + TUI** - Command-line interface and interactive terminal UI
- **Background streaming** - Start once, use in any app

## Requirements

- Linux (tested on Pop!_OS 22.04)
- Android phone with USB debugging enabled
- USB cable

## Tested Devices

| Device | Back Camera | Front Camera |
|--------|-------------|--------------|
| Vivo T4x | 4080x3060 @ 30fps | 3264x2448 @ 30fps |

> Run `popdroidcam list` to see your phone's camera capabilities.

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

### Options for `start`

| Option | Values | Default |
|--------|--------|---------|
| `--res` | `720p`, `1080p`, `4k`, or custom (e.g., `4080x3060`) | `1080p` |
| `--fps` | `10`, `15`, `20`, `24`, `30` (device dependent) | `30` |
| `--camera` | `front`, `back` | `back` |

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
# Quick start with defaults (1080p, 30fps, back camera)
popdroidcam start

# 4K back camera
popdroidcam start --res 4k --fps 30

# Front camera for selfie view
popdroidcam start --camera front

# Use native camera resolution (check with 'popdroidcam list')
popdroidcam start --res 4080x3060 --fps 30
popdroidcam start --camera front --res 3264x2448

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
| `cam_tui.py` | Terminal UI (Textual-based) |
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

1. Enable USB debugging on phone (Settings → Developer Options)
2. Check connection:
   ```bash
   popdroidcam devices
   ```
3. If "unauthorized", accept the prompt on your phone

### scrcpy version too old

Run `./setup.sh` to build scrcpy 2.x+ from source (required for camera support).

## How It Works

1. **scrcpy 2.x** captures video from Android camera over USB (no app needed on phone)
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
- Python virtual environment
- Build artifacts (keeps source code)

## License

MIT
