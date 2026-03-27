#!/bin/bash
# OrbityxAI v7.2 — Hetzner VPS Deploy Script
# Run this on a fresh Ubuntu 22.04 server as root
#
# Usage:
#   ssh root@204.168.149.130
#   curl -sSL https://raw.githubusercontent.com/BorisMalts/OrbityxAI/main/deploy.sh | bash
#   # or: scp deploy.sh root@204.168.149.130: && ssh root@204.168.149.130 bash deploy.sh

set -e

echo "══════════════════════════════════════════════"
echo "  OrbityxAI v7.2 — Deploy to Hetzner"
echo "══════════════════════════════════════════════"

# 1. System dependencies
echo "[1/6] Installing system packages..."
apt update && apt install -y python3 python3-pip python3-venv git

# 2. Stop old service if running
systemctl stop orbityx 2>/dev/null || true

# 3. Clone or update repo
echo "[2/6] Cloning repository..."
if [ -d /opt/OrbityxAI ]; then
    cd /opt/OrbityxAI
    git pull origin main
else
    cd /opt
    git clone https://github.com/BorisMalts/OrbityxAI.git
    cd /opt/OrbityxAI
fi

# 4. Python venv
echo "[3/6] Setting up Python environment..."
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip -q
pip install -r requirements.txt -q

# 5. Create .env if not exists
echo "[4/6] Checking .env..."
if [ ! -f .env ]; then
    cat > .env << 'ENVEOF'
EXCHANGE_KEY=your_key_here
EXCHANGE_SECRET=your_secret_here
TELEGRAM_TOKEN=your_telegram_token
TELEGRAM_CHAT_IDS=your_chat_ids
ENVEOF
    echo "  >>> Created .env — EDIT IT with real keys!"
else
    echo "  .env already exists, keeping it"
fi

# 6. Create systemd service
echo "[5/6] Creating systemd service..."
cat > /etc/systemd/system/orbityx.service << 'EOF'
[Unit]
Description=OrbityxAI Trading Bot (ML + Live)
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/OrbityxAI
ExecStart=/opt/OrbityxAI/.venv/bin/python run_live.py --mode live --exchange bybit --tf 1h --load model_1h.pkl --max-positions 3 --leverage 5 --min-rr 1.5
Restart=always
RestartSec=30
Environment=PYTHONUNBUFFERED=1
EnvironmentFile=/opt/OrbityxAI/.env

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable orbityx

# 7. Check model
echo "[6/6] Checking model..."
if [ -f model_1h.pkl ]; then
    echo "  model_1h.pkl found ($(du -h model_1h.pkl | cut -f1))"
else
    echo "  WARNING: model_1h.pkl not found!"
    echo "  Train it: python run_training.py --tf 1h"
fi

echo ""
echo "══════════════════════════════════════════════"
echo "  Deploy complete!"
echo "══════════════════════════════════════════════"
echo ""
echo "  Next steps:"
echo "    1. Edit keys:     nano /opt/OrbityxAI/.env"
echo "    2. Start bot:     systemctl start orbityx"
echo "    3. Check logs:    journalctl -u orbityx -f"
echo "    4. Stop bot:      systemctl stop orbityx"
echo "    5. Restart:       systemctl restart orbityx"
echo ""
echo "  Bot command:"
echo "    python run_live.py --mode live --exchange bybit --tf 1h \\"
echo "      --load model_1h.pkl --max-positions 3 --leverage 5"
echo ""
