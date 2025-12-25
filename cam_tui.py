from textual.app import App, ComposeResult
from textual.containers import Container, Horizontal, Vertical
from textual.widgets import Header, Footer, Button, Select, Static, Log, Input
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


def get_available_cameras():
    cameras = []
    try:
        result = subprocess.run(
            ["scrcpy", "--video-source=camera", "--list-cameras"],
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
        height: auto;
        align: center middle;
    }
    Button {
        margin: 1;
    }
    Input {
        width: 20;
        margin: 1;
    }
    Log {
        height: 1fr;
        border: solid blue;
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
                Static("Status: Checking...", id="status_label"),
                classes="status-box"
            ),
            Container(
                Static("Available Cameras: Detecting...", id="cameras_label"),
                classes="cameras-box"
            ),
            Horizontal(
                Select.from_values(["back", "front"], value="back", id="camera_select"),
                Select.from_values(
                    ["1920x1080", "3840x2160", "1280x720", "4080x3060", "3264x2448", "custom"],
                    value="1920x1080",
                    id="res_select"
                ),
                Select.from_values(["10", "15", "20", "24", "30", "60"], value="30", id="fps_select"),
                classes="controls box"
            ),
            Horizontal(
                Static("Custom resolution:", classes="label"),
                Input(placeholder="e.g. 4080x3060", id="custom_res"),
                classes="input-row"
            ),
            Horizontal(
                Button("Start Stream", variant="success", id="start"),
                Button("Stop Stream", variant="error", id="stop"),
                Button("Detect Cameras", variant="warning", id="detect"),
                Button("Refresh", variant="primary", id="refresh"),
                classes="controls"
            ),
            Log(id="log"),
        )
        yield Footer()

    def on_mount(self) -> None:
        self.update_status()
        self.log_message("Ready. Connect phone with USB debugging enabled.")
        self.log_message("Press 'Detect Cameras' to see available options.")
        self.query_one("#custom_res", Input).display = False

    def on_select_changed(self, event: Select.Changed) -> None:
        if event.select.id == "res_select":
            custom_input = self.query_one("#custom_res", Input)
            if event.value == "custom":
                custom_input.display = True
                self.log_message("Enter custom resolution in WIDTHxHEIGHT format")
            else:
                custom_input.display = False

    def action_refresh(self) -> None:
        self.update_status()
        self.log_message("Status refreshed.")

    def update_status(self):
        status_label = self.query_one("#status_label", Static)
        start_btn = self.query_one("#start", Button)
        stop_btn = self.query_one("#stop", Button)

        pid = is_running()
        if pid:
            config = get_current_config()
            res = config.get("res", "unknown")
            fps = config.get("fps", "unknown")
            camera = config.get("camera", "unknown")
            status_label.update(f"Status: [green]● Running[/green] (PID: {pid}) | {camera} @ {res} {fps}fps")
            start_btn.disabled = True
            stop_btn.disabled = False
        else:
            status_label.update("Status: [red]● Stopped[/red]")
            start_btn.disabled = False
            stop_btn.disabled = True

    def detect_cameras(self):
        cameras_label = self.query_one("#cameras_label", Static)
        cameras_label.update("Detecting cameras...")
        self.log_message("Querying phone cameras...")
        
        self.available_cameras = get_available_cameras()
        
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

    def start_stream(self):
        if is_running():
            self.log_message("Stream already running!")
            self.update_status()
            return

        camera = self.query_one("#camera_select", Select).value
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
        self.log_message(f"Using device: {v4l2_device}")

        cmd = [
            "scrcpy",
            "--video-source=camera",
            f"--camera-facing={camera}",
            f"--camera-size={res}",
            f"--camera-fps={fps}",
            f"--v4l2-sink={v4l2_device}",
            "--no-playback",
            "--no-audio"
        ]

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
