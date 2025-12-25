# Future Enhancements

## Planned Features

### Audio Support
- Forward phone microphone audio alongside video
- `--audio` flag for `popdroidcam start`
- Useful for using phone as full webcam+mic combo

### Auto-reconnect
- Detect USB disconnect and automatically reconnect
- Background daemon mode with watchdog

### Multiple Device Support
- Select from multiple connected Android devices
- `--device <serial>` flag

### Systemd Service
- `popdroidcam install-service` to create systemd user service
- Auto-start on login or USB connect

### Config File
- `~/.config/popdroidcam/config` for default settings
- Remember last used resolution/fps/camera

### Preview Window
- Optional preview window while streaming
- `--preview` flag

### Web Dashboard
- Simple localhost web UI for status/control
- Useful for headless setups

### Quality Presets
- `--preset low/medium/high/max`
- Auto-select optimal settings based on USB speed

### Recording
- `popdroidcam record` to save stream to file
- Timestamp-based filenames

### Bitrate Control
- `--bitrate` flag for bandwidth-constrained scenarios

## Technical Debt

### Auto-detect Video Device Number
- Currently hardcoded fallback to /dev/video6
- Should probe v4l2loopback for next available device

### Error Recovery
- Better handling when phone goes to sleep
- Graceful degradation when camera is in use by another app

### Cross-distro Testing
- Test on Ubuntu, Fedora, Arch
- Adapt setup.sh for different package managers

## Architecture Notes

### State Management
- PID stored in `~/.local/state/popdroidcam/pid`
- Config stored in `~/.local/state/popdroidcam/config`
- Logs in `~/.local/state/popdroidcam/scrcpy.log`

### Why scrcpy?
- No app required on phone
- Uses Android's native camera2 API
- High quality, low latency over USB
- v4l2 sink built-in (Linux only)

### Why v4l2loopback?
- Creates virtual webcam device
- `exclusive_caps=1` required for Chrome/WebRTC compatibility
- Works with all standard video capture apps
