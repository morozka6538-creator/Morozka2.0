#!/bash
# provision.sh - One-click VPS setup for Morozka 2.0 (Ubuntu/Debian)

echo "❄️ Morozka 2.0 - Server Provisioning Started..."

# 1. Update system
sudo apt update && sudo apt upgrade -y

# 2. Install Node.js 20 (LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 3. Install Nginx and PM2
sudo apt install -y nginx
sudo npm install -g pm2

# 4. Setup firewall
sudo ufw allow 'Nginx Full'
sudo ufw allow ssh
sudo ufw --force enable

echo "✅ Provisioning complete. Node: $(node -v), Nginx: $(nginx -v), PM2: $(pm2 -v)"
echo "🚀 Next step: Configure your .env and run deploy/deploy.sh"
