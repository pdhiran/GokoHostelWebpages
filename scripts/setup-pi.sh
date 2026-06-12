#!/bin/bash
# GokoWeb Raspberry Pi Setup Script
# Run this on a fresh Raspberry Pi OS Lite (64-bit, Bookworm) installation.
#
# Prerequisites:
#   - SSH access to the Pi
#   - Pi connected to WiFi
#   - Internet available for initial setup
#
# Usage: curl -sSL <raw-url> | bash
#   or:  bash scripts/setup-pi.sh

set -euo pipefail

echo "=== GokoWeb Raspberry Pi Setup ==="
echo ""

# --- 1. System Updates ---
echo "[1/9] Updating system packages..."
sudo apt update && sudo apt upgrade -y

# --- 2. Build Tools (for better-sqlite3 native compilation) ---
echo "[2/9] Installing build tools..."
sudo apt install -y build-essential python3 git

# --- 3. Node.js 20 LTS ---
echo "[3/9] Installing Node.js 20 LTS..."
if ! command -v node &> /dev/null || [[ $(node -v | cut -d. -f1 | tr -d 'v') -lt 20 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt install -y nodejs
fi
echo "  Node: $(node -v), npm: $(npm -v)"

# --- 4. PM2 ---
echo "[4/9] Installing PM2..."
sudo npm install -g pm2

# --- 5. Clone Repository ---
REPO_DIR="/home/$(whoami)/goko-web"
echo "[5/9] Setting up repository at ${REPO_DIR}..."
if [ -d "$REPO_DIR" ]; then
  echo "  Repository already exists, pulling latest..."
  cd "$REPO_DIR" && git pull origin main
else
  git clone https://github.com/thegokosocial/GokoHostelWebpages.git "$REPO_DIR"
  cd "$REPO_DIR"
fi

# --- 6. Install Dependencies ---
echo "[6/9] Installing npm dependencies..."
npm install

# --- 7. Create Data Directory & Env File ---
DATA_DIR="/home/$(whoami)/goko-data"
echo "[7/9] Setting up data directory and environment..."
mkdir -p "$DATA_DIR"

if [ ! -f "$REPO_DIR/.env.local" ]; then
  cat > "$REPO_DIR/.env.local" << 'ENVEOF'
GOKO_RUNTIME=pi
SQLITE_PATH=/home/goko/goko-data/goko.db
NEXT_PUBLIC_GOKO_RUNTIME=pi

# Set these to match your Cloudflare deployment:
ADMIN_PASSWORD=
MANAGER_PASSWORD=
SYNC_SECRET=
CLOUDFLARE_SITE_URL=https://www.gokohostel.com

# For initial data seeding (run once, can remove after):
# CLOUDFLARE_ACCOUNT_ID=
# CLOUDFLARE_D1_TOKEN=
# CLOUDFLARE_DATABASE_ID=
ENVEOF
  echo "  Created .env.local — EDIT THIS FILE with your passwords before proceeding!"
  echo ""
  echo "  >>> IMPORTANT: Run 'nano $REPO_DIR/.env.local' and set passwords <<<"
  echo ""
fi

# --- 8. Swap File (for builds on 4GB Pi) ---
echo "[8/9] Setting up swap file..."
if [ ! -f /swapfile ]; then
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
  echo "  2GB swap file created"
else
  echo "  Swap file already exists"
fi

# --- 9. nginx Reverse Proxy ---
echo "[9/9] Setting up nginx..."
sudo apt install -y nginx

sudo tee /etc/nginx/sites-available/goko > /dev/null << 'NGINXEOF'
server {
    listen 80;
    server_name goko.local _;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
    }
}
NGINXEOF

sudo ln -sf /etc/nginx/sites-available/goko /etc/nginx/sites-enabled/goko
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx
sudo systemctl enable nginx

# --- Hostname (mDNS via Avahi) ---
sudo hostnamectl set-hostname goko
echo "  Pi accessible at http://goko.local"

# --- Static IP (optional, uncomment if needed) ---
# echo "interface wlan0" | sudo tee -a /etc/dhcpcd.conf
# echo "static ip_address=192.168.1.100/24" | sudo tee -a /etc/dhcpcd.conf
# echo "static routers=192.168.1.1" | sudo tee -a /etc/dhcpcd.conf
# echo "static domain_name_servers=192.168.1.1 8.8.8.8" | sudo tee -a /etc/dhcpcd.conf

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "  1. Edit .env.local with your passwords: nano $REPO_DIR/.env.local"
echo "  2. Run database migrations: cd $REPO_DIR && npm run db:migrate:pi"
echo "  3. Seed from Cloudflare D1: npm run seed:pi"
echo "  4. Build the app: npm run build:pi"
echo "  5. Start with PM2: pm2 start npm --name goko -- run start:pi"
echo "  6. Enable auto-start: pm2 startup && pm2 save"
echo "  7. Set up auto-deploy: crontab -e  (add the cron line from check-and-deploy.sh)"
echo ""
echo "Access at: http://goko.local or http://$(hostname -I | awk '{print $1}')"
