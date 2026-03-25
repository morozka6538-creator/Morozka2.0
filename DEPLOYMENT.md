# ❄️ Morozka 2.0 VPS Deployment Guide

## 🚀 Option A: GitHub Actions (Recommended Pro Max)
Этот способ самый профессиональный и автоматизированный. Настройка занимает 2 минуты.

### 1. Добавьте секреты в GitHub
Перейдите в свой репозиторий: **Settings -> Secrets and Variables -> Actions -> New repository secret** и добавьте следующие ключи:

- `SSH_HOST`: `85.198.97.189`
- `SSH_USER`: `root`
- `SSH_KEY`: (вставьте содержимое файла `id_morozka`, который я вам дам)
- `JWT_SECRET`: любой секретный пароль (строка) для безопасности чата

### 2. Загрузите код
Просто сделайте `git push origin main`. GitHub сам:
- Зайдет на ваш сервер.
- Скачает последние изменения.
- Соберет Docker-контейнер.
- Запустит мессенджер.

---

## 🐳 Option B: One-Click Docker Deployment (Manual)

---

## 🛠️ Option B: Manual Setup (Nginx + PM2)

## 1. Initial Setup
SSH into your VPS and run the provision script to install Node, Nginx, and PM2:
```bash
git clone <your-repo-url> morozka
cd morozka
bash deploy/provision.sh
```

## 2. Configuration
Create your production `.env` file from the example:
```bash
cp server/.env.example server/.env
nano server/.env  # Update JWT_SECRET and other settings
```

## 3. Nginx Configuration
Copy the provided config to Nginx and update your domain:
```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/morozka
# Edit /etc/nginx/sites-available/morozka to set your 'server_name'
sudo ln -s /etc/nginx/sites-available/morozka /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl restart nginx
```

## 4. Run the Deployment
Build the client and start the backend using PM2:
```bash
bash deploy/deploy.sh
```

## 5. SSL (Mandatory for Video/Screen Sharing)
Use Certbot to get a free SSL certificate:
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

---
**Done!** Your Morozka 2.0 instance is live and secure.
