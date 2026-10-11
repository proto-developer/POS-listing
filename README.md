# Lister — Excel manifest → Square POS

Drop a manifest spreadsheet, fix the rows that need a name / SKU / price, and every row is listed
on Square with stock. The stats of each upload go to MongoDB and show on the dashboard.

## Setup (5 minutes)

1. Install Node 20+ (nodejs.org).
2. In this folder:
   ```
   npm install
   cp .env.example .env.local
   ```
3. Fill in `.env.local` (every field is explained in the file):
   - **Square** — `SQUARE_ACCESS_TOKEN` from developer.squareup.com > your application > Credentials.
     Use a Production token with `SQUARE_ENV=production`, or a Sandbox token with `SQUARE_ENV=sandbox`
     to try it safely first. The token needs ITEMS_READ, ITEMS_WRITE, INVENTORY_WRITE and MERCHANT_PROFILE_READ.
   - **MongoDB** — `MONGODB_URI` from MongoDB Atlas (Database > Connect > Drivers) or a local server.
   - **Sign in** — `LISTER_USER`, `LISTER_PASSWORD` and a random `LISTER_SECRET`.
4. Run it:
   ```
   npm run dev          # development
   npm run build && npm start   # production
   ```
5. Open http://localhost:3000, sign in, and check the badge in the header: it shows
   **Square live · <your location>** when the token works. Any problem with Square or the
   database is shown there too, and in detail at `/api/health` (while signed in).

All three are required. Without a Square token nothing can be posted, without MongoDB nothing is
saved, and without a user and password nobody can sign in. Each case is shown plainly in the app.

## Pages
- **Upload** (`/`) — drop a manifest and see it as a table with the detected columns labelled.
  Posting shows a donut progress with a toast per row underneath (checking, added, already in
  Square, needs you, skipped). Rows missing a name, SKU or price open a drawer to fix or skip.
- **Dashboard** (`/dashboard`) — this month's items added with the breakdown, a daily-uploads chart
  (click a day, pick a file, view its report) and the list of uploaded files. Clicking a file in
  the list or in the sidebar's Recent files opens its details: date, mode, time taken, counts,
  stock value and the skipped rows. The drawer can also remove it from history.

## What gets posted per row
- Item name    = Item Description
- SKU          = the A1369-style code column
- Price        = "price" column (currency taken from your Square location)
- Variation    = Model Number
- Category     = Product Category (created in Square if it doesn't exist)
- Description  = Brand / Model / Type / RRP
- Stock        = 1 (each row = one unit). Turn off with SQUARE_SET_STOCK=false

SKUs already in Square are skipped, so re-uploading the same sheet is safe.
Totals/blank rows are ignored.

## What gets stored
One document per upload in the `uploads` collection: id, file name, date, who ran it, mode,
seconds taken, rows, added, already there, stock value and the skipped rows with reasons.
The spreadsheet itself is only read in the browser and never uploaded anywhere.

## Security
- **One account, hashed password.** `LISTER_PASSWORD_HASH` is an scrypt hash (`npm run hash-password`).
  Sessions are HMAC-signed cookies (HttpOnly, SameSite=Lax, Secure in production) tied to the
  username and `LISTER_SECRET`; changing either signs everyone out. Sessions last 7 days.
- **Everything is behind the login** except `/login` and the sign-in endpoint. API calls without a
  valid session get 401, pages redirect to `/login`.
- **Rate limits.** 10 sign-in attempts per IP per 15 minutes, 300 API requests per IP per minute,
  plus a short random delay on a failed sign-in. Limits are counted in memory per running instance.
- **Cross-site protection.** Writes must come from this site (Origin / Sec-Fetch-Site are checked)
  and bodies over 2 MB are rejected. No CORS headers are sent, so other sites can't read the API.
- **Headers.** A per-request nonce-based Content-Security-Policy (no inline or third-party scripts),
  `frame-ancestors 'none'`, nosniff, strict referrer policy, COOP/CORP, a locked-down
  Permissions-Policy, HSTS in production, `noindex`, and no `X-Powered-By`.
- **Input validation.** Every API body is re-typed and length-capped on the server; the Square mode
  and the user on a saved upload come from the server config, never from the client. The
  `uploads` collection also carries a JSON-schema validator so nothing else can write junk into it.
- **Secrets.** Only `.env.example` is committed; `.env*` files, `data/` and build caches are
  git-ignored. No secret is ever sent to the browser (nothing uses `NEXT_PUBLIC_`).
- **Dependencies.** `xlsx` comes from the maintained SheetJS build (the npm package is abandoned at a
  vulnerable version); run `npm audit` after `npm install` and keep `next` on the latest 15.x.

Deployment notes: put the app behind HTTPS; give the MongoDB user access to the `lister` database
only and restrict Atlas network access to your server's IP; rotate `SQUARE_ACCESS_TOKEN`,
`MONGODB_URI` and `LISTER_SECRET` if they are ever shared or pasted anywhere.

## Code layout
See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full map. In short:
`app/` routes · `components/` UI (shadcn in `ui/`) · `hooks/` React state · `lib/` pure, browser-safe
logic · `server/` server-only business logic (env, auth, database, Square) · `middleware.ts` the
request gate. Nothing outside `server/env.ts` reads `process.env`.

## API (all require the login cookie)
- `GET  /api/health`            database + Square connection status
- `GET  /api/push`              Square connection status · `POST` one item to list it on Square
- `GET  /api/history`           uploads, newest first · `POST` save one · `DELETE ?id=` remove one
- `POST /api/auth/login`        `{ username, password }` · `POST /api/auth/logout`
