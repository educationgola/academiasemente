# Academia Semente — Cloudflare Worker

API for:
- Student auth (email/password + Google OAuth)
- Admin password login + publish catalog to Cloudinary
- Student course assignments
- Signed private video URLs

## One-time setup

### 1. Create D1 database
```bash
cd worker
npx wrangler d1 create academiasemente-db
```
Copy the `database_id` into `wrangler.toml`.

### 2. Apply schema
```bash
npx wrangler d1 execute academiasemente-db --file=./schema.sql
# or for remote:
npx wrangler d1 execute academiasemente-db --remote --file=./schema.sql
```

### 3. Set secrets (never commit these)
```bash
npx wrangler secret put ADMIN_PASSWORD
# enter a strong password

npx wrangler secret put CLOUDINARY_API_KEY
# 886917295816366

npx wrangler secret put CLOUDINARY_API_SECRET
# (the secret you have)

npx wrangler secret put GOOGLE_CLIENT_SECRET
# (from Google Cloud Console)

npx wrangler secret put JWT_SECRET
# any long random string, e.g. openssl rand -hex 32
```

### 4. Deploy
```bash
npx wrangler deploy
```
Note the URL (e.g. `https://academiasemente.<subdomain>.workers.dev`) and put it in `js/config.js` → `WORKER_URL`.

### 5. Google OAuth authorized origins
In Google Cloud Console → Credentials → your OAuth client:
- Authorized JavaScript origins:
  - `https://academiasemente.educationgola.workers.dev` (or your Pages URL)
  - `http://localhost:8080` (for local testing)
  - later: `https://academiasemente.com` and `https://www.academiasemente.com`
- Authorized redirect URIs: usually not needed for the GIS One Tap / button flow (ID token).

### 6. Cloudinary
- Create an **unsigned** upload preset for public media (overwrite = off).
- For private videos: upload with `type=authenticated` (or `private`) via the Admin UI later, or use the Cloudinary Media Library with restricted access.
- Catalog public_id: `academiasemente/catalog` (raw).

## Local dev
```bash
npx wrangler dev
```
Update `WORKER_URL` in `js/config.js` to `http://127.0.0.1:8787` while testing.

## API overview

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/auth/register | — | Email/password sign-up |
| POST | /api/auth/login | — | Email/password login |
| POST | /api/auth/google | — | Google ID token |
| GET  | /api/auth/me | Student | Current user |
| GET  | /api/student/courses | Student | Courses + videos |
| GET  | /api/student/videos/:id/url | Student | Signed Cloudinary URL |
| POST | /api/admin/login | — | Admin password → token |
| POST | /api/admin/publish | Admin | Upload catalog.json |
| GET  | /api/admin/students | Admin | List students |
| POST | /api/admin/students/grant | Admin | Grant course |
| POST | /api/admin/students/revoke | Admin | Revoke course |
| GET  | /api/admin/courses | Admin | List courses + videos |
| POST | /api/admin/courses | Admin | Create/update course |
| POST | /api/admin/videos | Admin | Create/update video |

## Security notes
- Client Secret and API Secret live **only** as Worker secrets.
- Student passwords are hashed with PBKDF2 (100k iterations).
- Admin password is compared to the secret (change after handoff).
- Private video URLs expire (default 1 hour).
