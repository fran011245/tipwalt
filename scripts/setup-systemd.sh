#!/bin/bash
# Setup systemd service for Walt Tipping Bot
# Run with: sudo bash setup-systemd.sh

set -e

echo "🤖 Setting up Walt Bot systemd service..."

# Create service file
cat > /etc/systemd/system/walt-bot.service << 'EOF'
[Unit]
Description=Walt Tipping Bot
After=network.target

[Service]
Type=simple
User=walt
WorkingDirectory=/home/walt/.openclaw/workspace/projects/walt-tipping-system
Environment=NODE_ENV=production
ExecStart=/usr/bin/node bot/telegram-bot.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=walt-bot

[Install]
WantedBy=multi-user.target
EOF

echo "✅ Service file created"

# Reload systemd
systemctl daemon-reload
echo "✅ systemd reloaded"

# Enable service (starts on boot)
systemctl enable walt-bot
echo "✅ Service enabled (will start on boot)"

# Start service
systemctl start walt-bot
echo "✅ Service started"

# Show status
echo ""
echo "📊 Service status:"
systemctl status walt-bot --no-pager

echo ""
echo "🎉 Walt Bot is now running as a systemd service!"
echo ""
echo "Useful commands:"
echo "  sudo systemctl status walt-bot    # Check status"
echo "  sudo systemctl stop walt-bot      # Stop bot"
echo "  sudo systemctl start walt-bot     # Start bot"
echo "  sudo systemctl restart walt-bot   # Restart bot"
echo "  sudo journalctl -u walt-bot -f    # View logs"
