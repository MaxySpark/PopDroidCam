import { useState, useEffect, useCallback } from "react";
import { render, Box, Text, useInput, useApp } from "ink";
import SelectInput from "ink-select-input";
import TextInput from "ink-text-input";
import {
  getDevices,
  getCameraSizes,
  isRunning,
  getCurrentConfig,
  startStream,
  stopStream,
  adbConnect,
  adbPair,
  adbDisconnect,
  PREFERRED_RESOLUTIONS,
  type Device,
  type Camera,
} from "./utils.js";

type Tab = "camera" | "connect";
type CameraFocus = "device" | "camera" | "resolution" | "fps" | "actions";
type ConnectFocus = "pair_ip" | "pair_port" | "pair_code" | "conn_ip" | "conn_port" | "actions";

interface LogEntry {
  id: number;
  message: string;
  type: "info" | "success" | "error" | "warning";
}

function getLogColor(type: LogEntry["type"]): string {
  switch (type) {
    case "success": return "green";
    case "error": return "red";
    case "warning": return "yellow";
    default: return "gray";
  }
}

interface SelectItem {
  label: string;
  value: string;
}

function App() {
  const { exit } = useApp();
  const [tab, setTab] = useState<Tab>("camera");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>("");
  const [cameras, setCameras] = useState<Record<string, Camera>>({});
  const [selectedCamera, setSelectedCamera] = useState<string>("");
  const [selectedResolution, setSelectedResolution] = useState<string>("1920x1080");
  const [selectedFps, setSelectedFps] = useState<string>("30");

  const [streamRunning, setStreamRunning] = useState(false);
  const [streamConfig, setStreamConfig] = useState<Record<string, string>>({});

  const [pairIp, setPairIp] = useState("");
  const [pairPort, setPairPort] = useState("");
  const [pairCode, setPairCode] = useState("");
  const [connIp, setConnIp] = useState("");
  const [connPort, setConnPort] = useState("5555");

  const [cameraFocus, setCameraFocus] = useState<CameraFocus>("device");
  const [connectFocus, setConnectFocus] = useState<ConnectFocus>("pair_ip");
  const [actionIndex, setActionIndex] = useState(0);

  const log = useCallback((message: string, type: LogEntry["type"] = "info") => {
    setLogs((currentLogs) => {
      const newId = Date.now() + Math.random();
      return [...currentLogs.slice(-4), { id: newId, message, type }];
    });
  }, []);

  const refreshStatus = useCallback(() => {
    const pid = isRunning();
    setStreamRunning(!!pid);
    if (pid) {
      setStreamConfig(getCurrentConfig());
    }
  }, []);

  const refreshDevices = useCallback(() => {
    setLoading(true);
    log("Detecting devices...");
    
    const devs = getDevices();
    const connected = devs.filter((d) => d.state === "device");
    setDevices(connected);

    if (connected.length > 0 && !selectedDevice) {
      setSelectedDevice(connected[0].serial);
    }

    if (connected.length > 0) {
      log(`Found ${connected.length} device(s)`);
      const serial = connected[0].serial;
      log("Detecting cameras...");
      const cams = getCameraSizes(serial);
      setCameras(cams);
      
      const camIds = Object.keys(cams);
      if (camIds.length > 0) {
        setSelectedCamera(camIds[0]);
        const cam = cams[camIds[0]];
        const preferredRes = cam.resolutions.find((r) => PREFERRED_RESOLUTIONS.includes(r)) || cam.resolutions[0];
        if (preferredRes) setSelectedResolution(preferredRes);
        if (cam.fps.includes("30")) setSelectedFps("30");
        else if (cam.fps.length > 0) setSelectedFps(cam.fps[0]);
        log(`Found ${camIds.length} camera(s). Ready!`, "success");
      } else {
        log("No cameras found", "warning");
      }
    } else {
      log("No device connected. Use Connect tab.", "warning");
    }

    refreshStatus();
    setLoading(false);
  }, [log, refreshStatus, selectedDevice]);

  useEffect(() => {
    refreshDevices();
  }, []);

  const handleStart = useCallback(() => {
    if (streamRunning) {
      log("Already running!", "warning");
      return;
    }
    if (!selectedCamera) {
      log("No camera selected", "error");
      return;
    }

    log(`Starting ${selectedCamera} @ ${selectedResolution} ${selectedFps}fps...`);
    const result = startStream({
      cameraId: selectedCamera,
      resolution: selectedResolution,
      fps: selectedFps,
      serial: selectedDevice || undefined,
    });

    if (result.success) {
      log("Started! Select 'Android Cam' in apps", "success");
      refreshStatus();
    } else {
      log(`Error: ${result.error}`, "error");
    }
  }, [streamRunning, selectedCamera, selectedResolution, selectedFps, selectedDevice, log, refreshStatus]);

  const handleStop = useCallback(() => {
    if (stopStream()) {
      log("Stopped", "success");
    } else {
      log("Not running", "warning");
    }
    refreshStatus();
  }, [log, refreshStatus]);

  const handlePair = useCallback(() => {
    if (!pairIp || !pairPort || !pairCode) {
      log("Fill all pairing fields", "error");
      return;
    }
    log(`Pairing ${pairIp}:${pairPort}...`);
    if (adbPair(pairIp, pairPort, pairCode)) {
      log("Paired! Now connect below", "success");
      setConnIp(pairIp);
    } else {
      log("Pairing failed", "error");
    }
  }, [pairIp, pairPort, pairCode, log]);

  const handleConnect = useCallback(() => {
    if (!connIp || !connPort) {
      log("Fill IP and port", "error");
      return;
    }
    log(`Connecting ${connIp}:${connPort}...`);
    if (adbConnect(connIp, connPort)) {
      log("Connected!", "success");
      refreshDevices();
    } else {
      log("Connection failed", "error");
    }
  }, [connIp, connPort, log, refreshDevices]);

  const handleDisconnect = useCallback(() => {
    adbDisconnect();
    log("Disconnected");
    refreshDevices();
  }, [log, refreshDevices]);

  const deviceItems: SelectItem[] = devices.map((d) => ({
    label: `${d.serial.slice(0, 25)} (${d.type})`,
    value: d.serial,
  }));

  const cameraItems: SelectItem[] = Object.entries(cameras).map(([id, cam]) => ({
    label: `${id}: ${cam.facing}`,
    value: id,
  }));

  const currentCamera = cameras[selectedCamera];
  const resolutionItems: SelectItem[] = currentCamera
    ? [...PREFERRED_RESOLUTIONS.filter((r) => currentCamera.resolutions.includes(r)),
       ...currentCamera.resolutions.filter((r) => !PREFERRED_RESOLUTIONS.includes(r))]
        .map((r) => ({ label: PREFERRED_RESOLUTIONS.includes(r) ? `${r} ★` : r, value: r }))
    : [];

  const fpsItems: SelectItem[] = currentCamera
    ? currentCamera.fps.map((f) => ({ label: `${f} fps`, value: f }))
    : [];

  const cameraFocusOrder: CameraFocus[] = ["device", "camera", "resolution", "fps", "actions"];
  const connectFocusOrder: ConnectFocus[] = ["pair_ip", "pair_port", "pair_code", "conn_ip", "conn_port", "actions"];

  const isInputFocused = tab === "connect" && ["pair_ip", "pair_port", "pair_code", "conn_ip", "conn_port"].includes(connectFocus);

  useInput((input, key) => {
    if (input === "q" && !isInputFocused) {
      exit();
      return;
    }
    if (input === "r" && !isInputFocused) {
      refreshDevices();
      return;
    }

    if (key.ctrl) {
      if (input === "d") { setTab("camera"); setCameraFocus("device"); return; }
      if (input === "c") { setTab("camera"); setCameraFocus("camera"); return; }
      if (input === "e") { setTab("camera"); setCameraFocus("resolution"); return; }
      if (input === "f") { setTab("camera"); setCameraFocus("fps"); return; }
      if (input === "a") { setTab("camera"); setCameraFocus("actions"); return; }
      if (input === "p") { setTab("connect"); setConnectFocus("pair_ip"); return; }
      if (input === "o") { setTab("connect"); setConnectFocus("conn_ip"); return; }
    }

    if (input === "s" && !isInputFocused) {
      handleStart();
      return;
    }
    if (input === "x" && !isInputFocused) {
      handleStop();
      return;
    }

    if ((key.tab || input === "1" || input === "2") && !isInputFocused) {
      if (input === "1") setTab("camera");
      else if (input === "2") setTab("connect");
      else setTab(tab === "camera" ? "connect" : "camera");
      return;
    }

    if (tab === "camera") {
      if (key.upArrow || key.downArrow) {
        const currentIdx = cameraFocusOrder.indexOf(cameraFocus);
        if (key.upArrow && currentIdx > 0) {
          setCameraFocus(cameraFocusOrder[currentIdx - 1]);
        } else if (key.downArrow && currentIdx < cameraFocusOrder.length - 1) {
          setCameraFocus(cameraFocusOrder[currentIdx + 1]);
        }
      }
      if (cameraFocus === "actions") {
        if (key.leftArrow) setActionIndex((prev) => Math.max(0, prev - 1));
        if (key.rightArrow) setActionIndex((prev) => Math.min(2, prev + 1));
        if (key.return) {
          if (actionIndex === 0) handleStart();
          else if (actionIndex === 1) handleStop();
          else refreshDevices();
        }
      }
    }

    if (tab === "connect") {
      if ((key.upArrow || key.downArrow) && !isInputFocused) {
        const currentIdx = connectFocusOrder.indexOf(connectFocus);
        if (key.upArrow && currentIdx > 0) {
          setConnectFocus(connectFocusOrder[currentIdx - 1]);
        } else if (key.downArrow && currentIdx < connectFocusOrder.length - 1) {
          setConnectFocus(connectFocusOrder[currentIdx + 1]);
        }
      }
      if (key.escape && isInputFocused) {
        setConnectFocus("actions");
        return;
      }
      if (connectFocus === "actions") {
        if (key.leftArrow) setActionIndex((prev) => Math.max(0, prev - 1));
        if (key.rightArrow) setActionIndex((prev) => Math.min(2, prev + 1));
        if (key.return) {
          if (actionIndex === 0) handlePair();
          else if (actionIndex === 1) handleConnect();
          else handleDisconnect();
        }
      }
    }
  });

  const statusDevice = devices.length > 0 
    ? `● ${devices[0].type}: ${devices[0].serial.slice(0, 18)}`
    : "● No device";
  const statusStream = streamRunning 
    ? `● Streaming ${streamConfig.res || "?"} @ ${streamConfig.fps || "?"}fps`
    : "● Stopped";

  const shortcutHelp = tab === "camera" 
    ? "^D:device ^C:cam ^E:res ^F:fps ^A:action | s:start x:stop r:refresh q:quit"
    : "^P:pair ^O:conn ^A:action | Esc:exit input | r:refresh q:quit";

  return (
    <Box flexDirection="column" paddingX={1} paddingY={1}>
      <Box marginBottom={1}>
        <Text color="cyan" bold>PopDroidCam</Text>
        <Text>  </Text>
        {loading && <Text color="yellow">⟳ </Text>}
        <Text color="gray">[1/2:tabs] </Text>
        <Text color="gray" dimColor>{shortcutHelp}</Text>
      </Box>

      <Box marginBottom={1} gap={4}>
        <Text color={devices.length > 0 ? "green" : "red"}>{statusDevice}</Text>
        <Text color={streamRunning ? "green" : "gray"}>{statusStream}</Text>
      </Box>

      <Box marginBottom={1}>
        <Text color={tab === "camera" ? "black" : "gray"} backgroundColor={tab === "camera" ? "cyan" : undefined} bold={tab === "camera"}> 1:Camera </Text>
        <Text>  </Text>
        <Text color={tab === "connect" ? "black" : "gray"} backgroundColor={tab === "connect" ? "cyan" : undefined} bold={tab === "connect"}> 2:Connect </Text>
      </Box>

      {tab === "camera" && (
        <Box flexDirection="column">
          <Box flexDirection="column" borderStyle="round" borderColor={cameraFocus === "device" ? "cyan" : "gray"} paddingX={1} marginBottom={1}>
            <Text color="cyan" bold>^D Device</Text>
            {deviceItems.length > 0 ? (
              <SelectInput
                items={deviceItems}
                isFocused={cameraFocus === "device"}
                onSelect={(item) => {
                  setSelectedDevice(item.value);
                  const cams = getCameraSizes(item.value);
                  setCameras(cams);
                  const camIds = Object.keys(cams);
                  if (camIds.length > 0) setSelectedCamera(camIds[0]);
                  setCameraFocus("camera");
                }}
              />
            ) : (
              <Text color="gray">No devices connected</Text>
            )}
          </Box>

          <Box flexDirection="column" borderStyle="round" borderColor={cameraFocus === "camera" ? "cyan" : "gray"} paddingX={1} marginBottom={1}>
            <Text color="cyan" bold>^C Camera</Text>
            {cameraItems.length > 0 ? (
              <SelectInput
                items={cameraItems}
                isFocused={cameraFocus === "camera"}
                onSelect={(item) => {
                  setSelectedCamera(item.value);
                  const camData = cameras[item.value];
                  if (camData) {
                    const preferredRes = camData.resolutions.find((r) => PREFERRED_RESOLUTIONS.includes(r)) || camData.resolutions[0];
                    if (preferredRes) setSelectedResolution(preferredRes);
                  }
                  setCameraFocus("resolution");
                }}
              />
            ) : (
              <Text color="gray">No cameras detected</Text>
            )}
          </Box>

          <Box gap={2}>
            <Box flexDirection="column" borderStyle="round" borderColor={cameraFocus === "resolution" ? "cyan" : "gray"} paddingX={1} flexGrow={1}>
              <Text color="cyan" bold>^E Resolution</Text>
              {resolutionItems.length > 0 ? (
                <SelectInput
                  items={resolutionItems}
                  isFocused={cameraFocus === "resolution"}
                  limit={5}
                  onSelect={(item) => {
                    setSelectedResolution(item.value);
                    setCameraFocus("fps");
                  }}
                />
              ) : (
                <Text color="gray">--</Text>
              )}
            </Box>

            <Box flexDirection="column" borderStyle="round" borderColor={cameraFocus === "fps" ? "cyan" : "gray"} paddingX={1} width={20}>
              <Text color="cyan" bold>^F FPS</Text>
              {fpsItems.length > 0 ? (
                <SelectInput
                  items={fpsItems}
                  isFocused={cameraFocus === "fps"}
                  onSelect={(item) => {
                    setSelectedFps(item.value);
                    setCameraFocus("actions");
                  }}
                />
              ) : (
                <Text color="gray">--</Text>
              )}
            </Box>
          </Box>

          {currentCamera && (
            <Box marginTop={1}>
              <Text color="gray">{currentCamera.facing} camera • {currentCamera.resolutions.length} resolutions • fps: {currentCamera.fps.join(", ")}</Text>
            </Box>
          )}

          <Box marginTop={1} gap={1}>
            <Text 
              color={cameraFocus === "actions" && actionIndex === 0 ? "black" : "white"} 
              backgroundColor={cameraFocus === "actions" && actionIndex === 0 ? "green" : "gray"}
              bold
            > s ▶ Start </Text>
            <Text 
              color={cameraFocus === "actions" && actionIndex === 1 ? "black" : "white"} 
              backgroundColor={cameraFocus === "actions" && actionIndex === 1 ? "red" : "gray"}
              bold
            > x ■ Stop </Text>
            <Text 
              color={cameraFocus === "actions" && actionIndex === 2 ? "black" : "white"} 
              backgroundColor={cameraFocus === "actions" && actionIndex === 2 ? "blue" : "gray"}
              bold
            > r ↻ Refresh </Text>
            {cameraFocus === "actions" && <Text color="gray"> ← → Enter</Text>}
          </Box>
        </Box>
      )}

      {tab === "connect" && (
        <Box flexDirection="column">
          <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1} marginBottom={1}>
            <Text color="cyan" bold>QR Pairing (Easiest)</Text>
            <Text>Run: <Text color="cyan">popdroidcam qr</Text></Text>
          </Box>

          <Box flexDirection="column" borderStyle="round" borderColor={["pair_ip", "pair_port", "pair_code"].includes(connectFocus) ? "cyan" : "gray"} paddingX={1} marginBottom={1}>
            <Text color="cyan" bold>^P Manual Pair</Text>
            <Box>
              <Box width={10}><Text color={connectFocus === "pair_ip" ? "cyan" : "gray"}>IP:</Text></Box>
              <TextInput
                placeholder="192.168.1.x"
                value={pairIp}
                focus={connectFocus === "pair_ip"}
                onChange={setPairIp}
                onSubmit={() => setConnectFocus("pair_port")}
              />
            </Box>
            <Box>
              <Box width={10}><Text color={connectFocus === "pair_port" ? "cyan" : "gray"}>Port:</Text></Box>
              <TextInput
                placeholder="37xxx"
                value={pairPort}
                focus={connectFocus === "pair_port"}
                onChange={setPairPort}
                onSubmit={() => setConnectFocus("pair_code")}
              />
            </Box>
            <Box>
              <Box width={10}><Text color={connectFocus === "pair_code" ? "cyan" : "gray"}>Code:</Text></Box>
              <TextInput
                placeholder="123456"
                value={pairCode}
                focus={connectFocus === "pair_code"}
                onChange={setPairCode}
                onSubmit={() => {
                  handlePair();
                  setConnectFocus("conn_ip");
                }}
              />
            </Box>
          </Box>

          <Box flexDirection="column" borderStyle="round" borderColor={["conn_ip", "conn_port"].includes(connectFocus) ? "cyan" : "gray"} paddingX={1} marginBottom={1}>
            <Text color="cyan" bold>^O Connect</Text>
            <Box>
              <Box width={10}><Text color={connectFocus === "conn_ip" ? "cyan" : "gray"}>IP:</Text></Box>
              <TextInput
                placeholder="192.168.1.x"
                value={connIp}
                focus={connectFocus === "conn_ip"}
                onChange={setConnIp}
                onSubmit={() => setConnectFocus("conn_port")}
              />
            </Box>
            <Box>
              <Box width={10}><Text color={connectFocus === "conn_port" ? "cyan" : "gray"}>Port:</Text></Box>
              <TextInput
                placeholder="5555"
                value={connPort}
                focus={connectFocus === "conn_port"}
                onChange={setConnPort}
                onSubmit={handleConnect}
              />
            </Box>
          </Box>

          <Box marginTop={1} gap={1}>
            <Text 
              color={connectFocus === "actions" && actionIndex === 0 ? "black" : "white"} 
              backgroundColor={connectFocus === "actions" && actionIndex === 0 ? "yellow" : "gray"}
              bold
            > Pair </Text>
            <Text 
              color={connectFocus === "actions" && actionIndex === 1 ? "black" : "white"} 
              backgroundColor={connectFocus === "actions" && actionIndex === 1 ? "green" : "gray"}
              bold
            > Connect </Text>
            <Text 
              color={connectFocus === "actions" && actionIndex === 2 ? "black" : "white"} 
              backgroundColor={connectFocus === "actions" && actionIndex === 2 ? "red" : "gray"}
              bold
            > Disconnect All </Text>
            {connectFocus === "actions" && <Text color="gray"> ← → Enter</Text>}
          </Box>
        </Box>
      )}

      <Box flexDirection="column" borderStyle="round" borderColor="gray" marginTop={1} paddingX={1} height={7}>
        <Text color="gray" bold>Log</Text>
        {logs.map((entry) => (
          <Text key={entry.id} color={getLogColor(entry.type)}>{entry.message}</Text>
        ))}
      </Box>
    </Box>
  );
}

render(<App />);
