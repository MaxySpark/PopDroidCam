#!/bin/bash

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}=== PopDroidCam Uninstaller ===${NC}"
echo ""

read -p "This will remove PopDroidCam. Continue? [y/N] " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
fi

echo ""

echo -e "${YELLOW}Stopping any running streams...${NC}"
pkill -f "scrcpy.*--video-source=camera" 2>/dev/null && echo "  Stopped scrcpy" || echo "  No stream running"

echo ""
echo -e "${YELLOW}Removing symlink...${NC}"
if [ -L "$HOME/.local/bin/popdroidcam" ]; then
    rm -f "$HOME/.local/bin/popdroidcam"
    echo -e "  ${GREEN}✓${NC} Removed ~/.local/bin/popdroidcam"
else
    echo "  Symlink not found"
fi

echo ""
echo -e "${YELLOW}Removing state directory...${NC}"
if [ -d "$HOME/.local/state/popdroidcam" ]; then
    rm -rf "$HOME/.local/state/popdroidcam"
    echo -e "  ${GREEN}✓${NC} Removed ~/.local/state/popdroidcam"
else
    echo "  State directory not found"
fi

echo ""
echo -e "${YELLOW}Removing Python virtual environment...${NC}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -d "$SCRIPT_DIR/venv" ]; then
    rm -rf "$SCRIPT_DIR/venv"
    echo -e "  ${GREEN}✓${NC} Removed venv"
else
    echo "  venv not found"
fi

echo ""
echo -e "${YELLOW}Removing scrcpy build directory...${NC}"
if [ -d "$SCRIPT_DIR/build_scrcpy" ]; then
    rm -rf "$SCRIPT_DIR/build_scrcpy"
    echo -e "  ${GREEN}✓${NC} Removed build_scrcpy"
else
    echo "  Build directory not found"
fi

echo ""
echo -e "${CYAN}=== Uninstall Complete ===${NC}"
echo ""
echo "Note: The following were NOT removed (may be used by other apps):"
echo "  - scrcpy (installed to /usr/local/bin)"
echo "  - v4l2loopback kernel module"
echo "  - System packages (ffmpeg, adb, etc.)"
echo ""
echo "To fully remove scrcpy:"
echo "  sudo rm /usr/local/bin/scrcpy"
echo "  sudo rm /usr/local/share/scrcpy/scrcpy-server"
echo ""
echo "To remove this project directory:"
echo "  rm -rf $SCRIPT_DIR"
