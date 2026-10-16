# Academia Semente — Cloudflare Worker

API for:
- Student auth (email/password + Google Identity Services ID token)
- Admin password login + publish catalog to Cloudinary
- Student course assignments
- Signed private video URLs

**Live URL:** https://academiasemente.educationgola.workers.dev  
Health: https://academiasemente.educationgola.workers.dev/api/health

## One-time setup

Run all commands from this `api/` folder (must contain `wrangler.toml`).

### 1. Create D1 database
```bash
npx wrangler d1 create academiasemente-db
```
Copy the `database_id` into `wrangler.toml`.

### 2. Apply schema
```bash
npx wrangler d1 execute academiasemente-db --remote --file=./schema.sql
```

### 3. Set secrets (never commit these)
```bash
npx wrangler secret put JWT_SECRET
# any long random string, e.g. openssl rand -hex 32

npx wrangler secret put ADMIN_PASSWORD
# staff password for admin.html

npx wrangler secret put CLOUDINARY_API_KEY
npx wrangler secret put CLOUDINARY_API_SECRET
```

`GOOGLE_CLIENT_ID` is a public var in `wrangler.toml` (not a secret).  
`GOOGLE_CLIENT_SECRET` is **not** required for the GIS button / ID-token flow used on `conta.html`.

### 4. Deploy
```bash
npx wrangler deploy
```
Put the Worker URL in `site/js/config.js` → `WORKER_URL`.

### 5. Google OAuth — Authorized JavaScript origins
In [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials → your Web client:

**Authorized JavaScript origins** (scheme + host only, no path):
- `https://academiasemente.pages.dev`
- later: `https://academiasemente.com` and `https://www.academiasemente.com`
- local testing: `http://localhost:8080` or `http://127.0.0.1:5500`

**Authorized redirect URIs:** leave empty for the GIS ID-token flow.

### 6. Cloudinary
- Cloud name: `lfoop5b8` (public, in `wrangler.toml` and `config.js`)
- Unsigned upload preset for public media (overwrite = off)
- Private videos: upload as `type=authenticated` (or `private`)
- Catalog public_id: `academiasemente/catalog` (raw JSON)

## Local dev
```bash
npx wrangler dev
```
Set `WORKER_URL` in `site/js/config.js` to `http://127.0.0.1:8787` while testing.

## API overview

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/health | — | Liveness |
| POST | /api/auth/register | — | Email/password sign-up |
| POST | /api/auth/login | — | Email/password login |
| POST | /api/auth/google | — | Google ID token → session |
| GET | /api/auth/me | Student | Current user |
| GET | /api/student/courses | Student | Courses + videos |
| GET | /api/student/videos/:id/url | Student | Signed Cloudinary URL |
| POST | /api/admin/login | — | Admin password → token |
| POST | /api/admin/publish | Admin | Upload catalog.json |
| GET | /api/admin/students | Admin | List students |
| POST | /api/admin/students/grant | Admin | Grant course |
| POST | /api/admin/students/revoke | Admin | Revoke course |
| GET | /api/admin/courses | Admin | List courses + videos |
| POST | /api/admin/courses | Admin | Create/update course |
| POST | /api/admin/videos | Admin | Create/update video |

## Security notes
- Cloudinary API secret and admin password live **only** as Worker secrets.
- Student passwords are hashed with PBKDF2 (**12 000** iterations — kept low for Workers CPU limits).
- New student accounts start as `pending` until staff activates / grants a course.
- Private video URLs expire (default 1 hour).
- CORS allows the Pages origin; browser “Failed to fetch” usually means the Worker crashed or is unreachable.
