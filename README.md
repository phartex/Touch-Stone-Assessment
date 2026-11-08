# Touchstone Learn

A small but realistic online learning platform: learners browse a course catalog, enroll, watch video lessons with automatic resume and completion tracking, and follow their progress on a dashboard. Admins manage course content and review learner activity.

**Stack:** React 19 + TypeScript (Vite, TanStack Query, React Router, Tailwind CSS) · Node.js + TypeScript (Express 5, Zod) · PostgreSQL · Vitest, Supertest and Testing Library

---

## Contents

1. [Features](#features)
2. [Quick start](#quick-start)
3. [Environment configuration](#environment-configuration)
4. [Testing](#testing)
5. [Architecture summary](#architecture-summary)
6. [API reference](#api-reference)
7. [Project structure](#project-structure)
8. [Trade-offs and next steps](#trade-offs-and-next-steps)

---

## Features

| Area | What's implemented |
| --- | --- |
| **Auth and access** | Sign-up and sign-in, httpOnly cookie sessions (JWT), protected routes, `learner` and `admin` roles enforced by the API (the UI guards only control what is shown). Self-registration can only create learners. |
| **Catalog** | Course cards with thumbnail, category, level, description, total duration, lesson count, status badge and progress bar. Search and category filters are kept in the URL. |
| **Course detail** | Hero card with progress and a smart call to action (Start, Continue or Review), plus lesson cards with completed, in-progress or not-started status. Lessons are locked until you enroll. |
| **Video lessons** | Focused player card using the native `<video>` element, so play, pause, seek and fullscreen are accessible from the keyboard. Resumes from the last position ("Resumed at 0:20 · Start over"), shows a Replay / Next overlay at the end, handles load errors, and has "Up next" and "All lessons" cards with status. |
| **Progress tracking** | Position is saved every 10 seconds while playing, and on pause, end, tab hide and navigation. The **server** decides completion (≥ 95% watched or the `ended` event). Completion is sticky, and course completion is rolled up from lessons. |
| **Learner dashboard** | Enrolled, in-progress and completed counts, lessons completed, minutes watched, "Continue watching" cards, and enrolled courses with progress. |
| **Admin** | Overview (learners, courses, enrollments, completion rate, active learners in the last 7 days, per-course performance, recent activity). Course create, edit, publish/unpublish and delete; lesson add, edit, delete and reorder (with automatic duration detection from the video URL); learner progress per course; and a learners table. |
| **UX** | Responsive (mobile nav, stacked layouts), skeleton loading states, empty and error states with retry, inline field validation that mirrors the server rules, confirmation dialogs, a skip link, visible focus styles, ARIA progress bars, and reduced-motion support. |

## Quick start

**Prerequisites:** Node.js 20+ and PostgreSQL 14+ (or Docker).

```bash
# 1. Install dependencies (npm workspaces: server + client)
npm install

# 2. Start PostgreSQL. EITHER use Docker (creates `touchstone` and `touchstone_test` databases):
npm run db:up
#    OR use an existing local Postgres:
#    createdb touchstone && createdb touchstone_test

# 3. Configure the API (defaults match the Docker setup)
cp server/.env.example server/.env
cp server/.env.test.example server/.env.test
#    If using a local Postgres, edit DATABASE_URL in both files, e.g. postgres://localhost:5432/touchstone

# 4. Create the schema and load demo data
npm run db:seed        # runs migrations, then seeds

# 5. Run the API (http://localhost:4000) and web app (http://localhost:5173)
npm run dev
```

Open **http://localhost:5173** and sign in with a demo account (the login page has one-click buttons for these):

| Role | Email | Password |
| --- | --- | --- |
| Learner | `learner@touchstone.dev` | `Learner1234` |
| Admin | `admin@touchstone.dev` | `Admin1234` |

The seed adds 6 courses (one is an unpublished draft), 18 lessons, 3 learners, and some enrollments and progress so the dashboards have data. Most lessons use short 10-second public sample clips so completion is quick to demo. A few longer videos show resume and seeking.

### Other scripts (run from the repo root)

| Command | Description |
| --- | --- |
| `npm run dev` | API (tsx watch) and web app (Vite) together |
| `npm test` | All server and client tests |
| `npm run typecheck` | Strict TypeScript check of both packages |
| `npm run build` | Compile the API to `server/dist` and build the client to `client/dist` |
| `npm run db:migrate` | Apply pending SQL migrations |
| `npm run db:seed` | Migrate, then **reset** the database to the demo data (refuses to run when `NODE_ENV=production`) |

## Environment configuration

The API validates its environment at startup with Zod and exits with a clear message if anything is missing or invalid (`server/src/config/env.ts`).

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `DATABASE_URL` | yes | none | PostgreSQL connection string |
| `JWT_SECRET` | yes | none | Secret for signing session tokens, **at least 32 characters**. Generate with `openssl rand -hex 32` |
| `JWT_EXPIRES_IN` | no | `7d` | Session lifetime |
| `PORT` | no | `4000` | API port |
| `NODE_ENV` | no | `development` | `development`, `production` or `test`. In `production` the cookie is `Secure` and seeding is blocked |
| `CLIENT_ORIGIN` | no | `http://localhost:5173` | Origin allowed by CORS (only needed if the client is served from a different origin) |

- `server/.env` is used by `npm run dev`, `db:migrate` and `db:seed`.
- `server/.env.test` is used by `npm test`. It **must point to a separate database**, because tests truncate all tables.
- The client needs no environment variables. In development, Vite proxies `/api` to `localhost:4000`, so the app and API share an origin and the session cookie works without cross-site configuration. In production, serve `client/dist` and the API behind the same domain (for example, an nginx or ingress rule routing `/api` to Node).

## Testing

```bash
npm test                    # everything
npm test -w server          # API: unit and integration tests against a real Postgres test database
npm test -w client          # UI: unit and component tests (jsdom)
```

**Latest results:**

```
server  Test Files  4 passed (4)   Tests  36 passed (36)
client  Test Files  4 passed (4)   Tests  22 passed (22)
```

What is covered:

- **Progress rules (unit):** the 95% completion threshold, the `ended` signal, sticky completion on replay, position clamping, percentage rounding, and next-lesson selection.
- **Auth (integration):** registration sets an httpOnly + SameSite cookie, the password hash is never returned, role escalation through the sign-up body is ignored, duplicate emails are rejected case-insensitively, wrong credentials and unknown emails get identical errors, tampered tokens are rejected, logout works, and sessions of deleted users are invalidated immediately.
- **Courses (integration):** 401 vs 403 role enforcement, CRUD, field-level validation errors (including rejecting `javascript:` URLs), malformed and unknown IDs, no publishing without lessons, drafts hidden from learners, search and filter, idempotent enrollment.
- **Lessons (integration):** insert at a position, reorder, delete with position compaction, rejected invalid reorders, and keeping at least one lesson in a published course.
- **Progress and dashboards (integration):** the enrollment gate, admin preview, resume position round-trip, completion rolling up to course completion, learner dashboard stats and continue-watching, and admin course and learner statistics.
- **Client:** `ProgressSyncer` (throttling, coalescing in-flight saves, never losing the `ended` signal, retry after failure, unload payload), form validation that mirrors the server, formatting helpers, and accessible rendering of `CourseCard`, `LessonCard` and `ProgressBar`.

## Architecture summary

```
┌──────────── client (React SPA) ────────────┐        ┌──────────────── server (Express) ────────────────┐
│ pages (features/*)                          │  /api  │ routes  → validate (Zod) → requireAuth/requireRole│
│   └─ TanStack Query hooks (lib/queries.ts)  │ ─────▶ │ services   business rules, transactions           │
│        └─ fetch wrapper (lib/api.ts)        │ cookie │ repositories  parameterised SQL (pg)              │
│ reusable UI (components/ui/*)               │        │ PostgreSQL   constraints, FKs, indexes            │
└─────────────────────────────────────────────┘        └───────────────────────────────────────────────────┘
```

### Backend

- **Layering:** each module (`auth`, `courses`, `lessons`, `progress`, `dashboard`, `admin`) splits into *routes* (HTTP only: validation, status codes), *services* (business rules, authorization decisions, transactions) and *repositories* (SQL only). Pure rules live in `progress.logic.ts` with no I/O, so they're trivially unit-testable.
- **Validation:** every body, query and param goes through a Zod schema (`middleware/validate.ts`). Handlers only read the parsed values from `res.locals`, and unknown fields such as `role` are stripped. Errors use one consistent shape: `{ error: { code, message, details? } }`, with field-level `details` for forms.
- **Database:** plain SQL with `pg` rather than an ORM. The domain is small and the reporting queries (aggregates, `LATERAL` joins) are clearer as SQL, and the schema is easy to review in one file (`server/src/db/migrations/001_init.sql`). Invariants are enforced *in the database* as well as in the API:
  - FKs with `ON DELETE CASCADE` (deleting a course removes its lessons, enrollments and progress)
  - `UNIQUE (course_id, position)`, **deferrable**, so reorders and inserts can shift positions inside one transaction
  - composite primary keys on `enrollments(user_id, course_id)` and `lesson_progress(user_id, lesson_id)`, which make enrollment and progress upserts idempotent
  - `CHECK` constraints on lengths, role and level enums, positive durations, non-negative positions, and `completed ⇔ completed_at IS NOT NULL`
  - a case-insensitive unique index on `lower(email)`
- **Concurrency:** lesson reorder, insert and delete lock the parent course row (`SELECT … FOR UPDATE`) so concurrent admin edits can't corrupt the ordering. The progress upsert merges completion with `completed = old OR new` and keeps the first `completed_at`, so a late or stale write can never un-complete a lesson.
- **Server-authoritative progress:** the client reports *position* and whether the media `ended`. The server clamps the position to the lesson duration and decides completion, so a client can't post `completed: true` directly.

### Security

- Passwords are hashed with bcrypt (cost 12). Login runs a dummy hash for unknown emails so response timing doesn't reveal which accounts exist, and returns one generic error message.
- The session is a signed JWT (HS256, algorithm pinned) in an **httpOnly, SameSite=Lax** cookie (`Secure` in production). JavaScript can't read it, which limits XSS token theft, and SameSite=Lax stops it being sent on cross-site POST/PUT/DELETE, which mitigates CSRF. The user is re-loaded from the DB on every request, so deleted users or role changes take effect immediately.
- `helmet` security headers, a 100 kB JSON body limit, rate limiting on the auth endpoints, CORS limited to the client origin, and parameterised SQL everywhere (the dynamic `UPDATE` builders only use column names from a fixed allow-list).
- Authorization lives in the API: drafts return 404 to learners, lessons and progress require enrollment (`403 NOT_ENROLLED`), and every `/api/admin/*` route requires the admin role. The UI route guards are for user experience only.

### Frontend

- **Server state** is handled by TanStack Query with centralised query keys (`lib/queries.ts`). Mutations invalidate exactly the views they affect. Reordering lessons is optimistic with rollback. A global handler flips the app to signed-out on any 401 so guards redirect to login.
- **Progress syncing** is isolated in a framework-free `ProgressSyncer` class (throttle, single in-flight request, coalescing, retry, unload payload), wrapped by the `useProgressTracking` hook. The hook patches the lesson page cache in place so the sidebar updates instantly without refetching, and uses `fetch(..., { keepalive: true })` when the tab is hidden or closed.
- **Components:** a small design system in `components/ui` (Button, Card, StatCard, Badge/StatusBadge, ProgressBar, Field, Dialog on native `<dialog>`, skeleton, empty and error states) gives consistent styling and accessibility in one place.

## API reference

All endpoints are under `/api`. Requests and responses are JSON, and authentication uses the session cookie.

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| POST | `/auth/register` | public | `{ name, email, password }`. Creates a learner and starts a session |
| POST | `/auth/login` | public | `{ email, password }` |
| POST | `/auth/logout` | public | Clears the session |
| GET | `/auth/me` | auth | Current user |
| GET | `/courses?search=&category=` | auth | Published catalog with the user's progress |
| GET | `/courses/categories` | auth | Distinct categories |
| GET | `/courses/:id` | auth | Course detail, lessons with progress, `nextLessonId` |
| POST | `/courses/:id/enroll` | auth | Idempotent enrollment |
| GET | `/lessons/:id` | enrolled / admin | Lesson with video URL, resume position, sibling lessons, prev/next |
| PUT | `/lessons/:id/progress` | enrolled | `{ positionSeconds, ended? }`. Returns lesson and course progress |
| GET | `/me/dashboard` | auth | Learner summary |
| GET | `/admin/dashboard` | admin | Totals, per-course stats, recent activity |
| GET | `/admin/learners` | admin | Learners with engagement stats |
| GET, POST | `/admin/courses` | admin | List with stats / create (always created as a draft) |
| GET, PATCH, DELETE | `/admin/courses/:id` | admin | Course and its lessons / update (incl. `isPublished`) / delete |
| GET | `/admin/courses/:id/learners` | admin | Per-learner progress in a course |
| POST | `/admin/courses/:id/lessons` | admin | Add a lesson (optional `position`, otherwise appended) |
| PUT | `/admin/courses/:id/lessons/order` | admin | `{ lessonIds: [...] }`, the full new order |
| PATCH, DELETE | `/admin/lessons/:id` | admin | Update / delete (positions are compacted) |

## Project structure

```
├── docker-compose.yml          Postgres for local dev and tests
├── server/
│   ├── src/
│   │   ├── app.ts              Express app (middleware, routers, error handling)
│   │   ├── config/env.ts       Validated environment
│   │   ├── db/                 pool + transactions, migration runner, SQL migrations, seed
│   │   ├── middleware/         auth (requireAuth/requireRole), Zod validation, error handler
│   │   ├── lib/                AppError helpers, JWT helpers, shared types
│   │   └── modules/            auth · courses · lessons · progress · dashboard · admin
│   └── tests/                  Vitest + Supertest (unit and integration)
└── client/
    └── src/
        ├── components/ui/      Reusable design-system components
        ├── components/layout/  App shell, route guards
        ├── features/           auth · catalog · course · lesson · dashboard · admin
        └── lib/                API client, auth context, query hooks, types, formatters
```

## Trade-offs and next steps

Choices made to keep this a focused MVP, and what I'd do next with more time:

- **Videos are external URLs** (the seed uses public sample clips). Production would use upload to object storage, transcoding to HLS, signed URLs so only enrolled users can stream, and captions/transcripts for accessibility.
- **Stateless JWT sessions.** Simple and fast, but a token can't be individually revoked before it expires. That's partly mitigated by re-loading the user on every request. A server-side session table (or a token version per user) would add "log out everywhere" and password-change revocation.
- **Completion is ≥ 95% or `ended`, not "every second watched".** Seeking to the end counts as complete. Tracking watched intervals would be stricter but adds complexity that most course platforms don't impose.
- **No pagination.** The catalog is capped at 200 rows and the admin tables are unpaginated. Cursor pagination is the next step as content grows.
- **Types are duplicated** between client and server (`client/src/lib/types.ts`). With more endpoints I'd move the Zod schemas into a shared workspace package (or generate an OpenAPI spec) so the client derives its types from them.
- **Admin role provisioning** is via the seed or a DB update. There's no UI to promote users, by design for this scope.
- **Additional tests:** browser end-to-end tests (Playwright) for the full sign-up → enroll → watch → dashboard journey, and automated accessibility checks (axe). I checked the main flows manually in a real browser (resume, completion on end, save on pause, dashboard updates, mobile layout), but they aren't automated yet.
