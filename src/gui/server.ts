import { serve } from "bun";
import { join } from "path";
import { readFileSync } from "fs";
import {
  getDevices,
  getCameraSizes,
  startStream,
  stopStream,
  isRunning,
  getCurrentConfig,
  adbConnect,
  adbPair,
  adbDisconnect,
  type StartStreamOptions,
} from "../utils";

const PORT = 3847;
const HOST = "localhost";

// Get the directory where this script is located
const scriptDir = import.meta.dir;

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function htmlResponse(content: string): Response {
  return new Response(content, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  // Serve static files
  if (path === "/" || path === "/index.html") {
    try {
      const htmlPath = join(scriptDir, "index.html");
      const html = readFileSync(htmlPath, "utf-8");
      return htmlResponse(html);
    } catch (e) {
      return new Response("index.html not found", { status: 404 });
    }
  }

  // API endpoints
  if (path.startsWith("/api/")) {
    const apiPath = path.replace("/api", "");

    // GET /api/devices - List connected devices
    if (apiPath === "/devices" && method === "GET") {
      const devices = getDevices();
      return jsonResponse({ devices });
    }

    // GET /api/cameras?serial=... - Get camera info for device
    if (apiPath === "/cameras" && method === "GET") {
      const serial = url.searchParams.get("serial") || undefined;
      const cameras = getCameraSizes(serial);
      return jsonResponse({ cameras });
    }

    // GET /api/status - Get stream status
    if (apiPath === "/status" && method === "GET") {
      const pid = isRunning();
      const config = getCurrentConfig();
      return jsonResponse({
        running: pid !== null,
        pid,
        config,
      });
    }

    // POST /api/start - Start stream
    if (apiPath === "/start" && method === "POST") {
      try {
        const body = await req.json() as StartStreamOptions;
        const result = startStream(body);
        return jsonResponse(result, result.success ? 200 : 400);
      } catch (e) {
        return jsonResponse({ success: false, error: String(e) }, 400);
      }
    }

    // POST /api/stop - Stop stream
    if (apiPath === "/stop" && method === "POST") {
      const stopped = stopStream();
      return jsonResponse({ success: stopped });
    }

    // POST /api/connect - Connect to device over WiFi
    if (apiPath === "/connect" && method === "POST") {
      try {
        const body = await req.json() as { ip: string; port: string };
        const success = adbConnect(body.ip, body.port);
        return jsonResponse({ success });
      } catch (e) {
        return jsonResponse({ success: false, error: String(e) }, 400);
      }
    }

    // POST /api/pair - Pair with device
    if (apiPath === "/pair" && method === "POST") {
      try {
        const body = await req.json() as { ip: string; port: string; code: string };
        const success = adbPair(body.ip, body.port, body.code);
        return jsonResponse({ success });
      } catch (e) {
        return jsonResponse({ success: false, error: String(e) }, 400);
      }
    }

    // POST /api/disconnect - Disconnect all wireless devices
    if (apiPath === "/disconnect" && method === "POST") {
      adbDisconnect();
      return jsonResponse({ success: true });
    }

    return jsonResponse({ error: "Not found" }, 404);
  }

  return new Response("Not found", { status: 404 });
}

// Start server
console.log(`\n🎥 PopDroidCam GUI starting on http://${HOST}:${PORT}\n`);

const server = serve({
  port: PORT,
  hostname: HOST,
  fetch: handleRequest,
});

// Open browser
const openCmd = process.platform === "darwin" ? "open" : "xdg-open";
Bun.spawn([openCmd, `http://${HOST}:${PORT}`], {
  stdout: "ignore",
  stderr: "ignore",
});

console.log(`   Press Ctrl+C to stop\n`);
