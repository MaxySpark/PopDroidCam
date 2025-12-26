#!/bin/bash
set -e

INSTALL_DIR="$HOME/.local/popdroidcam"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}=== PopDroidCam Uninstaller ===${NC}"
echo ""

if [ ! -d "$INSTALL_DIR" ]; then
    echo -e "${YELLOW}PopDroidCam is not installed at $INSTALL_DIR${NC}"
    echo ""
    
    if [ -L "$HOME/.local/bin/popdroidcam" ]; then
        echo "Found orphan symlink at ~/.local/bin/popdroidcam"
        read -p "Remove it? [y/N] " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            rm -f "$HOME/.local/bin/popdroidcam"
            echo -e "${GREEN}✓${NC} Removed symlink"
        fi
    fi
    
    if [ -d "$HOME/.local/state/popdroidcam" ]; then
        echo "Found state directory at ~/.local/state/popdroidcam"
        read -p "Remove it? [y/N] " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            rm -rf "$HOME/.local/state/popdroidcam"
            echo -e "${GREEN}✓${NC} Removed state directory"
        fi
    fi
    
    exit 0
fi

echo "This will remove PopDroidCam from: $INSTALL_DIR"
echo ""
read -p "Continue with uninstall? [y/N] " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Uninstall cancelled."
    exit 0
fi

echo ""

echo -e "${YELLOW}>>> Stopping any running streams...${NC}"
pkill -f "scrcpy.*--video-source=camera" 2>/dev/null && echo "  Stopped scrcpy" || echo "  No stream running"

echo ""
echo -e "${YELLOW}>>> Removing command symlink...${NC}"
if [ -L "$HOME/.local/bin/popdroidcam" ]; then
    rm -f "$HOME/.local/bin/popdroidcam"
    echo -e "  ${GREEN}✓${NC} Removed ~/.local/bin/popdroidcam"
else
    echo "  Symlink not found (already removed)"
fi

echo ""
echo -e "${YELLOW}>>> Removing state directory...${NC}"
if [ -d "$HOME/.local/state/popdroidcam" ]; then
    rm -rf "$HOME/.local/state/popdroidcam"
    echo -e "  ${GREEN}✓${NC} Removed ~/.local/state/popdroidcam"
else
    echo "  State directory not found"
fi

echo ""
echo -e "${YELLOW}>>> Removing installation directory...${NC}"
rm -rf "$INSTALL_DIR"
echo -e "  ${GREEN}✓${NC} Removed $INSTALL_DIR"

echo ""
echo -e "${CYAN}=== Uninstall Complete ===${NC}"
echo ""
echo -e "${YELLOW}Note:${NC} The following were NOT removed (may be used by other apps):"
echo "  - scrcpy (installed to /usr/local/bin)"
echo "  - v4l2loopback kernel module"
echo "  - System packages (ffmpeg, adb, etc.)"
echo "  - Bun runtime (~/.bun)"
echo "  - pnpm (~/.local/share/pnpm)"
echo ""
echo "To fully remove scrcpy (if not needed by other apps):"
echo "  sudo rm -f /usr/local/bin/scrcpy"
echo "  sudo rm -rf /usr/local/share/scrcpy"
echo ""
echo "PopDroidCam has been uninstalled. Thanks for using it!"
