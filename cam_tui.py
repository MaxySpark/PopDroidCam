from textual.app import App, ComposeResult
from textual.containers import Container, Horizontal, Vertical
from textual.widgets import Header, Footer, Button, Select, Static, Log, Input, TabbedContent, TabPane
from textual.binding import Binding
import subprocess
import os
import signal
import glob
import re

STATE_DIR = os.path.expanduser("~/.local/state/popdroidcam")
PID_FILE = os.path.join(STATE_DIR, "pid")
CONFIG_FILE = os.path.join(STATE_DIR, "config")
CAMERAS_FILE = os.path.join(STATE_DIR, "cameras")


def find_v4l2loopback_device():
    for path in glob.glob("/sys/devices/virtual/video4linux/video*/name"):
        try:
            with open(path) as f:
                content = f.read()
                if "Android" in content or "v4l2loopback" in content:
                    device_num = path.split("/")[-2]
                    return f"/dev/{device_num}"
        except:
            pass
    return "/dev/video6"


def is_running():
    if os.path.exists(PID_FILE):
        try:
            with open(PID_FILE) as f:
                pid = int(f.read().strip())
            os.kill(pid, 0)
            return pid
        except (ProcessLookupError, ValueError, FileNotFoundError):
            pass
    return None


def get_current_config():
    config = {}
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE) as f:
                for line in f:
                    if "=" in line:
                        key, value = line.strip().split("=", 1)
                        config[key] = value
        except:
            pass
    return config


def get_available_cameras(serial=None):
    cameras = []
    try:
        cmd = ["scrcpy", "--video-source=camera", "--list-cameras"]
        if serial:
            cmd.append(f"--serial={serial}")
        result = subprocess.run(
            cmd,
            capture_output=True, text=True, timeout=10
        )
        output = result.stdout + result.stderr
        
        for line in output.split('\n'):
            match = re.search(r'--camera-id=(\d+)\s+\((\w+),\s*(\d+x\d+),\s*fps=\[([^\]]+)\]', line)
            if match:
                cam_id, facing, resolution, fps_list = match.groups()
                cameras.append({
                    'id': cam_id,
                    'facing': facing,
                    'resolution': resolution,
                    'fps': [f.strip() for f in fps_list.split(',')]
                })
    except Exception as e:
        pass
    return cameras


def get_device_status():
    """Get connected device info (USB or WiFi)"""
    try:
        result = subprocess.run(
            ["adb", "devices", "-l"],
            capture_output=True, text=True, timeout=5
        )
        lines = result.stdout.strip().split('\n')[1:]  # Skip header
        devices = []
        for line in lines:
            if line.strip():
                parts = line.split()
                if len(parts) >= 2:
                    serial = parts[0]
                    state = parts[1]
                    conn_type = "WiFi" if ":" in serial else "USB"
                    devices.append({
                        'serial': serial,
                        'state': state,
                        'type': conn_type
                    })
        return devices
    except:
        return []


def adb_connect(ip, port):
    """Connect to device via wireless debugging"""
    try:
        result = subprocess.run(
            ["adb", "connect", f"{ip}:{port}"],
            capture_output=True, text=True, timeout=10
        )
        output = result.stdout + result.stderr
        return "connected" in output.lower(), output.strip()
    except Exception as e:
        return False, str(e)


def adb_pair(ip, port, code):
    try:
        result = subprocess.run(
            ["adb", "pair", f"{ip}:{port}", code],
            capture_output=True, text=True, timeout=15
        )
        output = result.stdout + result.stderr
        success = "success" in output.lower() or "paired" in output.lower()
        return success, output.strip()
    except Exception as e:
        return False, str(e)


def adb_disconnect():
    """Disconnect all wireless devices"""
    try:
        result = subprocess.run(
            ["adb", "disconnect"],
            capture_output=True, text=True, timeout=5
        )
        return True, result.stdout.strip()
    except Exception as e:
        return False, str(e)


class CameraTUI(App):
    CSS = """
    Screen {
        layout: vertical;
    }
    #title {
        text-align: center;
        text-style: bold;
        padding: 1;
    }
    .status-box {
        height: auto;
        border: solid cyan;
        margin: 1;
        padding: 1;
    }
    .device-box {
        height: auto;
        border: solid yellow;
        margin: 1;
        padding: 1;
    }
    .cameras-box {
        height: auto;
        border: solid magenta;
        margin: 1;
        padding: 1;
    }
    .box {
        height: auto;
        border: solid green;
        margin: 1;
        padding: 1;
    }
    .controls {
        height: auto;
        align: center middle;
    }
    .input-row {
        height: 3;
        margin: 1;
    }
    .form-row {
        height: 3;
        margin: 0 1;
    }
    Button {
        margin: 1;
    }
    Input {
        width: 100%;
    }
    Log {
        height: 1fr;
        border: solid blue;
        margin: 1;
    }
    TabPane {
        height: auto;
        padding: 1;
    }
    ContentSwitcher {
        height: auto;
    }
    #pair_section {
        height: auto;
        border: solid green;
        padding: 1;
        margin: 1;
    }
    #connect_section {
        height: auto;
        border: solid cyan;
        padding: 1;
        margin: 1;
    }
    #qr_section {
        height: auto;
        border: solid magenta;
        padding: 1;
        margin: 1;
    }
    """

    BINDINGS = [
        Binding("r", "refresh", "Refresh"),
        Binding("q", "quit", "Quit"),
    ]

    scrcpy_process = None
    available_cameras = []

    def compose(self) -> ComposeResult:
        yield Header()
        yield Container(
            Static("PopDroidCam - Android Webcam", id="title"),
            Container(
                Static("Device: Checking...", id="device_label"),
                classes="device-box"
            ),
            Container(
                Static("Stream: Checking...", id="status_label"),
                classes="status-box"
            ),
        )
        with TabbedContent():
            with TabPane("Camera", id="camera_tab"):
                yield Static("[bold]Device:[/bold]")
                yield Select([], id="device_select", prompt="Select device...")
                yield Button("Refresh Devices", variant="primary", id="refresh_devices")
                yield Static("")
                yield Container(
                    Static("Available Cameras: Click 'Detect Cameras' after selecting device", id="cameras_label"),
                    classes="cameras-box"
                )
                yield Static("[bold]Camera Settings:[/bold]")
                yield Static("Camera (back/front):")
                yield Select.from_values(["back", "front"], value="back", id="camera_select")
                yield Static("Camera ID (for specific lens - leave empty for default):")
                yield Input(placeholder="e.g. 0, 1, 2 (see Detect Cameras)", id="camera_id")
                yield Static("Resolution:")
                yield Select.from_values(
                    ["1920x1080", "3840x2160", "1280x720", "4080x3060", "3264x2448", "custom"],
                    value="1920x1080",
                    id="res_select"
                )
                yield Static("Custom Resolution:", id="custom_res_label")
                yield Input(placeholder="e.g. 4080x3060", id="custom_res")
                yield Static("FPS:")
                yield Select.from_values(["10", "15", "20", "24", "30"], value="30", id="fps_select")
                yield Horizontal(
                    Button("Start Stream", variant="success", id="start"),
                    Button("Stop Stream", variant="error", id="stop"),
                    Button("Detect Cameras", variant="warning", id="detect"),
                    classes="controls"
                )
            with TabPane("Connect", id="connect_tab"):
                yield Static("[bold]Wireless Connection[/bold] - Connect to phone over WiFi")
                yield Vertical(
                    Static("[cyan]QR Code Pairing (Easiest)[/cyan]"),
                    Static("Run in terminal: [bold]popdroidcam qr[/bold]"),
                    Static("Then scan with phone: Wireless debugging → Pair with QR code"),
                    id="qr_section"
                )
                yield Vertical(
                    Static("[cyan]Manual Pairing[/cyan]"),
                    Static("Phone: Settings → Developer Options → Wireless debugging → Pair device"),
                    Static("IP Address:"),
                    Input(placeholder="192.168.1.100", id="pair_ip"),
                    Static("Pairing Port:"),
                    Input(placeholder="37123", id="pair_port"),
                    Static("Pairing Code:"),
                    Input(placeholder="123456", id="pair_code"),
                    Button("Pair", variant="warning", id="pair_btn"),
                    id="pair_section"
                )
                yield Vertical(
                    Static("[cyan]Connect (after pairing)[/cyan]"),
                    Static("Use IP:Port from Wireless debugging main screen"),
                    Static("IP Address:"),
                    Input(placeholder="192.168.1.100", id="connect_ip"),
                    Static("Connection Port:"),
                    Input(placeholder="41255", id="connect_port"),
                    Horizontal(
                        Button("Connect", variant="success", id="connect_btn"),
                        Button("Disconnect", variant="error", id="disconnect_btn"),
                    ),
                    id="connect_section"
                )
        yield Log(id="log")
        yield Footer()

    def on_mount(self) -> None:
        self.update_status()
        self.refresh_devices()
        self.log_message("Ready. Connect phone via USB or WiFi.")
        self.log_message("For WiFi: Go to 'Connect' tab or run 'popdroidcam qr'")
        self.query_one("#custom_res_label", Static).display = False
        self.query_one("#custom_res", Input).display = False

    def on_select_changed(self, event: Select.Changed) -> None:
        if event.select.id == "res_select":
            custom_label = self.query_one("#custom_res_label", Static)
            custom_input = self.query_one("#custom_res", Input)
            if event.value == "custom":
                custom_label.display = True
                custom_input.display = True
                self.log_message("Enter custom resolution in WIDTHxHEIGHT format")
            else:
                custom_label.display = False
                custom_input.display = False

    def action_refresh(self) -> None:
        self.update_status()
        self.log_message("Status refreshed.")

    def update_status(self):
        device_label = self.query_one("#device_label", Static)
        status_label = self.query_one("#status_label", Static)
        start_btn = self.query_one("#start", Button)
        stop_btn = self.query_one("#stop", Button)

        devices = get_device_status()
        if devices:
            connected = [d for d in devices if d['state'] == 'device']
            if connected:
                dev = connected[0]
                device_label.update(f"Device: [green]● Connected ({dev['type']})[/green] - {dev['serial']}")
            else:
                unauthorized = [d for d in devices if d['state'] == 'unauthorized']
                if unauthorized:
                    device_label.update("Device: [yellow]● Unauthorized[/yellow] - Accept prompt on phone")
                else:
                    device_label.update("Device: [red]● Not connected[/red]")
        else:
            device_label.update("Device: [red]● Not connected[/red]")

        pid = is_running()
        if pid:
            config = get_current_config()
            res = config.get("res", "unknown")
            fps = config.get("fps", "unknown")
            camera = config.get("camera", "unknown")
            status_label.update(f"Stream: [green]● Running[/green] (PID: {pid}) | {camera} @ {res} {fps}fps")
            start_btn.disabled = True
            stop_btn.disabled = False
        else:
            status_label.update("Stream: [red]● Stopped[/red]")
            start_btn.disabled = False
            stop_btn.disabled = True

    def detect_cameras(self):
        cameras_label = self.query_one("#cameras_label", Static)
        cameras_label.update("Detecting cameras...")
        self.log_message("Querying phone cameras...")
        
        device_select = self.query_one("#device_select", Select)
        selected_device = device_select.value
        serial = selected_device if selected_device and selected_device != Select.BLANK else None
        
        self.available_cameras = get_available_cameras(serial)
        
        if self.available_cameras:
            lines = ["[bold]Available Cameras:[/bold]"]
            for cam in self.available_cameras:
                lines.append(f"  • {cam['facing'].capitalize()} (id={cam['id']}): {cam['resolution']} @ {', '.join(cam['fps'])} fps")
            cameras_label.update("\n".join(lines))
            
            res_select = self.query_one("#res_select", Select)
            resolutions = list(set([cam['resolution'] for cam in self.available_cameras]))
            resolutions.extend(["1920x1080", "1280x720", "custom"])
            
            self.log_message(f"Found {len(self.available_cameras)} camera(s)")
            for cam in self.available_cameras:
                self.log_message(f"  {cam['facing']}: {cam['resolution']} fps={cam['fps']}")
        else:
            cameras_label.update("No cameras detected. Is phone connected?")
            self.log_message("Could not detect cameras. Check USB connection.")

    def on_button_pressed(self, event: Button.Pressed) -> None:
        if event.button.id == "start":
            self.start_stream()
        elif event.button.id == "stop":
            self.stop_stream()
        elif event.button.id == "refresh":
            self.update_status()
            self.log_message("Status refreshed.")
        elif event.button.id == "detect":
            self.detect_cameras()
        elif event.button.id == "pair_btn":
            self.do_pair()
        elif event.button.id == "connect_btn":
            self.do_connect()
        elif event.button.id == "disconnect_btn":
            self.do_disconnect()
        elif event.button.id == "refresh_devices":
            self.refresh_devices()

    def do_pair(self):
        ip = self.query_one("#pair_ip", Input).value.strip()
        port = self.query_one("#pair_port", Input).value.strip()
        code = self.query_one("#pair_code", Input).value.strip()
        
        if not ip or not port or not code:
            self.log_message("Error: Fill in IP, Port, and Code for pairing")
            return
        
        self.log_message(f"Pairing with {ip}:{port}...")
        success, output = adb_pair(ip, port, code)
        
        if success:
            self.log_message(f"[green]✓ Paired successfully![/green]")
            self.log_message("Now enter the connection port and click Connect")
            self.query_one("#connect_ip", Input).value = ip
        else:
            self.log_message(f"[red]✗ Pairing failed: {output}[/red]")
        
        self.update_status()

    def do_connect(self):
        ip = self.query_one("#connect_ip", Input).value.strip()
        port = self.query_one("#connect_port", Input).value.strip()
        
        if not ip or not port:
            self.log_message("Error: Fill in IP and Port to connect")
            return
        
        self.log_message(f"Connecting to {ip}:{port}...")
        success, output = adb_connect(ip, port)
        
        if success:
            self.log_message(f"[green]✓ Connected to {ip}:{port}[/green]")
            self.log_message("You can now use the Camera tab to start streaming")
        else:
            self.log_message(f"[red]✗ Connection failed: {output}[/red]")
        
        self.update_status()

    def do_disconnect(self):
        self.log_message("Disconnecting...")
        success, output = adb_disconnect()
        self.log_message("[green]✓ Disconnected all wireless devices[/green]")
        self.update_status()

    def refresh_devices(self):
        device_select = self.query_one("#device_select", Select)
        devices = get_device_status()
        connected = [d for d in devices if d['state'] == 'device']
        
        if connected:
            options = [(f"{d['serial']} ({d['type']})", d['serial']) for d in connected]
            device_select.set_options(options)
            if options:
                device_select.value = options[0][1]
            self.log_message(f"Found {len(connected)} device(s)")
        else:
            device_select.set_options([])
            self.log_message("No devices connected. Connect via USB or WiFi.")

    def start_stream(self):
        if is_running():
            self.log_message("Stream already running!")
            self.update_status()
            return

        device_select = self.query_one("#device_select", Select)
        selected_device = device_select.value
        camera = self.query_one("#camera_select", Select).value
        camera_id = self.query_one("#camera_id", Input).value.strip()
        res_select = self.query_one("#res_select", Select).value
        fps = self.query_one("#fps_select", Select).value

        if res_select == "custom":
            res = self.query_one("#custom_res", Input).value.strip()
            if not re.match(r'^\d+x\d+$', res):
                self.log_message("Invalid resolution format. Use WIDTHxHEIGHT (e.g. 4080x3060)")
                return
        else:
            res = res_select

        v4l2_device = find_v4l2loopback_device()
        self.log_message(f"Using v4l2 device: {v4l2_device}")

        cmd = [
            "scrcpy",
            "--video-source=camera",
            f"--camera-size={res}",
            f"--camera-fps={fps}",
            f"--v4l2-sink={v4l2_device}",
            "--no-window",
            "--no-audio"
        ]

        if camera_id:
            cmd.append(f"--camera-id={camera_id}")
            self.log_message(f"Using camera ID: {camera_id}")
        else:
            cmd.append(f"--camera-facing={camera}")

        if selected_device and selected_device != Select.BLANK:
            cmd.append(f"--serial={selected_device}")
            self.log_message(f"Using Android device: {selected_device}")

        self.log_message(f"Starting: {' '.join(cmd)}")

        try:
            os.makedirs(STATE_DIR, exist_ok=True)
            log_file = open(os.path.join(STATE_DIR, "scrcpy.log"), "w")

            self.scrcpy_process = subprocess.Popen(
                cmd,
                stdout=log_file,
                stderr=log_file,
                preexec_fn=os.setsid
            )

            with open(PID_FILE, "w") as f:
                f.write(str(self.scrcpy_process.pid))

            with open(CONFIG_FILE, "w") as f:
                f.write(f"res={res}\n")
                f.write(f"fps={fps}\n")
                f.write(f"camera={camera}\n")
                f.write(f"device={v4l2_device}\n")

            self.log_message(f"Stream started! PID: {self.scrcpy_process.pid}")
            self.log_message("Select 'Android Cam' in your video apps.")
            self.update_status()

        except Exception as e:
            self.log_message(f"Error: {e}")

    def stop_stream(self):
        pid = is_running()
        if pid:
            self.log_message(f"Stopping stream (PID: {pid})...")
            try:
                os.killpg(os.getpgid(pid), signal.SIGTERM)
            except ProcessLookupError:
                pass
            except PermissionError:
                os.kill(pid, signal.SIGTERM)

            if os.path.exists(PID_FILE):
                os.remove(PID_FILE)

            self.log_message("Stream stopped.")
        else:
            self.log_message("No stream running.")

        self.scrcpy_process = None
        self.update_status()

    def log_message(self, message: str):
        log = self.query_one("#log", Log)
        log.write_line(message)


if __name__ == "__main__":
    app = CameraTUI()
    app.run()
