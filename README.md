# GZX Gaming — Loyalty Management System

Staff web app for the GZX Gaming PlayStation lounge: register customers, issue a loyalty card
with a permanent **six-letter code** and **QR code**, record **verified paid hours** (1 punch per hour),
unlock **1 FREE HOUR + 1 FREE DRINK** after 3 punches, redeem it, and keep every action forever.

**Stack:** Next.js 15 (App Router, server actions) · React 19 · TypeScript · Tailwind CSS · Lucide ·
Supabase (PostgreSQL, Auth, Row Level Security) · Zod · `qrcode` + `jsQR` / native BarcodeDetector.
Timezone for all business days and display: **Asia/Baghdad** (stored in UTC).

---

## How it works

| Step | What happens | Where |
|---|---|---|
| Register | Name (+ optional phone/notes) → customer, unique code (e.g. `AXKJTR`), secret QR token, cycle #1 at 0/3 | `/customers/new` → `register_customer()` |
| Find | Camera QR scan **or** typed 6-letter code (lowercase OK). Never adds a punch | `/scan` → `find_customer_by_qr()` / `find_customer_by_code()` |
| Paid hour | **Add 1 paid hour** → confirmation dialog → 1 punch saved with cashier + time | `/customers/[id]` → `add_paid_hour()` |
| 3rd hour | Cycle completes, exactly one reward is created, gold circle lights up | same function, same transaction |
| Redeem | **Redeem reward** → confirmation → reward redeemed, cycle closed, new cycle 0/3 (atomic) | `redeem_reward()` |
| History | Every event, staff member, cycle and receipt reference, kept after resets | `/customers/[id]/history` |

Routes: `/login` `/dashboard` `/scan` `/customers` `/customers/new` `/customers/[id]` `/customers/[id]/history`
`/rewards` `/reports` `/staff` `/settings` · plus `/print/[id]` (printable card), `/c/[token]` (QR target),
`/forgot-password`, `/reset-password`.

### Roles
| | Cashier | Super admin |
|---|:-:|:-:|
| Register / find customers, scan QR, print cards | ✅ | ✅ |
| Add paid hours, redeem rewards, view customer history | ✅ | ✅ |
| Dashboard, reports | — | ✅ |
| Correct (void) a paid hour with a reason, deactivate/reissue cards, deactivate customers | — | ✅ |
| Manage staff, change settings | — | ✅ |

Permissions are enforced **in the database** (every function calls `require_staff()`), not only in the UI.

### Security design
* All writes go through `SECURITY DEFINER` Postgres functions; the `authenticated` role has **SELECT only**
  (via RLS) and `anon` has **nothing**. History tables are append-only — triggers block UPDATE/DELETE even for the DB owner.
* Each paid hour / redemption carries a client-generated **idempotency key** (unique in the DB), so double taps
  and network retries never create a second punch.
* Customer row lock (`SELECT … FOR UPDATE`) serializes concurrent cashiers; a partial unique index allows only one
  valid punch per slot (1, 2, 3) per cycle; `rewards.cycle_id` is unique; one open cycle per customer.
* Codes come from `gen_random_bytes` with rejection sampling (no modulo bias), are never sequential and are retried on collision.
* The QR contains only `https://<your-app>/c/<192-bit random token>` — no name or phone. Opening it requires a staff login.
* Lookups are rate-limited per staff member (default 20/min and 15 failures/10 min, configurable in Settings).
* The service-role key is used only server-side to create staff logins (`src/lib/supabase/admin.ts`, `server-only`).

Design notes: [`docs/DESIGN.md`](docs/DESIGN.md).

---

## Deploy it (free tiers)

### 1. Create the Supabase project
1. Sign up at <https://supabase.com> → **New project**. Pick the region closest to Iraq (e.g. Frankfurt / `eu-central-1`).
2. Save the database password somewhere safe.

### 2. Run the database migrations
**Option A — SQL editor (no tools needed):** Supabase dashboard → **SQL Editor** → paste and run each file **in order**:
1. `supabase/migrations/20261102000001_schema.sql`
2. `supabase/migrations/20261102000002_functions.sql`
3. `supabase/migrations/20261102000003_security.sql`

**Option B — Supabase CLI:**
```bash
npx supabase login
```
```bash
npx supabase link --project-ref YOUR-PROJECT-REF
```
```bash
npx supabase db push
```

### 3. Configure Supabase Auth
Dashboard → **Authentication**:
* **Sign In / Providers → Email:** enabled. **Turn OFF "Allow new users to sign up"** (staff are created by an admin).
* **URL Configuration:** *Site URL* = your app URL (e.g. `https://gzx-loyalty.netlify.app`).
  *Redirect URLs* → add `https://gzx-loyalty.netlify.app/auth/callback` (and `http://localhost:3000/auth/callback` for local dev).
* (Recommended) **Emails → SMTP:** add your own SMTP for password-reset emails — Supabase's built-in sender is rate-limited and meant for testing.

### 4. Create the first administrator (securely)
1. **Authentication → Users → Add user → Create new user**: owner's email + a strong password, tick *Auto Confirm User*.
2. **SQL Editor**, run once:
   ```sql
   select public.bootstrap_first_admin('owner@example.com', 'Owner Name');
   ```
   This function only works while no admin exists and cannot be called from the app or the public API.
3. Sign in to the app and add cashiers on **/staff** (that page needs `SUPABASE_SERVICE_ROLE_KEY`).

### 5. Environment variables
Copy `.env.example` → `.env.local` for local development; set the same keys in your host's dashboard.

| Variable | Where to find it | Exposed to browser? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API | yes (safe) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same page, `anon` `public` key | yes (safe — RLS protects data) |
| `NEXT_PUBLIC_APP_URL` | your public HTTPS URL, no trailing slash — printed in every QR | yes |
| `SUPABASE_SERVICE_ROLE_KEY` | same page, `service_role` key | **NO — server only, never prefix with `NEXT_PUBLIC_`** |

> Set `NEXT_PUBLIC_APP_URL` **before printing cards** — it is encoded in the QR. If the domain changes later,
> old QR codes still work as long as the old domain redirects, and manual codes always work.

### 6. Host the app — Netlify free plan (commercial use permitted)
1. Push this folder to a GitHub repository.
2. <https://app.netlify.com> → **Add new site → Import an existing project** → pick the repo.
   Netlify detects Next.js (`netlify.toml` is included).
3. **Site configuration → Environment variables:** add the four variables above.
4. Deploy. You get a free HTTPS subdomain: **Site configuration → Domain management → Options → Edit site name**
   → e.g. `gzx-loyalty` → `https://gzx-loyalty.netlify.app`. Update `NEXT_PUBLIC_APP_URL` and the Supabase
   Site/Redirect URLs to match, then redeploy.

**Commercial-use check (please confirm before launch — terms change):**
* **Netlify Free:** commercial use is allowed (stated by Netlify staff and in 2026 plan reviews). Usage is credit-based;
  a single-lounge staff app uses a tiny fraction of it.
* **Vercel Hobby: NOT allowed** for a business — Vercel's fair-use guidelines restrict Hobby to non-commercial personal use;
  a paying business needs Vercel Pro. That is why Netlify is recommended here.
* **Supabase Free:** 2 projects, 500 MB database (enough for hundreds of thousands of punches), **projects pause after
  7 days without activity** (a daily-used lounge never hits this; if it does, click *Restore* in the dashboard — data is kept),
  **no automatic backups on Free** → use the backup script below. Upgrade to Pro (~$25/month) for daily backups and no pausing.

### 7. Test the camera scanner over HTTPS
Browsers only allow the camera on HTTPS (or `localhost`). After deploying:
1. Open `https://<your-site>/scan` on a phone, tap **Scan QR code**, allow the camera.
2. Open any customer → **Print card** (or show the card on another screen) and point the phone at the QR.
3. The profile opens; **no punch is added** until you press *Add 1 paid hour* and confirm.
4. Deny the permission once to see the recovery instructions; the 6-letter code box always works without a camera.
* iPhone: Safari ≥ 15 / Chrome. Android: Chrome. Desktop: any webcam; switch cameras with the dropdown.
* Staff phones can also scan the card with the normal camera app — the URL opens the profile if they are signed in.

### 8. Back up customer data
* **Manual export:** Supabase → **Database → Backups** (Pro) or run `scripts/backup.sh` from any computer with PostgreSQL tools:
  ```bash
  SUPABASE_DB_URL='postgresql://postgres.REF:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres' ./scripts/backup.sh
  ```
  (Connection string: Supabase → **Connect → Session pooler**.) Run it weekly (or daily via cron / a scheduled CI job) and keep copies off-site.
* Restore: `pg_restore --no-owner --no-privileges --dbname "$TARGET_DB_URL" backups/<file>.dump`.

### 9. Install on staff devices (optional PWA)
Open the site → browser menu → **Add to Home Screen**. It runs full-screen with the GZX icon.
An internet connection is always required — data is never stored offline.

---

## Develop locally
```bash
npm install
```
```bash
cp .env.example .env.local
```
```bash
npm run dev
```
Seed sample customers (development project only — never production), after creating the first admin:
run `supabase/seed.sql` in the SQL editor.

Design preview with fixture data and no database: set `ENABLE_DESIGN_PREVIEW=1` and open
`/preview`, `/preview?screen=profile&p=3`, `/preview?screen=scan`, `/preview?screen=dashboard`.
**Never set this variable in production.**

## Tests
```bash
npm test
```
```bash
npm run test:db
```
```bash
npm run typecheck && npm run lint && npm run build
```
* `npm test` — unit tests (code validation/normalisation, QR payload parsing, Baghdad time, history lines, error mapping).
* `npm run test:db` — runs all migrations on a throwaway local PostgreSQL (needs `psql` with superuser access)
  and executes `supabase/tests/10_loyalty_tests.sql` as the real `authenticated`/`anon` roles, plus
  `supabase/tests/20_concurrency_test.sh` with real parallel sessions.

### Coverage of the required scenarios
| # | Scenario | Verified by |
|---|---|---|
| 1–3 | Register, unique code, collision retry | DB tests (forced double collision) |
| 4 | Valid QR generated | QR rendered on card; URL format unit test |
| 5–8 | QR lookup, code lookup, lowercase, invalid code | DB tests + unit tests |
| 9, 17, 27 | Return later / history kept / consistent across devices | DB tests (state is server-side only; profile refreshes on focus) |
| 10–14 | Hours 1–3, exactly one reward, 4th punch blocked | DB tests |
| 15, 16, 18 | Redeem, new cycle, no double redemption | DB tests |
| 19, 20 | Duplicate submission, two cashiers at once | Concurrency test (12 parallel punches → 3; 4 parallel redemptions → 1; same key ×4 → 1) |
| 21 | Staff permission restrictions | DB tests (anon, non-staff, disabled staff, cashier vs admin) |
| 22 | Lookup rate limiting | DB tests |
| 23–25 | Camera denied, manual lookup without camera, mobile layout | Implemented + screenshots at 390 px / 1440 px; **verify on real devices after deploy** |
| 26 | Print alignment & QR readability | Print page uses exact mm sizes; **do one test print on card stock** |
