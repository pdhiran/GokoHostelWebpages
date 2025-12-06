# 🍓 Goko Hostel - Raspberry Pi Server Documentation

> **Last Updated:** December 6, 2025  
> **Server Hostname:** goko-server  
> **OS:** Raspberry Pi OS Lite (64-bit)  
> **Hardware:** Raspberry Pi 4/5 (8GB RAM)

---

## 📋 Table of Contents

1. [Quick Reference](#-quick-reference)
2. [Access Credentials](#-access-credentials)
3. [Active Services](#-active-services)
4. [Scripts & Their Locations](#-scripts--their-locations)
5. [Cron Jobs](#-cron-jobs)
6. [Systemd Services](#-systemd-services)
7. [Log Files](#-log-files)
8. [Cloudflare Tunnel Management](#-cloudflare-tunnel-management)
9. [Adding New Services Checklist](#-adding-new-services-checklist)
10. [Future Services (Planned)](#-future-services-planned)
11. [Network Configuration](#-network-configuration)
12. [Troubleshooting Commands](#-troubleshooting-commands)
13. [Backup & Recovery](#-backup--recovery)

---

## ⚡ Quick Reference

| Item | Value |
|------|-------|
| SSH Command | `ssh goko@goko-server.local` |
| Website URL (Local) | `http://goko-server.local` |
| **Website URL (Public)** | **https://gokohostel.com** |
| Website Files | `/var/www/html/` |
| GitHub Repo | https://github.com/pdhiran/GokoHostelWebpages.git |
| Update Frequency | Every 5 minutes |
| Health Check | Every 10 minutes |
| Cloudflare Tunnel | `goko` (ID: `9b687a18-...`) |

---

## 🔐 Access Credentials

| Service | Username | Password | Notes |
|---------|----------|----------|-------|
| SSH | `goko` | `goko@123` | Main user account |
| Root | - | - | Use `sudo -i` from goko user |

> ⚠️ **Security Note:** Change default password in production!
> ```bash
> passwd  # Change current user password
> ```

---

## 🟢 Active Services

### 1. Nginx (Web Server)
| Property | Value |
|----------|-------|
| Status | ✅ Active |
| Auto-start | ✅ Enabled |
| Port | 80 (HTTP) |
| Config File | `/etc/nginx/sites-available/goko` |
| Web Root | `/var/www/html/` |
| Service Name | `nginx.service` |

**Commands:**
```bash
sudo systemctl status nginx      # Check status
sudo systemctl restart nginx     # Restart
sudo systemctl stop nginx        # Stop
sudo nginx -t                    # Test config
```

---

### 2. Cron (Scheduled Tasks)
| Property | Value |
|----------|-------|
| Status | ✅ Active |
| Auto-start | ✅ Enabled |
| Config | `sudo crontab -e` |
| Service Name | `cron.service` |

**Commands:**
```bash
sudo systemctl status cron    # Check status
sudo crontab -l               # List cron jobs
sudo crontab -e               # Edit cron jobs
```

---

### 3. Goko Startup Service (Boot Script)
| Property | Value |
|----------|-------|
| Status | ✅ Active |
| Auto-start | ✅ Enabled |
| Script | `/usr/local/bin/startup-goko.sh` |
| Service File | `/etc/systemd/system/goko-startup.service` |

**Commands:**
```bash
sudo systemctl status goko-startup.service
```

---

### 4. Cloudflare Tunnel (Public Internet Access)
| Property | Value |
|----------|-------|
| Status | ✅ Active |
| Auto-start | ✅ Enabled |
| Tunnel Name | `goko` |
| Tunnel ID | `9b687a18-c3f3-4680-9c0e-dc47c90701ad` |
| Public URL | `https://gokohostel.com` |
| Config File | `/root/.cloudflared/config.yml` |
| Credentials | `/root/.cloudflared/9b687a18-c3f3-4680-9c0e-dc47c90701ad.json` |
| Service Name | `cloudflared.service` |

**Current Configuration (`/root/.cloudflared/config.yml`):**
```yaml
tunnel: 9b687a18-c3f3-4680-9c0e-dc47c90701ad
credentials-file: /root/.cloudflared/9b687a18-c3f3-4680-9c0e-dc47c90701ad.json

ingress:
  # Main website
  - hostname: gokohostel.com
    service: http://localhost:80
  - hostname: www.gokohostel.com
    service: http://localhost:80

  # Catch-all (required)
  - service: http_status:404
```

**Commands:**
```bash
sudo systemctl status cloudflared     # Check status
sudo systemctl restart cloudflared    # Restart
sudo systemctl stop cloudflared       # Stop
cloudflared tunnel list               # List tunnels
cloudflared tunnel info goko          # Tunnel details
sudo journalctl -u cloudflared -f     # View logs
```

**Features Included (Free):**
- ✅ HTTPS/SSL Certificate (automatic)
- ✅ DDoS Protection
- ✅ Global CDN
- ✅ No port forwarding required
- ✅ Works behind any firewall/NAT

---

## 📜 Scripts & Their Locations

### Currently Active Scripts

| Script | Location | Purpose | Triggered By |
|--------|----------|---------|--------------|
| Website Update | `/usr/local/bin/update-website.sh` | Pulls latest code from GitHub | Cron (every 5 min) |
| Health Check | `/usr/local/bin/health-check.sh` | Restarts services if down | Cron (every 10 min) |
| Startup Script | `/usr/local/bin/startup-goko.sh` | Ensures services run on boot | Systemd (on boot) |
| WiFi Fallback | `/usr/local/bin/wifi-fallback.sh` | Creates hotspot if no WiFi | Cron (@reboot) - Optional |

---

### Script Details

#### 📄 `/usr/local/bin/update-website.sh`
```bash
#!/bin/bash
REPO_DIR="/var/www/html-repo"
WEB_DIR="/var/www/html"
REPO_URL="https://github.com/pdhiran/GokoHostelWebpages.git"
LOG_FILE="/var/log/website-update.log"

# Checks GitHub for updates and deploys if changes found
```
**To Edit:** `sudo nano /usr/local/bin/update-website.sh`

---

#### 📄 `/usr/local/bin/health-check.sh`
```bash
#!/bin/bash
# Checks if Nginx and Cloudflared are running
# Restarts services if down
# Should include checks for: nginx, cloudflared, and any future services
```
**To Edit:** `sudo nano /usr/local/bin/health-check.sh`

**Ensure it includes:**
```bash
# Check Cloudflared
if ! systemctl is-active --quiet cloudflared; then
    echo "$(date): Cloudflared down, restarting..." >> /var/log/goko-health.log
    systemctl restart cloudflared
fi
```

---

#### 📄 `/usr/local/bin/startup-goko.sh`
```bash
#!/bin/bash
# Runs on boot - ensures all services are running
# Performs initial website update
# Should include checks for: nginx, cloudflared, and any future services
```
**To Edit:** `sudo nano /usr/local/bin/startup-goko.sh`

**Ensure it includes:**
```bash
# Check and start Cloudflared if not running
if ! systemctl is-active --quiet cloudflared; then
    echo "$(date): Cloudflared not running, starting..." >> $LOG_FILE
    systemctl start cloudflared
else
    echo "$(date): Cloudflared is running ✓" >> $LOG_FILE
fi
```

---

## ⏰ Cron Jobs

**View all:** `sudo crontab -l`  
**Edit:** `sudo crontab -e`

### Current Cron Jobs

| Schedule | Command | Purpose |
|----------|---------|---------|
| `*/5 * * * *` | `/usr/local/bin/update-website.sh` | Check GitHub & update website |
| `*/10 * * * *` | `/usr/local/bin/health-check.sh` | Health check & auto-restart |
| `@reboot` | `/usr/local/bin/wifi-fallback.sh` | WiFi fallback hotspot (if configured) |

### Cron Schedule Reference

```
* * * * * command
│ │ │ │ │
│ │ │ │ └── Day of week (0-7, Sun=0 or 7)
│ │ │ └──── Month (1-12)
│ │ └────── Day of month (1-31)
│ └──────── Hour (0-23)
└────────── Minute (0-59)

Examples:
*/5 * * * *    = Every 5 minutes
*/10 * * * *   = Every 10 minutes
0 * * * *      = Every hour
0 0 * * *      = Daily at midnight
0 0 * * 0      = Weekly on Sunday
```

---

## 🔧 Systemd Services

### Custom Services

| Service | File Location | Purpose |
|---------|---------------|---------|
| `goko-startup.service` | `/etc/systemd/system/goko-startup.service` | Boot startup script |
| `nginx restart override` | `/etc/systemd/system/nginx.service.d/restart.conf` | Auto-restart nginx on crash |
| `cloudflared.service` | System service | Cloudflare Tunnel (public internet access) |

### Managing Systemd Services

```bash
# Enable service on boot
sudo systemctl enable SERVICE_NAME

# Disable service on boot
sudo systemctl disable SERVICE_NAME

# Start/Stop/Restart
sudo systemctl start SERVICE_NAME
sudo systemctl stop SERVICE_NAME
sudo systemctl restart SERVICE_NAME

# Check status
sudo systemctl status SERVICE_NAME

# Reload after config changes
sudo systemctl daemon-reload
```

---

## 📝 Log Files

| Log File | Purpose | View Command |
|----------|---------|--------------|
| `/var/log/website-update.log` | Website deployment logs | `cat /var/log/website-update.log` |
| `/var/log/goko-startup.log` | Boot startup logs | `cat /var/log/goko-startup.log` |
| `/var/log/goko-health.log` | Health check logs | `cat /var/log/goko-health.log` |
| `/var/log/nginx/access.log` | Nginx access logs | `sudo tail -f /var/log/nginx/access.log` |
| `/var/log/nginx/error.log` | Nginx error logs | `sudo tail -f /var/log/nginx/error.log` |
| Cloudflared logs | Tunnel connection logs | `sudo journalctl -u cloudflared -f` |
| `/var/log/syslog` | System logs | `sudo tail -f /var/log/syslog` |

### Log Management

```bash
# View last 50 lines
tail -50 /var/log/website-update.log

# Follow logs in real-time
tail -f /var/log/nginx/access.log

# Clear a log file
sudo truncate -s 0 /var/log/website-update.log
```

---

## ☁️ Cloudflare Tunnel Management

### Current Setup Summary

| Item | Value |
|------|-------|
| Public URL | `https://gokohostel.com` |
| Tunnel Name | `goko` |
| Tunnel ID | `9b687a18-c3f3-4680-9c0e-dc47c90701ad` |
| Config File | `/root/.cloudflared/config.yml` |
| Credentials File | `/root/.cloudflared/9b687a18-c3f3-4680-9c0e-dc47c90701ad.json` |
| Service | `cloudflared.service` |
| Cloudflare Dashboard | https://dash.cloudflare.com |

---

### Adding a New Subdomain/Service to Tunnel

When you add new services (API, database admin, etc.), you can expose them through Cloudflare:

**Step 1:** Edit the config file:
```bash
sudo nano /root/.cloudflared/config.yml
```

**Step 2:** Add new hostname entry:
```yaml
tunnel: 9b687a18-c3f3-4680-9c0e-dc47c90701ad
credentials-file: /root/.cloudflared/9b687a18-c3f3-4680-9c0e-dc47c90701ad.json

ingress:
  # Main website
  - hostname: gokohostel.com
    service: http://localhost:80
  - hostname: www.gokohostel.com
    service: http://localhost:80
  
  # API Server (example - add when ready)
  # - hostname: api.gokohostel.com
  #   service: http://localhost:3000
  
  # Database Admin Panel (example - add when ready)
  # - hostname: admin.gokohostel.com
  #   service: http://localhost:8080

  # Catch-all (required - must be last)
  - service: http_status:404
```

**Step 3:** Create DNS record in Cloudflare:
```bash
cloudflared tunnel route dns goko api.gokohostel.com
```

**Step 4:** Restart tunnel:
```bash
sudo systemctl restart cloudflared
```

---

### Common Cloudflare Tunnel Commands

```bash
# Check tunnel status
sudo systemctl status cloudflared

# Restart tunnel
sudo systemctl restart cloudflared

# View tunnel logs
sudo journalctl -u cloudflared -f

# List all tunnels
cloudflared tunnel list

# Get tunnel info
cloudflared tunnel info goko

# Test tunnel configuration
cloudflared tunnel --config /root/.cloudflared/config.yml ingress validate

# Run tunnel manually (for debugging)
cloudflared tunnel --config /root/.cloudflared/config.yml run
```

---

### Troubleshooting Cloudflare Tunnel

| Issue | Solution |
|-------|----------|
| Site not accessible | Check `sudo systemctl status cloudflared` |
| 502 Bad Gateway | Ensure Nginx is running: `sudo systemctl status nginx` |
| DNS not resolving | Wait 5-10 mins or check Cloudflare DNS dashboard |
| Tunnel disconnects | Check internet connection, restart: `sudo systemctl restart cloudflared` |
| Config errors | Validate: `cloudflared tunnel ingress validate` |

**View recent errors:**
```bash
sudo journalctl -u cloudflared --since "10 minutes ago"
```

---

### Backup Cloudflare Tunnel Credentials

⚠️ **IMPORTANT:** Backup these files - if lost, you'll need to create a new tunnel!

```bash
# Backup tunnel credentials
cp /root/.cloudflared/9b687a18-c3f3-4680-9c0e-dc47c90701ad.json ~/backups/
cp /root/.cloudflared/config.yml ~/backups/
cp /root/.cloudflared/cert.pem ~/backups/
```

---

### Re-installing Cloudflare Tunnel (if needed)

If you need to set up the tunnel on a new Pi or after OS reinstall:

```bash
# Install cloudflared
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb -o cloudflared.deb
sudo dpkg -i cloudflared.deb

# Restore credentials (from backup)
sudo mkdir -p /root/.cloudflared
sudo cp ~/backups/9b687a18-c3f3-4680-9c0e-dc47c90701ad.json /root/.cloudflared/
sudo cp ~/backups/config.yml /root/.cloudflared/
sudo cp ~/backups/cert.pem /root/.cloudflared/

# Install and start service
sudo cloudflared service install
sudo systemctl enable cloudflared
sudo systemctl start cloudflared
```

---

## ✅ Adding New Services Checklist

When adding a new service (database, file server, API, etc.), follow this checklist:

### Step 1: Install the Service
```bash
sudo apt update
sudo apt install SERVICE_NAME
```

### Step 2: Enable Auto-Start on Boot
```bash
sudo systemctl enable SERVICE_NAME
sudo systemctl start SERVICE_NAME
```

### Step 3: Add to Health Check Script
Edit `/usr/local/bin/health-check.sh`:
```bash
sudo nano /usr/local/bin/health-check.sh
```

Add check for new service:
```bash
# Check NEW_SERVICE
if ! systemctl is-active --quiet NEW_SERVICE; then
    echo "$(date): NEW_SERVICE down, restarting..." >> /var/log/goko-health.log
    systemctl restart NEW_SERVICE
fi
```

### Step 4: Add to Startup Script
Edit `/usr/local/bin/startup-goko.sh`:
```bash
sudo nano /usr/local/bin/startup-goko.sh
```

Add:
```bash
# Check and start NEW_SERVICE if not running
if ! systemctl is-active --quiet NEW_SERVICE; then
    echo "$(date): NEW_SERVICE not running, starting..." >> $LOG_FILE
    systemctl start NEW_SERVICE
else
    echo "$(date): NEW_SERVICE is running ✓" >> $LOG_FILE
fi
```

### Step 5: Update This Documentation
Add the new service to:
- [ ] Active Services section
- [ ] Log Files section (if applicable)
- [ ] Future Services → Move to Active

### Step 6: Test
```bash
sudo reboot
# Wait 2 minutes, then verify
sudo systemctl status NEW_SERVICE
```

---

## 🔮 Future Services (Planned)

### Database (Customer Data, Bookings)
| Property | Planned Value |
|----------|---------------|
| Service | PostgreSQL or SQLite |
| Port | 5432 (PostgreSQL) |
| Purpose | Customer data, bookings, food orders |
| Status | ⏳ Not installed |

**Installation (when ready):**
```bash
sudo apt install postgresql postgresql-contrib
sudo systemctl enable postgresql
```

---

### File Server (Documents, Backups)
| Property | Planned Value |
|----------|---------------|
| Service | Samba or Syncthing |
| Port | 445 (Samba) |
| Purpose | Shared file access |
| Status | ⏳ Not installed |

**Installation (when ready):**
```bash
sudo apt install samba
sudo systemctl enable smbd
```

---

### Hostel Management API
| Property | Planned Value |
|----------|---------------|
| Service | Node.js / Python Flask |
| Port | 3000 or 5000 |
| Purpose | Backend API for hostel operations |
| Status | ⏳ Not installed |

---

### Food Ordering System
| Property | Planned Value |
|----------|---------------|
| Service | TBD |
| Database | Linked to main DB |
| Purpose | Track food orders |
| Status | ⏳ Not installed |

---

### Bed Management System
| Property | Planned Value |
|----------|---------------|
| Service | TBD |
| Database | Linked to main DB |
| Purpose | Track bed availability, bookings |
| Status | ⏳ Not installed |

---

## 🌐 Network Configuration

### Current Settings
| Property | Value |
|----------|-------|
| Hostname | `goko-server` |
| mDNS Address | `goko-server.local` |
| Connection | WiFi / Ethernet |

---

### 📶 Changing WiFi When Moving to New Location

When you take the Raspberry Pi to a new location with different WiFi, use one of these methods:

---

#### **Method 1: Temporary Ethernet Connection (Easiest & Recommended)**

1. Connect Pi to the new router via **Ethernet cable**
2. Find Pi's IP address (check router admin page or use `ping goko-server.local`)
3. SSH into the Pi:
   ```bash
   ssh goko@goko-server.local
   # Password: goko@123
   ```
4. Configure new WiFi:
   ```bash
   # Option A: Interactive menu (easiest)
   sudo nmtui
   # Select "Activate a connection" → Select your new WiFi → Enter password
   
   # Option B: Command line
   sudo nmcli device wifi list                                    # See available networks
   sudo nmcli device wifi connect "NEW_WIFI_NAME" password "NEW_PASSWORD"
   ```
5. Verify connection:
   ```bash
   nmcli connection show --active
   ping -c 4 google.com
   ```
6. Unplug Ethernet cable - Pi will now use WiFi

---

#### **Method 2: Edit SD Card from Another Computer (No Ethernet Needed)**

Use this if you don't have Ethernet access at the new location.

1. **Shut down Pi safely:**
   ```bash
   sudo shutdown -h now
   ```
2. **Remove SD card** and insert into your Mac/PC

3. **Open the boot partition** (labeled `bootfs`)

4. **Create a file called `wpa_supplicant.conf`:**
   ```
   country=IN
   ctrl_interface=DIR=/var/run/wpa_supplicant GROUP=netdev
   update_config=1

   network={
       ssid="NEW_WIFI_NAME"
       psk="NEW_WIFI_PASSWORD"
       key_mgmt=WPA-PSK
   }
   ```

5. **Save the file** and safely eject SD card

6. **Put SD card back** in Pi and power on

7. Pi will automatically connect to the new WiFi on boot

> ⚠️ **Note for newer Pi OS (Bookworm):** This method uses NetworkManager. If `wpa_supplicant.conf` doesn't work, use the Raspberry Pi Imager to re-flash with new WiFi credentials in Advanced Settings (your data on `/var/www/html` will be lost - backup first!).

---

#### **Method 3: Connect Monitor + Keyboard Temporarily**

If you have access to a monitor (HDMI) and USB keyboard:

1. Connect monitor and keyboard to Pi
2. Power on and wait for login prompt
3. Login: `goko` / `goko@123`
4. Run interactive network setup:
   ```bash
   sudo nmtui
   ```
5. Navigate: **Activate a connection** → Select WiFi → Enter password
6. Disconnect monitor/keyboard when done

---

#### **Method 4: Pre-Configure Multiple WiFi Networks (Best for Frequent Travel)**

Set this up **before** you travel! Pi will auto-connect to any known network.

```bash
# Add multiple WiFi networks in advance
sudo nmcli device wifi connect "HOME_WIFI" password "home_password"
sudo nmcli device wifi connect "HOSTEL_WIFI" password "hostel_password"
sudo nmcli device wifi connect "OFFICE_WIFI" password "office_password"

# View all saved networks
nmcli connection show

# Set priority (higher number = higher priority)
sudo nmcli connection modify "HOME_WIFI" connection.autoconnect-priority 100
sudo nmcli connection modify "HOSTEL_WIFI" connection.autoconnect-priority 90
sudo nmcli connection modify "OFFICE_WIFI" connection.autoconnect-priority 80
```

Now the Pi will automatically connect to whichever known network is available!

---

#### **Method 5: Create Fallback Hotspot (Advanced)**

Set this up in advance. If Pi can't find any known WiFi, it creates its own hotspot you can connect to.

**Setup (do this once while connected):**
```bash
# Create the fallback hotspot script
sudo nano /usr/local/bin/wifi-fallback.sh
```

Paste:
```bash
#!/bin/bash
# Wait for network
sleep 45

# Check if connected to internet
if ! ping -c 1 8.8.8.8 &> /dev/null; then
    echo "$(date): No internet, starting hotspot..." >> /var/log/wifi-fallback.log
    nmcli device wifi hotspot ssid "GokoPi-Setup" password "goko12345" ifname wlan0
fi
```

Enable it:
```bash
sudo chmod +x /usr/local/bin/wifi-fallback.sh

# Add to cron for boot
sudo crontab -e
# Add this line:
@reboot /usr/local/bin/wifi-fallback.sh
```

**Using the fallback hotspot at a new location:**
1. Power on Pi at new location
2. Wait 1-2 minutes
3. On your phone/laptop, connect to WiFi: `GokoPi-Setup` (password: `goko12345`)
4. SSH to Pi: `ssh goko@192.168.4.1`
5. Configure the real WiFi:
   ```bash
   sudo nmcli device wifi connect "ACTUAL_WIFI" password "actual_password"
   ```
6. Reboot Pi - it will now use the real WiFi

---

### WiFi Quick Reference Commands

| Task | Command |
|------|---------|
| List available networks | `sudo nmcli device wifi list` |
| Connect to network | `sudo nmcli device wifi connect "SSID" password "PASS"` |
| Show active connection | `nmcli connection show --active` |
| Show all saved networks | `nmcli connection show` |
| Delete saved network | `sudo nmcli connection delete "NETWORK_NAME"` |
| Interactive setup | `sudo nmtui` |
| Check WiFi status | `iwconfig wlan0` |
| Restart networking | `sudo systemctl restart NetworkManager` |

---

### Static IP (Optional)
Edit: `/etc/dhcpcd.conf`
```bash
interface wlan0
static ip_address=192.168.1.100/24
static routers=192.168.1.1
static domain_name_servers=8.8.8.8 8.8.4.4
```

### Firewall (UFW)
```bash
sudo ufw status           # Check status
sudo ufw allow 80/tcp     # Allow HTTP
sudo ufw allow 443/tcp    # Allow HTTPS
sudo ufw allow 22/tcp     # Allow SSH
sudo ufw enable           # Enable firewall
```

---

## 🔧 Troubleshooting Commands

### System Health
```bash
# Check disk space
df -h

# Check memory
free -h

# Check CPU temperature
vcgencmd measure_temp

# Check running processes
htop  # (install: sudo apt install htop)

# Check system uptime
uptime
```

### Service Issues
```bash
# View service logs
sudo journalctl -u nginx -f
sudo journalctl -u SERVICE_NAME --since "1 hour ago"

# Check all failed services
sudo systemctl --failed

# Restart all Goko services
sudo systemctl restart nginx
sudo systemctl restart cron
```

### Network Issues
```bash
# Check IP address
hostname -I

# Test internet connectivity
ping -c 4 google.com

# Check DNS
nslookup github.com

# Check listening ports
sudo netstat -tlnp
```

### Website Issues
```bash
# Test if website responds
curl -I http://localhost

# Check Nginx config syntax
sudo nginx -t

# View recent access
sudo tail -20 /var/log/nginx/access.log

# View recent errors
sudo tail -20 /var/log/nginx/error.log
```

---

## 💾 Backup & Recovery

### What to Backup
| Item | Location | Priority |
|------|----------|----------|
| Custom scripts | `/usr/local/bin/` | High |
| Nginx config | `/etc/nginx/sites-available/goko` | High |
| Systemd services | `/etc/systemd/system/goko-*.service` | High |
| Cron jobs | `sudo crontab -l > cron-backup.txt` | High |
| **Cloudflare Tunnel credentials** | `/root/.cloudflared/` | **Critical** |
| **Cloudflare Tunnel config** | `/root/.cloudflared/config.yml` | **Critical** |
| This documentation | Keep in GitHub repo | High |
| Database (future) | TBD | Critical |

### Quick Backup Command
```bash
# Create backup directory
mkdir -p ~/backups/$(date +%Y%m%d)

# Backup scripts
cp /usr/local/bin/*.sh ~/backups/$(date +%Y%m%d)/

# Backup nginx config
cp /etc/nginx/sites-available/goko ~/backups/$(date +%Y%m%d)/

# Backup cron
crontab -l > ~/backups/$(date +%Y%m%d)/crontab-backup.txt

# Backup systemd services
cp /etc/systemd/system/goko-*.service ~/backups/$(date +%Y%m%d)/

# ⚠️ CRITICAL: Backup Cloudflare Tunnel credentials
sudo cp /root/.cloudflared/9b687a18-c3f3-4680-9c0e-dc47c90701ad.json ~/backups/$(date +%Y%m%d)/
sudo cp /root/.cloudflared/config.yml ~/backups/$(date +%Y%m%d)/
sudo cp /root/.cloudflared/cert.pem ~/backups/$(date +%Y%m%d)/
```

### Recovery Steps
1. Flash fresh Raspberry Pi OS Lite
2. SSH in and restore scripts to `/usr/local/bin/`
3. Restore Nginx config
4. Restore systemd services
5. Restore cron jobs: `crontab cron-backup.txt`
6. **Install and restore Cloudflare Tunnel:**
   ```bash
   curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb -o cloudflared.deb
   sudo dpkg -i cloudflared.deb
   sudo mkdir -p /root/.cloudflared
   sudo cp ~/backups/YYYYMMDD/9b687a18-*.json /root/.cloudflared/
   sudo cp ~/backups/YYYYMMDD/config.yml /root/.cloudflared/
   sudo cp ~/backups/YYYYMMDD/cert.pem /root/.cloudflared/
   sudo cloudflared service install
   sudo systemctl enable cloudflared
   sudo systemctl start cloudflared
   ```
7. Run: `sudo systemctl daemon-reload`
8. Reboot and verify

---

## 📞 Support & Resources

- **Raspberry Pi Docs:** https://www.raspberrypi.com/documentation/
- **Nginx Docs:** https://nginx.org/en/docs/
- **Cloudflare Tunnel Docs:** https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/
- **Cloudflare Dashboard:** https://dash.cloudflare.com
- **GitHub Repo:** https://github.com/pdhiran/GokoHostelWebpages

---

## 📅 Change Log

| Date | Change | By |
|------|--------|-----|
| 2025-12-06 | Initial setup - Nginx, auto-updates, health checks | Setup |
| 2025-12-06 | Added comprehensive WiFi configuration guide for new locations | Setup |
| 2025-12-06 | Added Cloudflare Tunnel for public internet access (gokohostel.com) | Setup |
| | | |
| | | |

---

> 💡 **Remember:** After adding any new service, update this document!

