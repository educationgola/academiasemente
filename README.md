# Academia Semente — Website

Professional luxury website for **Academia Semente**, an English language academy in Angola.

## Stack
- Pure HTML / CSS / JS
- No build step required
- Ready for **Cloudflare Pages** + GitHub

## Features
- Mobile-first, fully responsive
- Portuguese (default) + English language toggle
- Luxury visual style: thin 1–1.5px lines, generous whitespace, light typography
- Transparent → solid header on scroll (fixed dark-text state)
- Thin-line hamburger with elegant X animation
- Left slide-in mobile drawer
- Announcement bar that hides on scroll
- Hero with reception desk image
- Services & pricing section (Online / Presencial / Domiciliar)
- Service cards link to **dedicated enrolment page** and pre-select the course (`?course=`)
- Physical products shop with **shopping cart**
  - Add to cart, quantity +/−, remove item
  - Clear all, total
  - Cart drawer slides from the right; swipe to close on mobile
  - Cart persists in localStorage
  - **Checkout page** (`checkout.html`): order summary + delivery form → WhatsApp
- **Contact section** on home (`#contacto`) with general message form → WhatsApp
- **Dedicated enrolment page** (`inscricao.html`) with full form:
  - Nome, Telefone, Morada *, Província *, Município *
  - Curso pretendido, Horários disponíveis * (08h–10h Manhã / 14h–16h Tarde / Flexível)
  - Submits to WhatsApp with pre-filled enrolment message
- Contact details also in the **footer**
- Smooth scroll navigation

## Contact data (footer + contact section)
- WhatsApp: +244 945 574 700
- Email: academiasemente@gmail.com
- Location: Kilamba, Ed R29, Andar 6, Ap 63, Luanda, Angola
- Instagram: https://www.instagram.com/academiasemente
- Facebook: https://www.facebook.com/profile.php?id=61584786747541

## Project structure
```
academia-semente-website/
├── index.html          ← home (includes contact form)
├── inscricao.html      ← dedicated enrolment page
├── checkout.html       ← product checkout / delivery
├── css/styles.css
├── js/main.js
├── assets/
│   └── hero.jpg
└── README.md
```

## Deploy to Cloudflare Pages

1. Push this folder to a GitHub repository
2. In Cloudflare Dashboard → Pages → Create project → Connect to Git
3. Select the repository
4. Build settings:
   - Framework preset: **None**
   - Build command: *(leave empty)*
   - Build output directory: `/` (or the folder containing `index.html`)
5. Deploy

Alternatively, drag-and-drop the folder into Cloudflare Pages for a quick deploy.

## Local preview
```bash
npx serve .
# or
python3 -m http.server 8080
```

## Customisation
- Brand colours → CSS variables in `css/styles.css` (`:root`)
- All text content → `js/main.js` (`translations` object)
- Prices & product details → `index.html`
- Hero image → `assets/hero.jpg`

## Changelog

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

