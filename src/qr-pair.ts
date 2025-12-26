#!/usr/bin/env bun
/**
 * QR Pairing for PopDroidCam
 * Generates QR code for wireless ADB pairing using mDNS discovery
 */

import { spawnSync } from "child_process";
import dgram from "node:dgram";
import QRCode from "qrcode";

const SERVICE_TYPE = "_adb-tls-pairing._tcp.local.";
const NAME = "popdroidcam";
const PASSWORD = Math.floor(100000 + Math.random() * 900000).toString();
const QR_FORMAT = `WIFI:T:ADB;S:${NAME};P:${PASSWORD};;`;

// ANSI colors
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const RED = "\x1b[91m";
const GREEN = "\x1b[92m";
const YELLOW = "\x1b[93m";
const CYAN = "\x1b[96m";

interface PairingResult {
  paired: boolean;
  deviceIp: string | null;
}

/**
 * Print QR code to terminal using ASCII
 */
async function printQrTerminal(data: string): Promise<void> {
  const qr = await QRCode.toString(data, { type: "terminal", small: true });
  console.log(qr);
}

/**
 * Attempt to pair with device at given IP:port
 */
function pairWithDevice(ip: string, port: number): boolean {
  console.log(`\n${CYAN}Device found: ${ip}:${port}${RESET}`);
  console.log(`${CYAN}Pairing...${RESET}`);

  const result = spawnSync("adb", ["pair", `${ip}:${port}`, PASSWORD], {
    timeout: 15000,
    encoding: "utf-8",
  });

  const output = (result.stdout + result.stderr).toLowerCase();

  if (output.includes("success") || output.includes("paired")) {
    console.log(`${GREEN}✓ Successfully paired with ${ip}:${port}${RESET}`);
    return true;
  } else {
    console.log(`${RED}✗ Pairing failed: ${result.stdout + result.stderr}${RESET}`);
    return false;
  }
}

/**
 * Simple mDNS query for ADB pairing service
 * This is a simplified implementation that sends mDNS queries
 */
async function discoverAndPair(): Promise<PairingResult> {
  return new Promise((resolve) => {
    let paired = false;
    let deviceIp: string | null = null;
    let resolved = false;

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        socket.close();
        resolve({ paired, deviceIp });
      }
    }, 60000); // 60 second timeout

    // Create UDP socket for mDNS
    const socket = dgram.createSocket({ type: "udp4", reuseAddr: true });

    socket.on("error", (err) => {
      console.error(`${RED}Socket error: ${err.message}${RESET}`);
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        socket.close();
        resolve({ paired: false, deviceIp: null });
      }
    });

    socket.on("message", (msg, rinfo) => {
      // Check if this is a response containing our service type
      const msgStr = msg.toString("utf-8", 0, Math.min(msg.length, 500));
      
      if (msgStr.includes("_adb-tls-pairing") || msgStr.includes("adb")) {
        // Try to extract port from the message
        // mDNS SRV records contain port info, but parsing DNS wire format is complex
        // For simplicity, we'll try common pairing ports
        const ip = rinfo.address;
        
        // mDNS responses include port in SRV records
        // Look for port bytes after SRV record indicator
        for (let i = 0; i < msg.length - 2; i++) {
          // Check for port range 30000-50000 which is typical for ADB wireless pairing
          const potentialPort = (msg[i] << 8) | msg[i + 1];
          if (potentialPort >= 30000 && potentialPort <= 50000) {
            if (!resolved && !paired) {
              const success = pairWithDevice(ip, potentialPort);
              if (success) {
                paired = true;
                deviceIp = ip;
                resolved = true;
                clearTimeout(timeout);
                socket.close();
                resolve({ paired, deviceIp });
                return;
              }
            }
          }
        }
      }
    });

    socket.bind(5353, () => {
      socket.addMembership("224.0.0.251");
      socket.setBroadcast(true);

      // Build mDNS query packet for _adb-tls-pairing._tcp.local
      const query = buildMdnsQuery(SERVICE_TYPE);
      
      // Send query periodically
      const sendQuery = () => {
        if (!resolved) {
          socket.send(query, 0, query.length, 5353, "224.0.0.251");
        }
      };

      sendQuery();
      const queryInterval = setInterval(() => {
        if (resolved) {
          clearInterval(queryInterval);
        } else {
          sendQuery();
        }
      }, 2000);
    });
  });
}

/**
 * Build a simple mDNS query packet
 */
function buildMdnsQuery(serviceName: string): Buffer {
  // DNS header
  const header = Buffer.alloc(12);
  header.writeUInt16BE(0, 0); // Transaction ID
  header.writeUInt16BE(0, 2); // Flags (standard query)
  header.writeUInt16BE(1, 4); // Questions count
  header.writeUInt16BE(0, 6); // Answers count
  header.writeUInt16BE(0, 8); // Authority count
  header.writeUInt16BE(0, 10); // Additional count

  // Convert service name to DNS format
  const parts = serviceName.replace(/\.$/, "").split(".");
  const nameBuffer = Buffer.alloc(256);
  let offset = 0;

  for (const part of parts) {
    nameBuffer.writeUInt8(part.length, offset++);
    nameBuffer.write(part, offset);
    offset += part.length;
  }
  nameBuffer.writeUInt8(0, offset++); // Null terminator

  // Question: type PTR (12), class IN (1)
  const question = Buffer.alloc(4);
  question.writeUInt16BE(12, 0); // Type PTR
  question.writeUInt16BE(1, 2); // Class IN

  return Buffer.concat([header, nameBuffer.subarray(0, offset), question]);
}

/**
 * Fallback: Use avahi-browse if available
 */
async function discoverWithAvahi(): Promise<PairingResult> {
  return new Promise((resolve) => {
    console.log(`${YELLOW}Trying avahi-browse for discovery...${RESET}`);
    
    const result = spawnSync("avahi-browse", ["-ptr", "_adb-tls-pairing._tcp"], {
      timeout: 30000,
      encoding: "utf-8",
    });

    if (result.error) {
      console.log(`${YELLOW}avahi-browse not available, using direct mDNS...${RESET}`);
      resolve({ paired: false, deviceIp: null });
      return;
    }

    const lines = (result.stdout || "").split("\n");
    for (const line of lines) {
      // Format: =;eth0;IPv4;...;ip;port
      if (line.startsWith("=")) {
        const parts = line.split(";");
        if (parts.length >= 8) {
          const ip = parts[7];
          const port = parseInt(parts[8], 10);
          if (ip && port) {
            const success = pairWithDevice(ip, port);
            if (success) {
              resolve({ paired: true, deviceIp: ip });
              return;
            }
          }
        }
      }
    }

    resolve({ paired: false, deviceIp: null });
  });
}

async function main(): Promise<number> {
  console.log(`${BOLD}=== PopDroidCam QR Pairing ===${RESET}\n`);
  console.log("Scan this QR code with your phone:\n");
  console.log("  Phone → Settings → Developer Options → Wireless debugging");
  console.log("  → Pair device with QR code\n");

  await printQrTerminal(QR_FORMAT);

  console.log(`\n${YELLOW}Waiting for device to scan QR code...${RESET}`);
  console.log("(Press Ctrl+C to cancel)\n");

  // Try avahi first, fall back to direct mDNS
  let result = await discoverWithAvahi();
  
  if (!result.paired) {
    result = await discoverAndPair();
  }

  if (result.paired && result.deviceIp) {
    console.log(`\n${GREEN}Pairing complete!${RESET}`);
    console.log(`\nNow connect with:`);
    console.log(`  ${CYAN}popdroidcam connect ${result.deviceIp} <port>${RESET}`);
    console.log(`\n(Get the port from Wireless debugging screen on phone)`);
    return 0;
  }

  console.log(`\n${YELLOW}No device detected. Make sure to:`);
  console.log("  1. Enable Wireless debugging on your phone");
  console.log("  2. Tap 'Pair device with QR code'");
  console.log(`  3. Scan the QR code above${RESET}`);
  return 1;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(`${RED}Error: ${err.message}${RESET}`);
    process.exit(1);
  });
