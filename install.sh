#!/bin/bash
set -e

INSTALL_DIR="$HOME/.local/popdroidcam"
REPO_URL="https://github.com/MaxySpark/PopDroidCam.git"

echo "=== PopDroidCam Installer ==="
echo ""

# Check if git is installed
if ! command -v git &> /dev/null; then
    echo "Error: git is not installed. Please install git first:"
    echo "  sudo apt install git"
    exit 1
fi

# Check if already installed
if [ -d "$INSTALL_DIR" ]; then
    echo "PopDroidCam is already installed at $INSTALL_DIR"
    echo ""
    read -p "Do you want to update it? (y/N) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo ">>> Updating PopDroidCam..."
        cd "$INSTALL_DIR"
        git pull
        ./setup.sh
        exit 0
    else
        echo "Installation cancelled."
        exit 0
    fi
fi

# Create parent directory if needed
mkdir -p "$HOME/.local"

# Clone the repository
echo ">>> Cloning PopDroidCam to $INSTALL_DIR..."
git clone "$REPO_URL" "$INSTALL_DIR"

# Run setup
echo ""
echo ">>> Running setup..."
cd "$INSTALL_DIR"
./setup.sh

echo ""
echo "=== Installation Complete! ==="
echo ""
echo "PopDroidCam is installed at: $INSTALL_DIR"
echo ""
echo "Run 'popdroidcam' to get started!"
