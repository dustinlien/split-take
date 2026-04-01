# Split Take

Lightweight split testing tool for a single landing page. No third-party analytics. Self-contained.

---

## What it is

Two pieces:

1. **Control panel** — React app (this repo) for creating tests, defining variants, and viewing results.
2. **Snippet** — a small vanilla JS embed (~2.5 kb) you paste once into your page's `<head>`. Generated from the control panel with your credentials pre-filled.

---

## Setup

### 1. Supabase project

Create a new project at [supabase.com](https://supabase.com). Then:

**Run the schema:**
Open `supabase/schema.sql` and run it in your project's SQL editor (`Dashboard → SQL Editor → New query`).

**Enable Google Auth:**
Go to `Authentication → Providers → Google` and enable it. You'll need a Google Cloud OAuth 2.0 client:
- Create a project at [console.cloud.google.com](https://console.cloud.google.com)
- Enable the Google+ API
- Create OAuth credentials (Web application)
- Add `https://your-project-id.supabase.co/auth/v1/callback` as an authorized redirect URI
- Copy the Client ID and Secret into Supabase

**Set the redirect URL:**
In Supabase → Authentication → URL Configuration, add `http://localhost:5173` (dev) and your production URL to the allowed redirect URLs.

### 2. Control panel

```bash
cp .env.example .env
# fill in your Supabase URL and anon key from: Dashboard → Settings → API

npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) and sign in with your `@curednutrition.com` Google account.

### 3. Deploy to Vercel (optional)

```bash
npm install -g vercel
vercel
```

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel's environment variables.

---

## Creating a test

1. Click **+ New Test** — enter a name and the exact URL you're testing (no trailing slash).
2. The **Control** variant is created automatically at 50% traffic.
3. Click **+ Add variant** to add Variant B (adjust weights so they sum to 100%).
4. Expand each variant with **▼ changes** to define element changes:
   - Enter a CSS selector (e.g. `#hero-headline`)
   - Choose change type: swap text, swap image URL, or show/hide
   - Enter the new value
5. When weights sum to 100% and you have ≥2 variants, the **Launch** button activates.

---

## Installing the snippet

1. Launch your test.
2. Go to the **Snippet** tab.
3. Copy the generated `<script>` block.
4. Paste it into the `<head>` of your page — **before** any other scripts, **once**.

The snippet never needs to change. It dynamically fetches whichever tests are running for that URL.

---

## Logging conversions

Call this anywhere in your page JS after a conversion event (button click, form submit, checkout, etc.):

```js
// Log for all active tests the visitor is enrolled in:
SplitTake.convert()

// Or target a specific test (find the ID on the Snippet tab):
SplitTake.convert('your-test-uuid')
```

---

## How the snippet works

- On first visit: fetches all running tests for the current URL from Supabase
- Assigns the visitor to a variant using weighted random selection
- Stores the assignment in a cookie (`_st_<testId>`) for 30 days
- Briefly hides the page body, applies DOM changes, reveals — preventing flash of original content
- Logs the visit to Supabase (once per test)
- On return visits: reads the cookie and serves the same variant (no re-logging)
- `SplitTake.convert()` logs a conversion for every test the visitor is enrolled in

---

## Results dashboard

The **Results** tab shows per-variant:
- Unique visitors
- Unique converters
- Conversion rate (CVR)
- % lift vs control
- Statistical confidence (one-tailed two-proportion z-test; ≥95% is flagged as significant)

---

## Ending a test

Click **End Test** → select a winner → confirm. The test stops logging and is archived.
The winner variant is noted on the results dashboard.

---

## Data model

| Table | Purpose |
|---|---|
| `tests` | Test metadata (name, URL, status, winner) |
| `variants` | Variants per test (label, traffic weight, is_control) |
| `variant_changes` | DOM changes per variant (selector, type, value) |
| `visits` | One row per first visit per visitor per test |
| `conversions` | One row per conversion event |

Visitor tokens are SHA-256 hashes of a random UUID stored in a 1-year cookie — no PII stored.
