# Production checklist

## Before deploy

- Set strong `DB_PASS` and `JWT_SECRET` in `.env.production`.
- Confirm `CORS_ORIGIN` contains every frontend domain.
- Confirm `FRONTEND_URL=https://ctalkchinese.com`.
- Point `api.ctalkchinese.com` to the VPS public IP.
- Back up the PostgreSQL database and uploads volume.

## Deploy

```bash
cd /opt/ctalk/app
git pull
docker compose -f docker-compose.vps.yml --env-file .env.production exec -T postgres \
  sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < database/pronunciation.sql
docker compose -f docker-compose.vps.yml --env-file .env.production up -d --build
docker compose -f docker-compose.vps.yml --env-file .env.production ps
```

## Verify

```bash
curl https://api.ctalkchinese.com/api/health
docker compose -f docker-compose.vps.yml --env-file .env.production logs --tail=100 api
```

- Log in as admin, teacher, and student.
- Upload and play one pronunciation recording.
- Open the forum in two browsers and verify realtime updates.
- Verify uploaded files remain after restarting the API container.
- Verify the browser console has no CORS or Socket.IO errors.
