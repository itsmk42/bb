# builderballery.com

Practical authority website for residential construction guidance.

## Structure

- `/index.html`: Main website with 4 sections (Home, Videos, Consultation, Documents)
- `/assets/styles.css`: Main styles (mobile-first, minimal)
- `/assets/app.js`: Data loader and section rendering
- `/content/site.json`: Core profile and form config
- `/content/videos.json`: Video entries
- `/content/documents.json`: Document entries
- `/documents`: PDF storage
- `/builder-ops-97029/index.html`: Secret authenticated content manager (email/password only)
- `/admin/app.js`: Supabase auth, CRUD, and storage upload logic
- `/supabase/setup.sql`: SQL setup for tables, storage bucket, and policies

## Backend setup (Supabase)

1. Open Supabase SQL Editor and run `/supabase/setup.sql`.
2. In Supabase Auth -> URL Configuration, add site URL and redirect URL:
   - `https://builderballery.com`
   - `https://builderballery.com/builder-ops-97029/`
   - `http://localhost:3000/builder-ops-97029/` (for local testing)
3. In Supabase Auth -> Providers -> Email:
   - Keep `Disable new user signups` enabled.
   - Keep Google/OAuth disabled for this admin flow.
4. Create/maintain admin user `builderjo@admin.com` and sign in at `/builder-ops-97029/`.

If an existing admin account still fails with `email_not_confirmed`, run:
- `/supabase/confirm-admin-user.sql`

## Environment variables

1. Copy `.env.example` to `.env` and set:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_STORAGE_BUCKET` (default `documents`)
   - `ADMIN_EMAIL` (default `builderjo@admin.com`)
2. Generate runtime config used by browser scripts:

```bash
node scripts/generate-env-config.mjs
```

This updates `/assets/env-config.js`, which is loaded by both:
- `/index.html`
- `/builder-ops-97029/index.html`

## How content loading works

- Public website reads from Supabase tables `videos` and `documents` when rows exist.
- If Supabase tables are empty or unavailable, website falls back to local JSON:
  - `/content/videos.json`
  - `/content/documents.json`
- Admin uploads documents to Supabase storage bucket `documents` and writes metadata to table `documents`.
- Admin adds reels directly to table `videos`.

## Form to email setup

This project uses a configurable endpoint in `/content/site.json`:

```json
"inquiryEndpoint": "https://formsubmit.co/YOUR_EMAIL@example.com"
```

Replace with your final email endpoint before launch.

Example using FormSubmit:

```json
"inquiryEndpoint": "https://formsubmit.co/yourname@example.com"
```

## Content operations

- Preferred method: use `/builder-ops-97029/`.
- Fallback method: edit `/content/videos.json` and `/content/documents.json` directly.

## SEO

- Page title and description are already set.
- `robots.txt` and `sitemap.xml` included.
- Person schema included in `index.html`.

Update personal details inside `/content/site.json` and `index.html` JSON-LD if needed.
