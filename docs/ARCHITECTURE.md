# Architecture

Lister is a small Next.js 15 (App Router) application: one signed-in user drops a manifest
spreadsheet, the browser reads it, each row is posted to Square through our API, and the
stats of the upload are stored in MongoDB for the dashboard.

## Folder layout

```
app/                     Routes only. Pages are thin: fetch on the server, render a component.
  (app)/                 Signed-in area: shared layout (sidebar + header), Upload (/) and Dashboard
  login/                 Sign-in page
  api/                   REST handlers, one folder per resource (see "API" below)
  error.tsx              Error boundary for any rendering failure
  not-found.tsx          404 page

components/
  ui/                    shadcn/ui primitives. Generated; keep edits minimal.
  layout/                Sidebar, navigation groups, user menu, page header
  auth/                  Login form
  upload/                The upload page: drop zone, sheet preview, donut, toast stack, fix drawer
  uploads/               Pieces that show one upload: result ring, summary, details, drawer
  dashboard/             The dashboard widgets

hooks/
  use-upload-run.ts      The upload page's state machine (useReducer) wired to the runner
  use-toast-feed.ts      State for the inline toast stack
  use-mobile.ts          Viewport breakpoint

lib/                     Browser-safe, pure modules. No process.env, no database.
  types.ts               Domain types: Item, Upload, SquareStatus, FeedToast…
  format.ts              money / num / when / duration / plural / modeLabel
  stats.ts               sumBy / dayKey / inMonth
  manifest.ts            Reads the spreadsheet into rows and Items
  upload-runner.ts       Business logic of posting a sheet (UI-free, callback driven)
  row-toasts.ts          Toast text for each row state
  api-client.ts          fetch wrapper: every failure is an ApiClientError with a readable message
  utils.ts               cn, safeNext

server/                  Server-only business logic. Never imported by client components.
  env.ts                 The only reader of process.env; typed config + setup messages (edge-safe)
  http.ts                handler() wrapper, ApiError, json(), readJson()
  validate.ts            Body coercion helpers (str, num, count, int, UUID)
  rate-limit.ts          In-memory limiter + client IP (edge-safe)
  auth/session.ts        Signed session cookie (edge-safe)
  auth/credentials.ts    scrypt password check (Node)
  db/client.ts           Mongo connection, collection schema, dbStatus
  db/uploads.ts          Upload repository: list / create / delete
  square/client.ts       Authenticated request helper, SquareError, cached location context
  square/status.ts       squareStatus()
  square/catalog.ts      pushItem(): duplicate check, category, item, stock

middleware.ts            CSRF checks, body cap, rate limits, login wall, CSP nonce
scripts/hash-password.mjs
```

Rule of thumb: `app/` imports from `components/` and `server/`; `components/` and `hooks/`
import from `lib/` only (plus `type` imports); `server/` imports from `lib/` and `server/`.
Modules that must not reach the browser start with `import "server-only"`. Modules used by
`middleware.ts` (env, session, rate-limit) stay edge-safe: Web Crypto only, no Node imports.

## Request flow

1. `middleware.ts` runs on every request: rejects cross-site writes and oversized bodies,
   applies rate limits, verifies the session cookie, and attaches a nonce-based CSP.
2. Pages under `app/(app)` fetch what they need on the server (`listUploadsSafe`,
   `squareStatus`, `dbStatus`) and pass plain props to client components.
3. Client components call the API only through `lib/api-client.ts`.

## API

All routes are `handler(async (req) => …)` from `server/http.ts`:

- throw `new ApiError(status, message)` for an expected failure;
- anything else is logged and answered with a generic 500;
- failures always look like `{ ok: false, error: string }`.

| Route              | Methods            | Purpose                                                |
| ------------------ | ------------------ | ------------------------------------------------------ |
| `/api/auth/login`  | POST               | `{ username, password }` → session cookie              |
| `/api/auth/logout` | POST               | clears the cookie                                      |
| `/api/health`      | GET                | database + Square status; 503 if either is down        |
| `/api/push`        | GET, POST          | Square status · post one Item → PushResult             |
| `/api/history`     | GET, POST, DELETE  | list uploads · save one · remove one (`?id=`)          |

To add a resource: create `app/api/<name>/route.ts`, export `handler`-wrapped methods,
coerce the body with `server/validate.ts`, and put the logic in `server/<area>/`.

## The upload flow

`lib/upload-runner.ts` holds the logic: for each row, post it; if Square (or our own
required-field check) rejects it, ask the user to fix or skip; keep a tally; return an
`Upload`. It knows nothing about React. `hooks/use-upload-run.ts` owns the state machine
(`idle → reading → ready → running → done`) and supplies the callbacks: row status updates,
toasts, the fix-drawer promise and the pause gate. `components/upload/uploader.tsx` only renders.

## Configuration

Everything comes from `.env.local` through `server/env.ts`. Nothing else reads `process.env`.
Missing values never crash the app: each feature reports a setup message that the header,
the login page and `/api/health` surface.

## Errors

- Browser: `api()` throws `ApiClientError`; components show `errorMessage(e)` inline.
  `app/error.tsx` catches render failures.
- Server: `handler()` turns `ApiError` into its status and everything else into a logged 500.
  Square failures become `PushResult` errors with Square's message; database read failures
  on pages degrade to an empty list plus a header badge.
