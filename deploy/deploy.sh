#!/bash
# deploy.sh - Build and deployment automation for Morozka 2.0

echo "❄️ Morozka 2.0 - Deployment Started..."

# 1. Install dependencies
npm run install-all

# 2. Build frontend
echo "Building frontend..."
cd client && npm run build && cd ..

# 3. Restart production server
echo "Restarting PM2..."
pm2 startOrReload deploy/ecosystem.config.cjs --update-env

echo "✅ Deployment successful! Check your app at your VPS address."
