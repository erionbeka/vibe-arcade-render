# Vibe Arcade

A community site where vibe coders upload and share their games — playable right in the browser, with likes, ratings, comments, tags and search.

## Run it

```
npm install
npm start
```

Open http://localhost:3000

If port 3000 is taken:

```
set PORT=3001 && npm start     (Windows CMD)
$env:PORT=3001; npm start      (PowerShell)
```

## Features

- **Accounts** — register / log in (sessions, bcrypt-hashed passwords)
- **Upload games**
  - Playable web games: a `.zip` containing `index.html` (root or single top-level folder), or a single `.html` file
  - Downloadable builds: any `.zip`
  - Optional screenshot + up to 8 tags
  - Original zip always kept as downloadable source ("remix" culture)
- **Gallery** — search, tag filter chips, sort by newest / most liked / most played / top rated
- **Play page** — games run in a sandboxed iframe (`allow-scripts` only; no same-origin access to the site)
- **Social** — like, 5-star ratings, comments, play/download counters
- **Moderation** — report button on every game; `/admin.html` queue for admins to delete or dismiss; the **first registered account automatically becomes an admin** (or set `ADMIN_USERNAME=yourname` env var); admins can delete any game/comment
- **Ownership** — authors can delete their own games and comments

## Stack

Node.js + Express, SQLite (better-sqlite3), express-session, multer, adm-zip. No build step — vanilla JS frontend.

## Layout

```
server.js          entry point
src/db.js          schema + connection
src/auth.js        register/login/logout routes
src/games.js       game CRUD, upload/extraction, social endpoints
public/            frontend (static HTML/CSS/JS)
uploads/           user content (games, screenshots) - created at runtime
data/              sqlite db + session secret - created at runtime
sample-game/       neon-snake.html you can use as your first upload
```

## Deploying FREE (Render)

Fastest path — no credit card, live at `https://<yourname>.onrender.com` in ~10 minutes:

1. Push this repo to GitHub (see below).
2. Go to **render.com → New → Blueprint**, connect your repo. The included
   `render.yaml` configures everything (free plan, auto-seed of the 100 demo games,
   secure cookies, proxy trust).
3. Add a custom domain in Render's dashboard (Settings → Custom Domains) and point
   your DNS `CNAME` at the provided target. TLS is automatic.

Free-tier trade-offs: the service sleeps after 15 min idle (~50s wake-up for the next
visitor) and the disk is ephemeral — accounts/uploads reset on sleep or redeploy.
The 100 seed games republish automatically on every boot (`AUTO_SEED=1`). When real
people start using it, move to Option A/B above to keep data permanently.

## Deploying with your own domain (paid options)

The app is stateful (SQLite + uploaded files), so it needs **one server with persistent disk**. Two easy paths:

### Option A — VPS (full control, ~$5/mo)

1. Point your domain's DNS: an `A` record `@` and `www` -> your server's IP.
2. On the server (Ubuntu example):
   ```bash
   git clone <your repo> && cd game && npm ci
   sudo npm i -g pm2
   pm2 start server.js --name vibe-arcade --env production
   pm2 save && pm2 startup
   ```
3. HTTPS + reverse proxy with Caddy (automatic Let's Encrypt):
   ```
   # /etc/caddy/Caddyfile
   yourdomain.com {
       reverse_proxy localhost:3000
   }
   ```
4. Run the app behind it with these env vars:
   ```
   NODE_ENV=production
   TRUST_PROXY=1        # real client IPs through Caddy
   SECURE_COOKIES=1     # session cookie only over HTTPS
   PORT=3000
   ```

### Option B — Render / Railway (no VPS to manage)

- Create a Node service from your repo and attach one **persistent disk** (e.g. mounted at `/storage`) — the free tiers have ephemeral disks, which would wipe your database and uploaded games on every deploy.
- Persist both state folders by symlinking at boot (add to start command) or set them up in a prestart script:
  ```
  mkdir -p /storage/data /storage/uploads
  ln -sfn /storage/data data && ln -sfn /storage/uploads uploads
  npm start
  ```
- Set env: `NODE_ENV=production`, `TRUST_PROXY=1`, `SECURE_COOKIES=1`, `SESSION_SECRET=<long random string>`.
- Add your custom domain in the dashboard; TLS certificates are automatic.

### Production checklist

- [x] Rate limiting on login/register/uploads
- [x] Security headers, nosniff on uploads, sandboxed game iframes
- [ ] Set `SECURE_COOKIES=1` + `TRUST_PROXY=1` behind your proxy
- [ ] Back up `data/vibe-arcade.db` (SQLite file) periodically
- [ ] If you outgrow one box: swap SQLite for Postgres and move `uploads/` to S3-compatible storage

## Security notes

- Uploaded zips are extracted with zip-slip protection (paths validated against the target dir)
- Games execute inside `<iframe sandbox="allow-scripts allow-pointer-lock">` — they cannot touch site cookies or storage
- Upload size/type limits enforced server-side; user text is rendered escaped
