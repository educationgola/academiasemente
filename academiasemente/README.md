# Academia Semente

Professional luxury website for **Academia Semente**, an English language academy in Angola.

## Live URLs

| Piece | URL | What it is |
|-------|-----|------------|
| **Website** | https://academiasemente.pages.dev | Public site (share this) |
| **API** | https://academiasemente.educationgola.workers.dev | Backend only (`/api/...`) |

Root of the Worker returns `{"error":"Not found"}` — that is normal.  
Health check: https://academiasemente.educationgola.workers.dev/api/health

## Stack
- **Website**: Pure HTML / CSS / JS → Cloudflare Pages
- **API**: Cloudflare Worker + D1 + Cloudinary
- No build step for the website

## Features
- Mobile-first, fully responsive
- Portuguese (default) + English language toggle
- Luxury visual style: thin 1–1.5px lines, generous whitespace, light typography
- Transparent → solid header on scroll
- Services & pricing (Online / Presencial / Domiciliar) → enrolment page
- Physical products shop with shopping cart + checkout
- Contact form and enrolment form → WhatsApp
- Student area (`conta.html`): Google + email/password login, private videos
- Admin panel (`admin.html`): students, courses, grant access

## Contact
- WhatsApp: +244 945 574 700
- Email: academiasemente@gmail.com
- Location: Kilamba, Ed R29, Andar 6, Ap 63, Luanda, Angola
- Instagram: https://www.instagram.com/academiasemente
- Facebook: https://www.facebook.com/profile.php?id=61584786747541

## Project structure

GitHub repo (`educationgola/academiasemente`) has one extra nesting level:

```
educationgola/academiasemente/          ← GitHub repo root
└── academiasemente/                    ← project root (this folder)
    ├── site/                           ← Website → Cloudflare Pages
    │   ├── index.html
    │   ├── inscricao.html
    │   ├── checkout.html
    │   ├── conta.html                  ← Student area (Entrar)
    │   ├── admin.html                  ← Staff panel
    │   ├── css/
    │   │   ├── styles.css
    │   │   ├── conta.css
    │   │   └── admin.css
    │   ├── js/
    │   │   ├── main.js                 ← Site UI, i18n, cart
    │   │   ├── config.js               ← WORKER_URL, Google Client ID
    │   │   ├── conta.js                ← Student auth + dashboard
    │   │   └── admin.js
    │   └── assets/
    │
    ├── api/                            ← API → Cloudflare Worker
    │   ├── src/index.js
    │   ├── schema.sql
    │   ├── wrangler.toml
    │   └── README.md
    │
    └── README.md
```

### Cloudflare build settings (important)

| Project | Root directory |
|---------|----------------|
| **Pages** (website) | `academiasemente/site` |
| **Worker** (API) | `academiasemente/api` |

## How to update

| What you change | What to do |
|-----------------|------------|
| Website (HTML, CSS, JS, images in `site/`) | Push to GitHub → Pages updates automatically |
| API (files inside `api/`) | Push to GitHub → Worker Builds deploys automatically **or** run the command below |

### Deploy the API (Worker) manually
```bash
cd academiasemente/api   # from the GitHub repo root
# or, if you are already inside the project folder:
cd api
npx wrangler deploy
```

### Local preview (website)
```bash
cd site
npx serve .
# or
python3 -m http.server 8080
```

## Customisation
- Brand colours → `site/css/styles.css` (`:root`)
- All text content → `site/js/main.js` (`translations` object)
- Prices & product details → `site/index.html`
- Hero image → `site/assets/hero.jpg`
- Worker URL → `site/js/config.js` (`WORKER_URL`)

## Student area & auth

- Page: `site/conta.html` (nav label: **Entrar**)
- Auth: Google Identity Services (ID token) + email/password
- Backend: Worker `/api/auth/*` + D1 `users` table
- New accounts are **pending** until staff grants a course in `admin.html`
- Google Console → Authorized JavaScript origins must include `https://academiasemente.pages.dev` (redirect URIs not needed)

Secrets (Worker only, never in git): `JWT_SECRET`, `ADMIN_PASSWORD`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.  
See `api/README.md` for full setup.

## Changelog

### 2026-10-16 — Student auth live + UI polish
**What changed**
- Student area (`conta.html` + `conta.js` + `conta.css`) branded like the main site
- Google + email/password auth against the Worker; PBKDF2 iterations lowered for Workers CPU limits
- Nav: “Área do aluno” → **Entrar**; link added on inscrição/checkout; WhatsApp removed from mobile drawer
- Header brand hierarchy (larger ACADEMIA SEMENTE); products grid 2 columns on mobile
- Worker secrets + D1 schema applied; deploy to `academiasemente.educationgola.workers.dev`

**Files changed:**
- `site/conta.html`, `site/css/conta.css`, `site/js/conta.js` (new)
- `site/index.html`, `site/inscricao.html`, `site/checkout.html`
- `site/css/styles.css`, `site/js/main.js`, `site/js/config.js`
- `api/src/index.js`, `api/README.md`, `README.md`

### 2026-10-16 — Worker Builds fixed (nested repo path)
**What changed**
- Documented the actual GitHub nesting (`academiasemente/api` and `academiasemente/site`)
- Cloudflare Worker Root directory must be set to `academiasemente/api`
- Pages Root directory should be `academiasemente/site`
- Worker build now succeeds after correcting the path and using a fresh build token

**Files changed:**
- `README.md`

### 2026-10-03 — Post-order (product) confirmation screen
**What changed**
- After confirming a product order on `checkout.html`, shows a success screen with order summary
- Next steps: confirm order → Multicaixa reference / receipt → prepare and ship
- Cart is cleared after confirm; WhatsApp still opens with full order for the academy

**Files changed (download these for GitHub):**
- `checkout.html`
- `js/main.js`
- `css/styles.css`
- `README.md`

### 2026-10-03 — Post-enrolment confirmation screen
**What changed**
- After submitting the enrolment form, the form is replaced by a success screen
- Copy explains next steps: confirmation → Multicaixa reference / receipt → place + level test
- WhatsApp still opens so the academy receives the full enrolment data (manual payment flow)

**Files changed (download these for GitHub):**
- `inscricao.html`
- `js/main.js`
- `css/styles.css`
- `README.md`

### 2026-10-03 — Expanded enrolment form
**What changed**
- Enrolment form now includes personal data (idade, estado civil, e-mail), student level, and reflection questions from the academy owner:
  - Motivação para aprender inglês
  - Dificuldades na língua
  - Experiência anterior de estudo
  - Temas prioritários para começar a falar
- WhatsApp message includes all new fields

**Files changed (download these for GitHub):**
- `inscricao.html`
- `js/main.js`
- `css/styles.css`
- `README.md`

### 2026-10-03 — Checkout / scrolled header fix
**What changed**
- `.site-header.scrolled` no longer forces `top: 0` under the announce bar (brand name was hidden)
- Checkout page header: solid white + dark text (name, hamburger, cart, lang) on mobile and desktop

**Files changed (download these for GitHub):**
- `css/styles.css`
- `js/main.js`
- `README.md`

### 2026-10-03 — Product checkout page
**What changed**
- New **`checkout.html`**: order summary (images, qty +/−, remove), delivery form (nome, telefone, morada, província, município, notas)
- Cart “Finalizar compra” opens the checkout page (no longer jumps straight to WhatsApp)
- Confirm on checkout builds WhatsApp message with products + delivery details

**Files changed (download these for GitHub):**
- `checkout.html` *(new)*
- `js/main.js`
- `css/styles.css`
- `index.html` (cart button label)
- `inscricao.html` (cart button label)
- `README.md`

### 2026-10-02 — Enrol page header fix
**What changed**
- Header on `inscricao.html` was forced into solid white state even at the top of the hero
- Now matches homepage: transparent over hero, solid white after scroll (mobile + desktop)
- Active nav link readable on transparent and scrolled states

**Files changed (download these for GitHub):**
- `js/main.js`
- `css/styles.css`
- `README.md`

### 2026-10-02 — Enrolment page hero
**What changed**
- Hero section on `inscricao.html` using the same `assets/hero.jpg` as the homepage
- Enrolment-focused title, subtitle and CTAs (form + WhatsApp)
- Header transparent over hero, solid on scroll

**Files changed (download these for GitHub):**
- `inscricao.html`
- `css/styles.css`
- `js/main.js`
- `README.md`

### 2026-10-02 — Contact form restored + dedicated enrolment page
**What changed**
- Home **Contacto** section restored with general contact form (WhatsApp)
- New dedicated page **`inscricao.html`** for enrolment
- Enrolment form fields: Nome, Telefone, **Morada ***, **Província ***, **Município ***, Curso, **Horários disponíveis ***, Notas
- Schedule options: 08h–10h Manhã · 14h–16h Tarde · Flexível
- Course buttons open `inscricao.html?course=Online|Presencial|Domiciliar`
- Nav: Contacto + Inscrição

**Files changed (download these for GitHub):**
- `index.html`
- `inscricao.html` *(new)*
- `css/styles.css`
- `js/main.js`
- `README.md`

### 2026-10-02 — Contact → Enrolment + footer contact
**What changed**
- Contact section temporarily replaced by enrolment (superseded by entry above)
- Contact details in footer

**Files changed:**
- `index.html`
- `css/styles.css`
- `js/main.js`
- `README.md`

### 2026-10-02 — Cart bug fix (mobile + desktop)
**What changed**
- Cart was broken because `updateCartUI()` ran before `translations` / `currentLang` existed → TypeError stopped the script
- `currentLang` declared early; empty-cart label is defensive
- Larger touch targets on cart icon and close button

**Files changed (download these for GitHub):**
- `js/main.js`
- `css/styles.css`
- `README.md`

### 2026-10-01 — Cart, hero image & header fix
**Files changed:**
- `index.html` — hero image, enroll links to form, product “Adicionar” buttons, cart drawer markup, cart icon in header
- `css/styles.css` — fixed scrolled header text colours, hero split layout + image, cart drawer styles, header-actions
- `js/main.js` — full cart logic (localStorage, +/−, clear, WhatsApp checkout, swipe-to-close), enroll pre-select, updated translations
- `assets/hero.jpg` — added ambassador hero image
- `README.md` — updated features and changelog

### 2026-10-01 — Hero man cutout on brand green
**Files changed:**
- `assets/hero-man.png` — green background removed; only the ambassador remains (transparent PNG)
- `index.html` — hero uses `hero-man.png` instead of full artwork
- `css/styles.css` — hero image sizing/shadow tuned for cutout on solid green
- `README.md` — updated structure and changelog

The site hero keeps the original solid brand green; only the man is overlaid.

### 2026-10-01 — Hero man visible on mobile
**Files changed:**
- `css/styles.css` — hero image now shows on mobile (below text), sized for small screens; desktop unchanged
- `assets/hero-man.png` — confirmed cutout in use (full shoulders)
- `README.md` — changelog

### 2026-10-01 — Better hero portrait (full shoulders)
**Files changed:**
- `assets/hero-man.png` — replaced with new full-shoulder cutout (white bg removed via flood-fill)
- `README.md` — changelog

### 2026-10-01 — Mobile hero: text over the man
**Files changed:**
- `css/styles.css` — on mobile, man is positioned behind the hero text (absolute, bottom-aligned); text stays in front with light gradient for readability. Desktop split layout unchanged.
- `README.md` — changelog

### 2026-10-01 — Reception desk as hero image
**Files changed:**
- `assets/hero.jpg` — new reception desk photo (previous hero images deleted)
- `assets/hero-man.png` — **deleted**
- `index.html` — simplified hero (full-bleed background + text overlay)
- `css/styles.css` — hero uses cover background image with green tint overlay
- `README.md` — structure + changelog

### 2026-10-01 — Real product images in shop
**Files changed:**
- `assets/products/caderno.jpg` — notebook
- `assets/products/polo-front.jpg` — official polo (front)
- `assets/products/polo-back.jpg` — official polo (back, available)
- `assets/products/canetas.jpg` — pen kit
- `assets/products/manual.jpg` — student manual
- `index.html` — product cards use real photos; renamed Camiseta → Polo Oficial
- `css/styles.css` — product image cover + hover zoom
- `js/main.js` — PT/EN product title & description updated
- `README.md` — changelog

### 2026-10-01 — Contact section background
**Files changed:**
- `assets/contact-bg.jpg` — blurred lobby / reception background
- `index.html` — contact section bg layer
- `css/styles.css` — full-cover contact background + soft white/green overlay; form glass panel
- `README.md` — changelog

### 2026-10-01 — Porquê nós section background
**Files changed:**
- `assets/diff-bg.jpg` — soft mint leaf abstract background
- `index.html` — diferenciais bg layer
- `css/styles.css` — full-cover background; cards semi-transparent with blur
- `README.md` — changelog

### 2026-10-01 — Porquê nós card icons
**Files changed:**
- `assets/icons/metodologia.jpg`
- `assets/icons/empregabilidade.jpg`
- `assets/icons/tecnologia.jpg`
- `assets/icons/ambiente.jpg`
- `index.html` — numbers replaced with icon images on diff cards
- `css/styles.css` — `.diff-icon` styles
- `README.md` — changelog

### 2026-10-01 — Diff icons fill card squares
**Files changed:**
- `css/styles.css` — `.diff-icon` now full-width square (fills the card top), `object-fit: cover`
- `README.md` — changelog

### 2026-10-01 — Revert diff icon size
**Files changed:**
- `css/styles.css` — icons back to compact 72×72 squares (previous preferred style)
- `README.md` — changelog

### 2026-10-01 — Horários disponíveis icon
**Files changed:**
- `assets/icons/horarios.jpg` — calendar + clock icon
- `index.html` — icon in schedules card header
- `css/styles.css` — `.horarios-header` / `.horarios-icon` styles
- `README.md` — changelog

### 2026-10-02 — Horários card photo background
**Files changed:**
- `assets/horarios-bg.jpg` — blurred planner desk photo
- `css/styles.css` — horarios card uses photo bg with soft overlay; time slots as glass chips
- `README.md` — changelog

### 2026-10-02 — Modality card icons
**Files changed:**
- `assets/icons/online.jpg` — laptop + wifi + leaf
- `assets/icons/presencial.jpg` — open book + classroom
- `assets/icons/domiciliar.jpg` — house + leaf
- `index.html` — icons on Online, Presencial, Domiciliar price cards
- `css/styles.css` — `.price-icon` (72×72, matches Porquê nós)
- `README.md` — changelog

### 2026-10-02 — A Academia section visuals
**Files changed:**
- `assets/sobre-bg.jpg` — soft leaf + circuit abstract background
- `assets/icons/missao.jpg` — seed/sprout icon
- `assets/icons/visao.jpg` — globe + path icon
- `index.html` — sobre bg layer; Missão/Visão icons
- `css/styles.css` — `.sobre-bg`, `.mv-icon`; mv-cards glass style
- `README.md` — changelog

### 2026-10-02 — Mobile cart fixes
**Files changed:**
- `js/main.js` — cart actions delegated on drawer (X remove, Limpar tudo, WhatsApp); swipe ignores buttons; WhatsApp opens via anchor (iOS-friendly)
- `css/styles.css` — larger touch targets; SVG pointer-events none; footer buttons touch-action
- `README.md` — changelog

### 2026-10-02 — Remove em dashes from copy
**Files changed:**
- `index.html` — em dashes replaced with commas / simple hyphens in visible text
- `js/main.js` — PT and EN translations cleaned; WhatsApp line uses hyphen
- `README.md` — changelog

### 2026-10-02 — Cart footer hides when empty
**Files changed:**
- `css/styles.css` — `.cart-footer[hidden] { display: none !important }` (flex was overriding hidden)
- `js/main.js` — reset total to 0 and force hidden attribute on clear
- `README.md` — changelog

### 2026-10-02 — Polo product image slider
**Files changed:**
- `index.html` — polo card: front/back slider with dots + arrows
- `css/styles.css` — `.product-slider` track, dots, nav
- `js/main.js` — swipe (touch + mouse), dots, prev/next
- `assets/products/polo-back.jpg` — back view
- `README.md` — changelog

### 2026-10-02 — Fix polo slider showing both sides
**Files changed:**
- `css/styles.css` — `.product-slider` is `display: block` so track fills the card; only one side visible at a time
- `README.md` — changelog


---

## Architecture (2026-10-15) — Student accounts + Admin + Private videos

### Stack pieces
- **Cloudflare Pages** (`site/`) — public website
- **Cloudflare Worker** (`api/`) — auth API, admin, signed video URLs, catalog publish
- **Cloudflare D1** — students, courses, videos, assignments
- **Cloudinary** — public media + private/authenticated videos + `catalog.json`
- **Google OAuth** + email/password for students
- **Admin password** for staff

### Pages
| Page | Purpose |
|------|---------|
| `/conta.html` | Student login/signup (Google + email) + dashboard + private video player |
| `/admin.html` | Staff panel: students, courses, videos, grant access |

### Setup (free tier)
See `api/README.md` for full steps:
1. `cd api && npx wrangler d1 create academiasemente-db` → put `database_id` in `wrangler.toml`
2. `npx wrangler d1 execute academiasemente-db --remote --file=./schema.sql`
3. Set secrets: `ADMIN_PASSWORD`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `GOOGLE_CLIENT_SECRET`, `JWT_SECRET`
4. `npx wrangler deploy`
5. Put Worker URL in `site/js/config.js` → `WORKER_URL`
6. Google Console: add authorized JavaScript origins (Pages URL + workers.dev + later academiasemente.com)

### Secrets policy
**Never** commit API secrets or Google Client Secret. They live only as Worker secrets.

### Student flow
1. User creates account on `/conta.html` (Google or email/password) → status `pending`
2. Staff logs into `/admin.html` → creates Course + Videos (Cloudinary public_id)
3. Staff grants course to student → status becomes `active`
4. Student sees courses/videos; Worker returns short-lived signed Cloudinary URL

### Next iterations (planned)
- Full admin media library + site image slots + publish catalog (blueprint style)
- Link “Área do aluno” in public header/nav
- Custom domain `academiasemente.com` (when purchased)
