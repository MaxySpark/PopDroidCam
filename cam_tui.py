from textual.app import App, ComposeResult
from textual.containers import Horizontal, Vertical, VerticalScroll
from textual.widgets import Header, Footer, Button, Select, Static, Log, Input, TabbedContent, TabPane
from textual.binding import Binding
from textual import work
import subprocess
import os
import signal
import glob
import re

STATE_DIR = os.path.expanduser("~/.local/state/popdroidcam")
PID_FILE = os.path.join(STATE_DIR, "pid")
CONFIG_FILE = os.path.join(STATE_DIR, "config")

# Resolutions that work well with hardware encoders (prioritized)
PREFERRED_RESOLUTIONS = ["1920x1080", "1280x720", "1920x1440", "2560x1440", "3840x2160"]


def find_v4l2loopback_device():
    for path in glob.glob("/sys/devices/virtual/video4linux/video*/name"):
        try:
            with open(path) as f:
                if "Android" in f.read() or "v4l2loopback" in f.read():
                    return f"/dev/{path.split('/')[-2]}"
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
        except:
            pass
    return None


def get_current_config():
    config = {}
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE) as f:
                for line in f:
                    if "=" in line:
                        k, v = line.strip().split("=", 1)
                        config[k] = v
        except:
            pass
    return config


def get_camera_sizes(serial=None):
    """Get all cameras with their supported resolutions"""
    cameras = {}
    try:
        cmd = ["scrcpy", "--video-source=camera", "--list-camera-sizes"]
        if serial:
            cmd.append(f"--serial={serial}")
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
        output = result.stdout + result.stderr
        
        current_id = None
        for line in output.split('\n'):
            # Header: --camera-id=0    (back, 4080x3060, fps=[10, 15, 20, 24, 30])
            m = re.search(r'--camera-id=(\d+)\s+\((\w+),\s*\d+x\d+,\s*fps=\[([^\]]+)\]', line)
            if m:
                current_id = m.group(1)
                cameras[current_id] = {
                    'facing': m.group(2),
                    'fps': [f.strip() for f in m.group(3).split(',')],
                    'resolutions': []
                }
            elif current_id:
                res_match = re.match(r'\s+-\s*(\d+x\d+)', line)
                if res_match:
                    cameras[current_id]['resolutions'].append(res_match.group(1))
    except:
        pass
    return cameras


def get_devices():
    """Get connected ADB devices"""
    try:
        result = subprocess.run(["adb", "devices", "-l"], capture_output=True, text=True, timeout=5)
        devices = []
        for line in result.stdout.strip().split('\n')[1:]:
            if line.strip():
                parts = line.split()
                if len(parts) >= 2:
                    serial, state = parts[0], parts[1]
                    devices.append({
                        'serial': serial,
                        'state': state,
                        'type': "WiFi" if ":" in serial else "USB"
                    })
        return devices
    except:
        return []


def adb_connect(ip, port):
    try:
        result = subprocess.run(["adb", "connect", f"{ip}:{port}"], capture_output=True, text=True, timeout=10)
        return "connected" in (result.stdout + result.stderr).lower()
    except:
        return False


def adb_pair(ip, port, code):
    try:
        result = subprocess.run(["adb", "pair", f"{ip}:{port}", code], capture_output=True, text=True, timeout=15)
        out = result.stdout + result.stderr
        return "success" in out.lower() or "paired" in out.lower()
    except:
        return False


def adb_disconnect():
    try:
        subprocess.run(["adb", "disconnect"], capture_output=True, timeout=5)
    except:
        pass


class PopDroidCamTUI(App):
    TITLE = "PopDroidCam"
    CSS = """
    Screen { layout: vertical; }
    
    #status_bar { height: 1; background: $surface; padding: 0 1; }
    #status_bar Static { width: 1fr; }
    
    TabbedContent { height: 1fr; }
    TabPane { padding: 1; }
    
    .row { height: 3; }
    .row Static { width: 10; padding: 1 0 0 0; }
    .row Select, .row Input { width: 1fr; }
    .row Button { width: auto; min-width: 8; margin-left: 1; }
    
    #cam_info { height: 3; padding: 0 1; color: $text-muted; }
    
    .buttons { height: 3; margin-top: 1; }
    .buttons Button { margin-right: 1; }
    
    #log { height: 5; border: solid $primary; }
    
    .section { border: solid $surface-lighten-1; padding: 1; margin-bottom: 1; }
    .section .title { text-style: bold; }
    .conn-row { height: 3; }
    .conn-row Static { width: 6; padding: 1 0 0 0; }
    .conn-row Input { width: 1fr; }
    .conn-row Button { margin-left: 1; }
    """

    BINDINGS = [
        Binding("r", "refresh", "Refresh"),
        Binding("q", "quit", "Quit"),
    ]

    cameras = {}
    current_device = None

    def compose(self) -> ComposeResult:
        yield Header()
        
        with Horizontal(id="status_bar"):
            yield Static("", id="device_status")
            yield Static("", id="stream_status")
        
        with TabbedContent():
            with TabPane("Camera", id="cam_tab"):
                with Horizontal(classes="row"):
                    yield Static("Device:")
                    yield Select([], id="device_sel", prompt="No device")
                
                with Horizontal(classes="row"):
                    yield Static("Camera:")
                    yield Select([], id="cam_sel", prompt="No camera")
                
                with Horizontal(classes="row"):
                    yield Static("Resolution:")
                    yield Select([], id="res_sel", prompt="--")
                
                with Horizontal(classes="row"):
                    yield Static("FPS:")
                    yield Select([], id="fps_sel", prompt="--")
                
                yield Static("", id="cam_info")
                
                with Horizontal(classes="buttons"):
                    yield Button("▶ Start", variant="success", id="start_btn")
                    yield Button("■ Stop", variant="error", id="stop_btn")
                    yield Button("↻ Refresh", id="refresh_btn")
            
            with TabPane("Connect", id="conn_tab"):
                with VerticalScroll():
                    with Vertical(classes="section"):
                        yield Static("QR Pairing (Easiest)", classes="title")
                        yield Static("Run: popdroidcam qr")
                    
                    with Vertical(classes="section"):
                        yield Static("Manual Pair", classes="title")
                        with Horizontal(classes="conn-row"):
                            yield Static("IP:")
                            yield Input(placeholder="192.168.1.x", id="pair_ip")
                        with Horizontal(classes="conn-row"):
                            yield Static("Port:")
                            yield Input(placeholder="37xxx", id="pair_port")
                        with Horizontal(classes="conn-row"):
                            yield Static("Code:")
                            yield Input(placeholder="123456", id="pair_code")
                            yield Button("Pair", variant="warning", id="pair_btn")
                    
                    with Vertical(classes="section"):
                        yield Static("Connect", classes="title")
                        with Horizontal(classes="conn-row"):
                            yield Static("IP:")
                            yield Input(placeholder="192.168.1.x", id="conn_ip")
                        with Horizontal(classes="conn-row"):
                            yield Static("Port:")
                            yield Input(placeholder="5555", id="conn_port")
                            yield Button("Connect", variant="success", id="conn_btn")
                        with Horizontal(classes="conn-row"):
                            yield Button("Disconnect All", variant="error", id="disc_btn")
        
        yield Log(id="log")
        yield Footer()

    def on_mount(self) -> None:
        self.log_msg("Starting PopDroidCam...")
        self.init_detect()

    @work(thread=True)
    def init_detect(self) -> None:
        """Auto-detect devices and cameras on startup"""
        self.call_from_thread(self.log_msg, "Detecting devices...")
        devices = get_devices()
        connected = [d for d in devices if d['state'] == 'device']
        
        if connected:
            self.current_device = connected[0]['serial']
            self.call_from_thread(self.update_device_list, connected)
            self.call_from_thread(self.log_msg, f"Found {len(connected)} device(s)")
            
            # Detect cameras
            self.call_from_thread(self.log_msg, "Detecting cameras...")
            self.cameras = get_camera_sizes(self.current_device)
            
            if self.cameras:
                self.call_from_thread(self.update_camera_list)
                self.call_from_thread(self.log_msg, f"Found {len(self.cameras)} camera(s). Ready!")
            else:
                self.call_from_thread(self.log_msg, "No cameras found")
        else:
            self.call_from_thread(self.log_msg, "No device connected. Use Connect tab or plug in USB.")
        
        self.call_from_thread(self.update_status)

    def update_device_list(self, devices):
        sel = self.query_one("#device_sel", Select)
        opts = [(f"{d['serial'][:20]} ({d['type']})", d['serial']) for d in devices]
        sel.set_options(opts)
        if opts:
            sel.value = opts[0][1]

    def update_camera_list(self):
        sel = self.query_one("#cam_sel", Select)
        opts = [(f"{cid}: {c['facing']}", cid) for cid, c in self.cameras.items()]
        sel.set_options(opts)
        if opts:
            sel.value = opts[0][1]
            self.update_resolution_list(opts[0][1])

    def update_resolution_list(self, cam_id):
        if cam_id not in self.cameras:
            return
        
        cam = self.cameras[cam_id]
        resolutions = cam['resolutions']
        
        # Sort: preferred first, then by size descending
        preferred = [r for r in PREFERRED_RESOLUTIONS if r in resolutions]
        others = [r for r in resolutions if r not in PREFERRED_RESOLUTIONS]
        sorted_res = preferred + others
        
        res_sel = self.query_one("#res_sel", Select)
        res_sel.set_options([(r, r) for r in sorted_res])
        if "1920x1080" in sorted_res:
            res_sel.value = "1920x1080"
        elif sorted_res:
            res_sel.value = sorted_res[0]
        
        # Update FPS
        fps_sel = self.query_one("#fps_sel", Select)
        fps_list = cam.get('fps', ['30'])
        fps_sel.set_options([(f, f) for f in fps_list])
        fps_sel.value = "30" if "30" in fps_list else fps_list[0] if fps_list else "30"
        
        # Update info
        info = self.query_one("#cam_info", Static)
        info.update(f"{cam['facing']} camera • {len(resolutions)} resolutions • fps: {', '.join(fps_list)}")

    def update_status(self):
        dev_status = self.query_one("#device_status", Static)
        stream_status = self.query_one("#stream_status", Static)
        start_btn = self.query_one("#start_btn", Button)
        stop_btn = self.query_one("#stop_btn", Button)
        
        # Device status
        devices = get_devices()
        connected = [d for d in devices if d['state'] == 'device']
        if connected:
            d = connected[0]
            dev_status.update(f"[green]●[/green] {d['type']}: {d['serial'][:18]}")
        else:
            unauth = [d for d in devices if d['state'] == 'unauthorized']
            if unauth:
                dev_status.update("[yellow]●[/yellow] Unauthorized - check phone")
            else:
                dev_status.update("[red]●[/red] No device")
        
        # Stream status
        pid = is_running()
        if pid:
            cfg = get_current_config()
            stream_status.update(f"[green]●[/green] Streaming {cfg.get('res', '?')} @ {cfg.get('fps', '?')}fps")
            start_btn.disabled = True
            stop_btn.disabled = False
        else:
            stream_status.update("[dim]● Stopped[/dim]")
            start_btn.disabled = False
            stop_btn.disabled = True

    def on_select_changed(self, event: Select.Changed) -> None:
        if event.select.id == "cam_sel" and event.value and event.value != Select.BLANK:
            self.update_resolution_list(str(event.value))
        elif event.select.id == "device_sel" and event.value and event.value != Select.BLANK:
            self.current_device = str(event.value)
            self.refresh_cameras()

    @work(thread=True)
    def refresh_cameras(self):
        self.call_from_thread(self.log_msg, "Detecting cameras...")
        self.cameras = get_camera_sizes(self.current_device)
        if self.cameras:
            self.call_from_thread(self.update_camera_list)
            self.call_from_thread(self.log_msg, f"Found {len(self.cameras)} camera(s)")
        else:
            self.call_from_thread(self.log_msg, "No cameras detected")

    def action_refresh(self) -> None:
        self.do_refresh()

    @work(thread=True)
    def do_refresh(self):
        self.call_from_thread(self.log_msg, "Refreshing...")
        devices = get_devices()
        connected = [d for d in devices if d['state'] == 'device']
        
        if connected:
            self.current_device = connected[0]['serial']
            self.call_from_thread(self.update_device_list, connected)
            self.cameras = get_camera_sizes(self.current_device)
            if self.cameras:
                self.call_from_thread(self.update_camera_list)
        
        self.call_from_thread(self.update_status)
        self.call_from_thread(self.log_msg, "Refreshed")

    def on_button_pressed(self, event: Button.Pressed) -> None:
        btn = event.button.id
        if btn == "start_btn":
            self.start_stream()
        elif btn == "stop_btn":
            self.stop_stream()
        elif btn == "refresh_btn":
            self.do_refresh()
        elif btn == "pair_btn":
            self.do_pair()
        elif btn == "conn_btn":
            self.do_connect()
        elif btn == "disc_btn":
            self.do_disconnect()

    def start_stream(self):
        if is_running():
            self.log_msg("Already running!")
            return
        
        cam_sel = self.query_one("#cam_sel", Select)
        res_sel = self.query_one("#res_sel", Select)
        fps_sel = self.query_one("#fps_sel", Select)
        
        cam_id = cam_sel.value if cam_sel.value != Select.BLANK else None
        res = res_sel.value if res_sel.value != Select.BLANK else "1920x1080"
        fps = fps_sel.value if fps_sel.value != Select.BLANK else "30"
        
        if not cam_id:
            self.log_msg("[red]No camera selected[/red]")
            return
        
        v4l2 = find_v4l2loopback_device()
        cmd = [
            "scrcpy", "--video-source=camera",
            f"--camera-id={cam_id}",
            f"--camera-size={res}",
            f"--camera-fps={fps}",
            f"--v4l2-sink={v4l2}",
            "--no-window", "--no-audio"
        ]
        if self.current_device:
            cmd.append(f"--serial={self.current_device}")
        
        self.log_msg(f"Starting camera {cam_id} @ {res} {fps}fps...")
        
        try:
            os.makedirs(STATE_DIR, exist_ok=True)
            log_file = open(os.path.join(STATE_DIR, "scrcpy.log"), "w")
            proc = subprocess.Popen(cmd, stdout=log_file, stderr=log_file, preexec_fn=os.setsid)
            
            with open(PID_FILE, "w") as f:
                f.write(str(proc.pid))
            with open(CONFIG_FILE, "w") as f:
                f.write(f"res={res}\nfps={fps}\ncamera_id={cam_id}\ndevice={v4l2}\n")
            
            self.log_msg("[green]Started! Select 'Android Cam' in apps[/green]")
            self.update_status()
        except Exception as e:
            self.log_msg(f"[red]Error: {e}[/red]")

    def stop_stream(self):
        pid = is_running()
        if pid:
            try:
                os.killpg(os.getpgid(pid), signal.SIGTERM)
            except:
                try:
                    os.kill(pid, signal.SIGTERM)
                except:
                    pass
            if os.path.exists(PID_FILE):
                os.remove(PID_FILE)
            self.log_msg("Stopped")
        else:
            self.log_msg("Not running")
        self.update_status()

    def do_pair(self):
        ip = self.query_one("#pair_ip", Input).value.strip()
        port = self.query_one("#pair_port", Input).value.strip()
        code = self.query_one("#pair_code", Input).value.strip()
        
        if not all([ip, port, code]):
            self.log_msg("[red]Fill all pairing fields[/red]")
            return
        
        self.log_msg(f"Pairing {ip}:{port}...")
        if adb_pair(ip, port, code):
            self.log_msg("[green]Paired! Now connect below[/green]")
            self.query_one("#conn_ip", Input).value = ip
        else:
            self.log_msg("[red]Pairing failed[/red]")

    def do_connect(self):
        ip = self.query_one("#conn_ip", Input).value.strip()
        port = self.query_one("#conn_port", Input).value.strip()
        
        if not ip or not port:
            self.log_msg("[red]Fill IP and port[/red]")
            return
        
        self.log_msg(f"Connecting {ip}:{port}...")
        if adb_connect(ip, port):
            self.log_msg("[green]Connected![/green]")
            self.do_refresh()
        else:
            self.log_msg("[red]Connection failed[/red]")

    def do_disconnect(self):
        adb_disconnect()
        self.log_msg("Disconnected")
        self.do_refresh()

    def log_msg(self, msg: str):
        self.query_one("#log", Log).write_line(msg)


if __name__ == "__main__":
    PopDroidCamTUI().run()
