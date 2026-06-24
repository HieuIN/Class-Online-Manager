# VPS deployment for CTalk Chinese

This setup runs the backend API, PostgreSQL, and uploaded files on one Ubuntu VPS.
The frontend stays on Cloudflare.

## Recommended VPS

- Ubuntu 22.04 or 24.04
- 1 vCPU and 2 GB RAM minimum
- 30 GB SSD minimum
- Vietnam VPS is fine. Singapore VPS is also good if pricing is better.

DNS:

- `ctalkchinese.com` -> Cloudflare frontend
- `www.ctalkchinese.com` -> Cloudflare frontend
- `api.ctalkchinese.com` -> VPS public IP

## 1. Install server packages

SSH into the VPS as root, then run:

```bash
apt update
apt install -y git nginx certbot python3-certbot-nginx ca-certificates curl
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
. /etc/os-release
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" > /etc/apt/sources.list.d/docker.list
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

## 2. Clone the app

```bash
mkdir -p /opt/ctalk
cd /opt/ctalk
git clone https://github.com/HieuIN/Class-Online-Manager.git app
cd app
cp .env.vps.example .env.production
nano .env.production
```

Change at least:

- `DB_PASS`
- `JWT_SECRET`
- SMTP values if you want forgot-password email
- `ANTHROPIC_API_KEY` if you want AI suggestions

## 3. Start backend and database

```bash
cd /opt/ctalk/app
docker compose -f docker-compose.vps.yml --env-file .env.production up -d --build
docker compose -f docker-compose.vps.yml --env-file .env.production ps
```

Fresh databases are initialized automatically from:

- `database/schema.sql`

For an existing production database, apply the pronunciation migration once:

```bash
docker compose -f docker-compose.vps.yml --env-file .env.production exec -T postgres \
  sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < database/pronunciation.sql
```

## 4. Configure Nginx

```bash
cp /opt/ctalk/app/deploy/nginx/ctalk-api.conf /etc/nginx/sites-available/ctalk-api
ln -sf /etc/nginx/sites-available/ctalk-api /etc/nginx/sites-enabled/ctalk-api
nginx -t
systemctl reload nginx
```

After `api.ctalkchinese.com` DNS points to the VPS IP:

```bash
certbot --nginx -d api.ctalkchinese.com
```

## 5. Check production

```bash
curl https://api.ctalkchinese.com/api/health
```

Expected response:

```json
{"ok":true}
```

Then open `https://ctalkchinese.com` and log in.
Change demo passwords immediately after first login.

## 6. Backups

Create a daily backup cron:

```bash
mkdir -p /opt/ctalk/backups
chmod +x /opt/ctalk/app/deploy/scripts/backup-db.sh
crontab -e
```

Add:

```cron
0 2 * * * cd /opt/ctalk/app && set -a && . ./.env.production && set +a && /opt/ctalk/app/deploy/scripts/backup-db.sh >> /var/log/ctalk-backup.log 2>&1
```

Backups are kept for 14 days in `/opt/ctalk/backups`.

## 7. Update deploy

```bash
cd /opt/ctalk/app
git pull
docker compose -f docker-compose.vps.yml --env-file .env.production exec -T postgres \
  sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < database/pronunciation.sql
docker compose -f docker-compose.vps.yml --env-file .env.production up -d --build
docker compose -f docker-compose.vps.yml --env-file .env.production ps
curl https://api.ctalkchinese.com/api/health
```
