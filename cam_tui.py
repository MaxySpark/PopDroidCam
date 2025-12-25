from textual.app import App, ComposeResult
from textual.containers import Container, Horizontal, Vertical, VerticalScroll
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
    
    #status_bar {
        height: 3;
        padding: 0 1;
        background: $surface;
        border-bottom: solid $primary;
    }
    
    #status_bar Static {
        width: 1fr;
    }
    
    TabbedContent {
        height: 1fr;
    }
    
    TabPane {
        padding: 0 1;
    }
    
    .form-row {
        height: 3;
        margin: 0;
    }
    
    .form-row Static {
        width: 15;
        padding: 1 1 0 0;
    }
    
    .form-row Select {
        width: 1fr;
    }
    
    .form-row Input {
        width: 1fr;
    }
    
    .form-row Button {
        width: auto;
        min-width: 12;
        margin: 0 0 0 1;
    }
    
    #cameras_info {
        height: auto;
        max-height: 6;
        border: solid $secondary;
        padding: 0 1;
        margin: 1 0;
    }
    
    .btn-row {
        height: 3;
        margin: 1 0;
        align: center middle;
    }
    
    .btn-row Button {
        margin: 0 1;
    }
    
    #custom_res_row {
        height: 3;
    }
    
    #log {
        height: 8;
        border: solid $accent;
        margin: 0;
    }
    
    /* Connect tab */
    .section {
        height: auto;
        border: solid $primary;
        padding: 1;
        margin: 0 0 1 0;
    }
    
    .section-title {
        text-style: bold;
        margin-bottom: 1;
    }
    
    .connect-row {
        height: 3;
    }
    
    .connect-row Static {
        width: 12;
        padding: 1 1 0 0;
    }
    
    .connect-row Input {
        width: 1fr;
    }
    
    .connect-btn-row {
        height: 3;
        margin-top: 1;
    }
    
    .connect-btn-row Button {
        margin-right: 1;
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
        
        # Compact status bar
        with Horizontal(id="status_bar"):
            yield Static("Device: Checking...", id="device_label")
            yield Static("Stream: Checking...", id="status_label")
        
        with TabbedContent():
            with TabPane("Camera", id="camera_tab"):
                # Device row
                with Horizontal(classes="form-row"):
                    yield Static("Device:")
                    yield Select([], id="device_select", prompt="Select device...")
                    yield Button("Refresh", id="refresh_devices")
                
                # Camera info (collapsible area)
                yield Static("Cameras: Click 'Detect' after selecting device", id="cameras_info")
                
                # Camera + ID row
                with Horizontal(classes="form-row"):
                    yield Static("Camera:")
                    yield Select.from_values(["back", "front"], value="back", id="camera_select")
                    yield Static("ID:", classes="short-label")
                    yield Input(placeholder="0,1,2...", id="camera_id")
                    yield Button("Detect", id="detect")
                
                # Resolution + FPS row
                with Horizontal(classes="form-row"):
                    yield Static("Resolution:")
                    yield Select.from_values(
                        ["1920x1080", "1280x720", "3840x2160", "custom"],
                        value="1920x1080",
                        id="res_select"
                    )
                    yield Static("FPS:")
                    yield Select.from_values(["30", "24", "20", "15", "10"], value="30", id="fps_select")
                
                # Custom resolution row (hidden by default)
                with Horizontal(classes="form-row", id="custom_res_row"):
                    yield Static("Custom:")
                    yield Input(placeholder="WIDTHxHEIGHT (e.g. 4080x3060)", id="custom_res")
                
                # Action buttons
                with Horizontal(classes="btn-row"):
                    yield Button("Start Stream", variant="success", id="start")
                    yield Button("Stop Stream", variant="error", id="stop")
                
            with TabPane("Connect", id="connect_tab"):
                with VerticalScroll():
                    # QR Section
                    with Vertical(classes="section"):
                        yield Static("[cyan]QR Code Pairing (Easiest)[/cyan]", classes="section-title")
                        yield Static("Run: [bold]popdroidcam qr[/bold] then scan with phone")
                    
                    # Manual Pair Section
                    with Vertical(classes="section"):
                        yield Static("[cyan]Manual Pairing[/cyan]", classes="section-title")
                        yield Static("Phone: Developer Options > Wireless debugging > Pair device")
                        with Horizontal(classes="connect-row"):
                            yield Static("IP:")
                            yield Input(placeholder="192.168.1.100", id="pair_ip")
                            yield Static("Port:")
                            yield Input(placeholder="37123", id="pair_port")
                        with Horizontal(classes="connect-row"):
                            yield Static("Code:")
                            yield Input(placeholder="123456", id="pair_code")
                        with Horizontal(classes="connect-btn-row"):
                            yield Button("Pair", variant="warning", id="pair_btn")
                    
                    # Connect Section
                    with Vertical(classes="section"):
                        yield Static("[cyan]Connect (after pairing)[/cyan]", classes="section-title")
                        yield Static("Use IP:Port from Wireless debugging main screen")
                        with Horizontal(classes="connect-row"):
                            yield Static("IP:")
                            yield Input(placeholder="192.168.1.100", id="connect_ip")
                            yield Static("Port:")
                            yield Input(placeholder="41255", id="connect_port")
                        with Horizontal(classes="connect-btn-row"):
                            yield Button("Connect", variant="success", id="connect_btn")
                            yield Button("Disconnect", variant="error", id="disconnect_btn")
        
        yield Log(id="log")
        yield Footer()

    def on_mount(self) -> None:
        self.update_status()
        self.refresh_devices()
        self.log_message("Ready. Connect phone via USB or WiFi.")
        self.log_message("For WiFi: Go to 'Connect' tab or run 'popdroidcam qr'")
        # Hide custom resolution row by default
        self.query_one("#custom_res_row").display = False

    def on_select_changed(self, event: Select.Changed) -> None:
        if event.select.id == "res_select":
            custom_row = self.query_one("#custom_res_row")
            if event.value == "custom":
                custom_row.display = True
                self.log_message("Enter custom resolution (WIDTHxHEIGHT)")
            else:
                custom_row.display = False

    def action_refresh(self) -> None:
        self.update_status()
        self.refresh_devices()
        self.log_message("Refreshed.")

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
                device_label.update(f"Device: [green]●[/green] {dev['type']} - {dev['serial'][:20]}")
            else:
                unauthorized = [d for d in devices if d['state'] == 'unauthorized']
                if unauthorized:
                    device_label.update("Device: [yellow]●[/yellow] Unauthorized")
                else:
                    device_label.update("Device: [red]●[/red] Not connected")
        else:
            device_label.update("Device: [red]●[/red] Not connected")

        pid = is_running()
        if pid:
            config = get_current_config()
            res = config.get("res", "?")
            fps = config.get("fps", "?")
            status_label.update(f"Stream: [green]●[/green] Running ({res}@{fps}fps)")
            start_btn.disabled = True
            stop_btn.disabled = False
        else:
            status_label.update("Stream: [red]●[/red] Stopped")
            start_btn.disabled = False
            stop_btn.disabled = True

    def detect_cameras(self):
        cameras_info = self.query_one("#cameras_info", Static)
        cameras_info.update("Detecting cameras...")
        self.log_message("Querying phone cameras...")
        
        device_select = self.query_one("#device_select", Select)
        selected_device = device_select.value
        serial = selected_device if selected_device and selected_device != Select.BLANK else None
        
        self.available_cameras = get_available_cameras(serial)
        
        if self.available_cameras:
            lines = []
            for cam in self.available_cameras:
                lines.append(f"[bold]id={cam['id']}[/bold] {cam['facing']} {cam['resolution']} fps={','.join(cam['fps'])}")
            cameras_info.update(" | ".join(lines))
            self.log_message(f"Found {len(self.available_cameras)} camera(s)")
        else:
            cameras_info.update("[red]No cameras detected. Is phone connected?[/red]")
            self.log_message("Could not detect cameras.")

    def on_button_pressed(self, event: Button.Pressed) -> None:
        btn_id = event.button.id
        if btn_id == "start":
            self.start_stream()
        elif btn_id == "stop":
            self.stop_stream()
        elif btn_id == "detect":
            self.detect_cameras()
        elif btn_id == "pair_btn":
            self.do_pair()
        elif btn_id == "connect_btn":
            self.do_connect()
        elif btn_id == "disconnect_btn":
            self.do_disconnect()
        elif btn_id == "refresh_devices":
            self.refresh_devices()
            self.update_status()

    def do_pair(self):
        ip = self.query_one("#pair_ip", Input).value.strip()
        port = self.query_one("#pair_port", Input).value.strip()
        code = self.query_one("#pair_code", Input).value.strip()
        
        if not ip or not port or not code:
            self.log_message("[red]Error: Fill IP, Port, and Code[/red]")
            return
        
        self.log_message(f"Pairing with {ip}:{port}...")
        success, output = adb_pair(ip, port, code)
        
        if success:
            self.log_message("[green]Paired! Now enter connection port and click Connect[/green]")
            self.query_one("#connect_ip", Input).value = ip
        else:
            self.log_message(f"[red]Pairing failed: {output}[/red]")
        
        self.update_status()

    def do_connect(self):
        ip = self.query_one("#connect_ip", Input).value.strip()
        port = self.query_one("#connect_port", Input).value.strip()
        
        if not ip or not port:
            self.log_message("[red]Error: Fill IP and Port[/red]")
            return
        
        self.log_message(f"Connecting to {ip}:{port}...")
        success, output = adb_connect(ip, port)
        
        if success:
            self.log_message(f"[green]Connected! Switch to Camera tab to start streaming[/green]")
            self.refresh_devices()
        else:
            self.log_message(f"[red]Connection failed: {output}[/red]")
        
        self.update_status()

    def do_disconnect(self):
        self.log_message("Disconnecting...")
        success, output = adb_disconnect()
        self.log_message("[green]Disconnected all wireless devices[/green]")
        self.refresh_devices()
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
                self.log_message("[red]Invalid resolution. Use WIDTHxHEIGHT (e.g. 1920x1080)[/red]")
                return
        else:
            res = res_select

        v4l2_device = find_v4l2loopback_device()

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
        else:
            cmd.append(f"--camera-facing={camera}")

        if selected_device and selected_device != Select.BLANK:
            cmd.append(f"--serial={selected_device}")

        self.log_message(f"Starting: {res}@{fps}fps...")

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

            self.log_message(f"[green]Stream started! Select 'Android Cam' in your apps.[/green]")
            self.update_status()

        except Exception as e:
            self.log_message(f"[red]Error: {e}[/red]")

    def stop_stream(self):
        pid = is_running()
        if pid:
            self.log_message(f"Stopping stream...")
            try:
                os.killpg(os.getpgid(pid), signal.SIGTERM)
            except ProcessLookupError:
                pass
            except PermissionError:
                os.kill(pid, signal.SIGTERM)

            if os.path.exists(PID_FILE):
                os.remove(PID_FILE)

            self.log_message("[green]Stream stopped.[/green]")
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
