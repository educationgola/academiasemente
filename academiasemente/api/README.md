# Academia Semente — Cloudflare Worker

API for:
- Student auth (email/password + Google Identity Services ID token)
- Student courses, signed private video URLs, watch progress, profile
- In-app **notifications** and **certificates** (auto on 100% course completion)
- Public enrolment (`/api/enroll`) and product orders (`/api/orders`)
- Admin: students, courses/videos, enrolments, orders, **avisos** (notify / broadcast), Cloudinary sign
- Signed Cloudinary upload params (authenticated videos + public cover images)

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

**Existing production DB:** re-running the full `schema.sql` is safe (`IF NOT EXISTS`).  
Always run from this `api/` directory so `./schema.sql` resolves:

```bash
cd path/to/academiasemente/api
npx wrangler d1 execute academiasemente-db --remote --file=./schema.sql
npx wrangler deploy
```

Tables (including later additions): `users`, `courses`, `videos`, `user_courses`, `sessions`, `watch_progress`, `enrollments`, `orders`, **`notifications`**, **`certificates`**.

### 3. Set secrets (never commit these)
```bash
npx wrangler secret put JWT_SECRET
# any long random string, e.g. openssl rand -hex 32

npx wrangler secret put ADMIN_PASSWORD
# staff password for admin.html

npx wrangler secret put CLOUDINARY_API_KEY
npx wrangler secret put CLOUDINARY_API_SECRET
```

List secrets (names only):
```bash
npx wrangler secret list
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
- Private videos: upload as `type=authenticated` (or private)
- Admin panel can **sign** uploads (`POST /api/admin/cloudinary/sign`); the browser uploads **directly** to Cloudinary (not through the Worker)
  - Videos: `resource_type: video`, `type: authenticated` → `academiasemente/private/…`
  - Course covers: `resource_type: image` (public) → `academiasemente/covers/…`
- Catalog public_id: `academiasemente/catalog` (raw JSON)

**Video size tip:** prefer compressed 720p MP4 (~under 80–100 MB) for reliable browser upload. Larger files can be uploaded in the Cloudinary console, then paste the `public_id` in admin.

## Local dev
```bash
npx wrangler dev
```
Set `WORKER_URL` in `site/js/config.js` to `http://127.0.0.1:8787` while testing.

## API overview

### Public / student

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/health | — | Liveness |
| POST | /api/enroll | — | Public enrolment form → `enrollments` |
| POST | /api/orders | — | Public product checkout → `orders` |
| POST | /api/auth/register | — | Email/password sign-up |
| POST | /api/auth/login | — | Email/password login |
| POST | /api/auth/google | — | Google ID token → session |
| GET | /api/auth/me | Student | Current user |
| GET | /api/student/courses | Student (not suspended) | Granted courses + videos + progress + last_watched |
| GET | /api/student/videos/:id/url | Student (not suspended) | Signed Cloudinary URL + resume position |
| POST | /api/student/videos/:id/progress | Student (not suspended) | Save watch position / completed; may auto-issue **certificate** |
| POST | /api/student/profile | Student | Update name + phone |
| POST | /api/student/password | Student | Change or set password |
| GET | /api/student/notifications | Student | List notifications + `unread` count |
| POST | /api/student/notifications/read | Student | Mark one (`id`) or all as read |
| GET | /api/student/certificates | Student | List certificates |
| POST | /api/student/certificates/claim | Student (active) | Claim cert when course is 100% complete |
| GET | /api/student/certificates/:id | Student | Single certificate |

### Admin — auth & summary

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/admin/login | — | Admin password → JWT (12h) |
| GET | /api/admin/summary | Admin | Counts for UI badges (students, pending enrolments/orders, etc.) |
| POST | /api/admin/publish | Admin | Upload catalog.json to Cloudinary |

### Admin — students

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/admin/students | Admin | List (`?q=` name/email/phone, `?status=`, `?limit=`) + courses + history |
| POST | /api/admin/students/grant | Admin | Grant course → activates pending user + **notification** |
| POST | /api/admin/students/revoke | Admin | Revoke course access |
| POST | /api/admin/students/update | Admin | Update `name`, `phone`, `status` (`pending` \| `active` \| `suspended`) |
| POST | /api/admin/students/delete | Admin | Delete student |

### Admin — notifications

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/admin/notifications | Admin | Send to one student (`user_id`, `title`, `body`) |
| POST | /api/admin/notifications/broadcast | Admin | Send to all active students (`title`, `body`, `only_active` default true) |

### Admin — enrolments & orders

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/admin/enrollments | Admin | List (`?status=pending\|done`, `?q=`) |
| POST | /api/admin/enrollments/done | Admin | Mark enrolment handled |
| POST | /api/admin/enrollments/delete | Admin | Permanent delete enrolment |
| GET | /api/admin/orders | Admin | List (`?status=pending\|done`, `?q=`) |
| POST | /api/admin/orders/done | Admin | Mark order handled |
| POST | /api/admin/orders/delete | Admin | Permanent delete order |

### Admin — courses & videos

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/admin/courses | Admin | List courses + videos (includes inactive) |
| POST | /api/admin/courses | Admin | Create/update course (upsert by `id`) |
| POST | /api/admin/courses/delete | Admin | Soft-delete (`active=0`) or hard-delete if `permanent: true` |
| POST | /api/admin/courses/restore | Admin | Restore soft-deleted course |
| POST | /api/admin/videos | Admin | Create/update video (needs `course_id` + `cloudinary_public_id`) |
| POST | /api/admin/videos/delete | Admin | Soft-delete or hard-delete if `permanent: true` |
| POST | /api/admin/videos/restore | Admin | Restore soft-deleted video |
| POST | /api/admin/cloudinary/sign | Admin | Signed params for video (`authenticated`) or image cover (`resource_type: image`) |

## Admin panel (`site/admin.html`)

Product-app UI: **desktop sidebar** + **mobile bottom tabs**.

- **Alunos:** search, status filter, change status, edit, grant/revoke, delete, bulk “Limpar probes”
- **Inscrições:** filter + search; Concluir / WhatsApp / Apagar
- **Encomendas:** filter + search; Concluir / WhatsApp / Apagar
- **Cursos & Vídeos:** create/edit courses; cover + video upload; soft-delete / restore
- **Avisos:** notify one student or broadcast to all active
- **Guia:** staff quick reference

## Student app (`site/conta.html`)

Product-app UI: **bottom nav** — Cursos · Avisos · Certificados · Perfil.

- Progress + resume; video player with nodownload hints
- Notifications (grant course, certificate, admin avisos)
- Certificates auto-created when all videos in a course are completed (also claimable from the course card)

## Certificates & notifications (behaviour)

1. Admin **grants** a course → student gets a notification.
2. Student completes the **last video** of a course → certificate row + notification (progress response may include `certificate`).
3. Admin **Avisos** panel can message one user or all active users.

## Security notes
- Cloudinary API secret and admin password live **only** as Worker secrets.
- Student passwords are hashed with PBKDF2 (**12 000** iterations — kept low for Workers CPU limits).
- New student accounts start as `pending` until staff activates / grants a course.
- **Suspended** users are rejected on course list, video URL, and progress (not only at login).
- Private video URLs expire (default 1 hour).
- Download blocking in the browser is **best-effort** (`controlsList`, no context menu) — not DRM.
- Do **not** proxy large videos through the Worker (body limit ~100 MB; direct signed upload is preferred).

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Admin UI **Failed to fetch** | Worker may be down or throwing. Deploy: `npx wrangler deploy`. Health: `/api/health`. |
| `error code: 1101` from Cloudflare | Uncaught exception in Worker. Ensure handlers are `return await handle…` so `try/catch` applies. Redeploy latest `src/index.js`. |
| Unauthenticated `GET /api/admin/students` | Should return **JSON** `{"error":"Não autorizado."}` with **401** (with CORS), not 1101. |
| Missing tables / “no such table” | `npx wrangler d1 execute academiasemente-db --remote --file=./schema.sql` |
| 401 after login works once then fails | Log out and log in again (token / JWT_SECRET). |
| Video upload Failed to fetch | Direct Cloudinary POST failed (size/network). Compress or upload in Cloudinary console and paste `public_id`. |
