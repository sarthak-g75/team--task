# Team Task Tracker

A full-stack team task management app with JWT authentication, role-based access
control, a server-enforced task status state machine, Redis caching, real-time SSE
notifications, and a React frontend — all containerised for one-command startup.

**Stack:** Node.js · TypeScript · Express · Prisma · PostgreSQL · Redis · React · Vite · Docker

---

## Table of contents

- [Quick start](#quick-start)
- [Architecture](#architecture)
- [Authentication & roles](#authentication--roles)
- [API reference](#api-reference)
- [Frontend](#frontend)
- [Error format](#error-format)
- [Caching strategy & invalidation](#caching-strategy--invalidation)
- [Database design](#database-design)
- [Design decisions & tradeoffs](#design-decisions--tradeoffs)
- [What I'd improve with more time](#what-id-improve-with-more-time)

---

## Quick start

The reviewer needs **only Docker**. No `.env`, no manual migrations, no seeding step.

```bash
docker compose up --build
```

This single command from the repo root starts:

| Service | URL |
|---|---|
| **React frontend** | http://localhost:5173 |
| **REST API** | http://localhost:8080/api |
| **Swagger UI** | http://localhost:8080/api/docs |
| PostgreSQL | localhost:5432 |
| Redis | localhost:6379 |

On boot the backend automatically runs `prisma migrate deploy`, seeds an admin user,
then starts the server.

### Seeded admin

| Email | Password |
|---|---|
| `admin@example.com` | `Admin@12345` |

Sign in at http://localhost:5173 or via the API:

```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"Admin@12345"}'
```

### Port conflicts

If any default port is already in use, override it — internal Docker networking is
unaffected:

```bash
POSTGRES_PORT=55432 REDIS_PORT=56379 PORT=8099 docker compose up --build
```

### Backend only

```bash
cd backend && docker compose up --build
```

### Local development (without Docker)

```bash
# terminal 1 — backend
cd backend
cp .env.example .env        # adjust DATABASE_URL / REDIS_URL
npm install
npm run db:migrate
npm run db:seed
npm run dev                 # tsx watch, http://localhost:8080

# terminal 2 — frontend
cd frontend
npm install
npm run dev                 # http://localhost:5173
```

### Tests

```bash
docker run -d --name test-pg \
  -e POSTGRES_USER=taskuser -e POSTGRES_PASSWORD=taskpassword \
  -e POSTGRES_DB=tasktracker -p 5432:5432 postgres:16-alpine
docker run -d --name test-redis -p 6379:6379 redis:7-alpine

cd backend
DATABASE_URL=postgresql://taskuser:taskpassword@localhost:5432/tasktracker \
  npm run db:migrate:deploy
DATABASE_URL=postgresql://taskuser:taskpassword@localhost:5432/tasktracker \
  REDIS_URL=redis://localhost:6379 \
  JWT_ACCESS_SECRET=test_access_secret_at_least_32_characters_long \
  JWT_REFRESH_SECRET=test_refresh_secret_at_least_32_characters_long \
  npm test
```

---

## Architecture

```
.
├── docker-compose.yml          # full-stack: postgres + redis + backend + frontend
├── backend/
│   ├── docker-compose.yml      # backend-only compose (for API-only reviewers)
│   ├── Dockerfile              # multi-stage Node build
│   ├── openapi.yaml            # OpenAPI 3.0 spec (also served live at /api/docs)
│   └── src/
│       ├── app.ts              # express: helmet, cors, rate-limit, routes, error handler
│       ├── server.ts           # http server + graceful shutdown
│       ├── config/             # env (zod-validated), logger (pino), database, redis
│       ├── core/               # BaseApiRoutes, BaseController (generic CRUD), ApiError, asyncHandler
│       ├── middleware/         # authenticate, requireRole, validate, error, requestId
│       ├── modules/            # auth · user · project · task · notification · analytics
│       └── utils/              # jwt, password (bcrypt), cache (versioned Redis)
└── frontend/
    ├── Dockerfile              # multi-stage: Vite build → nginx
    ├── docker-compose.yml      # frontend-only compose
    └── src/
        ├── pages/              # Login · Register · Board · Users (admin)
        ├── components/         # Header, board columns, task modal, dialogs
        ├── stores/             # auth (Zustand + persist), toast
        └── lib/                # api (axios + auto-refresh), queries (TanStack Query), types
```

**Key design — thin generic base.** `BaseController` implements CRUD once with
pagination, search, filters, row-level access scoping, and `before*/after*`
lifecycle hooks. Each module overrides only what it needs (`getAccessScope`,
`beforeSave`, `afterUpdate`, …) rather than re-implementing controllers from scratch.

---

## Authentication & roles

- **Login** issues a short-lived **access token** (JWT, 15 min) in the response body
  and a long-lived **refresh token** (7 days) in an `httpOnly`, `sameSite=lax` cookie
  scoped to `/api/auth/refresh`.
- **Refresh token rotation**: each `/auth/refresh` revokes the presented token and
  issues a new pair. Presenting a revoked token triggers **reuse detection** — all of
  that user's active tokens are invalidated.
- **User deletion revokes sessions immediately**: deleting a user revokes all their
  active refresh tokens so they cannot re-authenticate with an unexpired cookie.
- Access tokens carry `{ sub, role }` and are verified by `authenticate` middleware.
- The frontend keeps access tokens **in memory only** (never localStorage). The
  persisted user profile allows the UI to render immediately on reload; the httpOnly
  cookie silently re-issues the access token on the first API call.

### Roles & permissions

| Capability | ADMIN | MANAGER | MEMBER |
|---|:---:|:---:|:---:|
| Manage users (create / update / delete) | ✅ | — | — |
| Promote user to ADMIN | ✅ | — | — |
| View team roster | ✅ | ✅ | — |
| Manage projects | ✅ | ✅ | — |
| View projects | ✅ | ✅ | ✅ |
| Create / delete tasks, assign members | ✅ | ✅ | — |
| View / update any task | ✅ | ✅ | — |
| View / update own assigned tasks | ✅ | ✅ | ✅ |
| Change task status | ✅ | ✅ | assignee only |
| View analytics | ✅ | ✅ | — |

**Where RBAC lives:** role checks are enforced in `requireRole(...)` **middleware**
(not controllers). Ownership rules ("a MEMBER may only touch tasks assigned to them")
are data-level and enforced via `BaseController.getAccessScope()`.

### Safety guards on user deletion (ADMIN)

- Cannot delete **your own account**
- Cannot delete the **last admin** (system would be unmanageable)
- Cannot delete a user who **owns projects** — reassign or delete them first
- Attempting any of these returns a descriptive `400` or `409`, never a 500

---

## API reference

Base URL: `/api`. All non-auth routes require `Authorization: Bearer <accessToken>`.

> **Interactive docs (Swagger UI):** http://localhost:8080/api/docs
> Raw spec: `/api/openapi.json` · Committed as `backend/openapi.yaml`

> **List convention:** list endpoints are `POST /<resource>/all` with filters and
> pagination in the JSON body. See [tradeoffs](#design-decisions--tradeoffs).

### Auth
| Method | Path | Access | Body |
|---|---|---|---|
| POST | `/auth/register` | public | `{ name, email, password }` |
| POST | `/auth/login` | public | `{ email, password }` |
| POST | `/auth/refresh` | refresh cookie | — |
| POST | `/auth/logout` | authenticated | — |

The **first** registered user is bootstrapped as `ADMIN`; all others register as
`MEMBER`. Public signup cannot self-assign a privileged role.

### Users
| Method | Path | Access |
|---|---|---|
| POST | `/users/all` | ADMIN, MANAGER |
| GET | `/users/:id` | ADMIN, MANAGER |
| POST | `/users` | ADMIN — role limited to MANAGER \| MEMBER |
| PUT | `/users/:id` | ADMIN — can set any role including ADMIN |
| DELETE | `/users/:id` | ADMIN — guarded (see above) |

### Projects
| Method | Path | Access |
|---|---|---|
| POST | `/projects/all` | any authenticated |
| GET | `/projects/:id` | any authenticated |
| POST | `/projects` | ADMIN, MANAGER |
| PUT | `/projects/:id` | ADMIN, MANAGER |
| DELETE | `/projects/:id` | ADMIN, MANAGER |

### Tasks
| Method | Path | Access | Notes |
|---|---|---|---|
| POST | `/tasks/all` | any authenticated | MEMBERs see only their own tasks |
| GET | `/tasks/:id` | any authenticated | MEMBER scoped to own |
| POST | `/tasks` | ADMIN, MANAGER | `dueDate` must be future |
| PUT | `/tasks/:id` | any authenticated | MEMBER: own task only, cannot reassign |
| DELETE | `/tasks/:id` | ADMIN, MANAGER | |
| PATCH | `/tasks/:id/status` | assignee or MANAGER/ADMIN | enforces state machine |

**Status state machine** (server-enforced, illegal transitions return `409`):

```
TODO ──▶ IN_PROGRESS ──▶ IN_REVIEW ──▶ DONE   (terminal)
  └──────────┴───────────────┴──────▶ BLOCKED
BLOCKED ──▶ TODO | IN_PROGRESS | IN_REVIEW
```

### Analytics
| Method | Path | Access |
|---|---|---|
| GET | `/analytics/overview` | ADMIN, MANAGER |

Returns overdue task count per user and average task completion time, computed with
SQL aggregation over a `completedAt` timestamp set when a task enters `DONE`.

### Real-time notifications (SSE)
| Method | Path | Access |
|---|---|---|
| GET | `/notifications/stream` | authenticated (`?access_token=` or header) |

Pushes `task.status` events via Server-Sent Events. MEMBERs receive events for tasks
assigned to them; ADMIN/MANAGER receive all events. Backed by Redis pub/sub so
events publish across multiple backend instances.

```bash
curl -N "http://localhost:8080/api/notifications/stream?access_token=$TOKEN"
# event: task.status
# data: {"taskId":"...","title":"...","from":"TODO","to":"IN_PROGRESS"}
```

---

## Frontend

A React task board at http://localhost:5173 (served by nginx in Docker).

| Page | Route | Access |
|---|---|---|
| Sign in | `/login` | public |
| Register | `/register` | public — creates MEMBER account |
| Task board | `/` | authenticated |
| User management | `/users` | ADMIN only |

**User management** (`/users`) lets admins create users (MANAGER or MEMBER role),
edit any user (name, email, role — including promoting to ADMIN), and delete users
(with the same guards as the API: no self-delete, no last-admin delete, no delete
if user owns projects).

The board shows tasks in Kanban columns with drag-and-drop status transitions, live
SSE toast notifications when any task moves, and role-aware controls — only
ADMIN/MANAGER see project and task creation buttons.

---

## Error format

```json
{ "status": 400, "code": "VALIDATION_ERROR", "message": "dueDate must be a future date" }
```

Validation errors include a `details` object with per-field messages. Common codes:
`VALIDATION_ERROR` · `UNAUTHORIZED` · `FORBIDDEN` · `NOT_FOUND` · `CONFLICT` ·
`INVALID_TRANSITION` · `RATE_LIMITED` · `INTERNAL_ERROR`.

---

## Caching strategy & invalidation

**What is cached:** the task **list per assignee**. A list is cached only when it is
scoped to a single assignee — a MEMBER (whose list is always their own tasks) or an
ADMIN/MANAGER filtering by `assigneeId`. Unscoped "all tasks" listings are not
cached. Cached entries have a 10-minute TTL as a safety net.

**Cache key:**

```
tasks:assignee:{userId}:v{version}:{filterHash}
```

`filterHash` is a SHA-1 of the result-affecting query params (page, limit, status,
priority, projectId, search, order).

**Invalidation — version bumping.** Each assignee has a monotonically increasing
version counter (`tasks:assignee:version:{userId}`). Any write to that user's tasks
**increments the version**, which changes the key prefix for every subsequent read —
instantly orphaning all previously cached filter combinations for that user without
scanning or deleting individual keys.

The version is bumped on:

- **create** → the new assignee's version
- **update** → the assignee's version (and *both* old and new on reassignment)
- **status change** → the assignee's version
- **delete** → the assignee's version

**Why this approach:** a single `INCR` is atomic and O(1) regardless of how many
filter permutations were cached. Old entries are never explicitly deleted — they
simply become unreachable and fall out via TTL. This avoids `KEYS`/`SCAN` patterns
and the race conditions of key-by-key deletion.

---

## Database design

Entities: **User**, **RefreshToken**, **Project**, **Task** (enums: `Role`,
`Priority`, `TaskStatus`). Full schema: [`backend/prisma/schema.prisma`](backend/prisma/schema.prisma).

```
User 1───* Task         (assignee — nullable, ON DELETE SET NULL)
User 1───* Task         (creator  — ON DELETE RESTRICT)
User 1───* Project      (creator)
Project 1───* Task      (ON DELETE CASCADE)
User 1───* RefreshToken (ON DELETE CASCADE)
```

**Indexes** on frequently-queried task columns: `status`, `assigneeId`, `dueDate`,
`projectId`.

### A design decision, explained — the `assigneeId` index and access pattern

The single most common read in this system is *"list the tasks for one assignee"* —
it's the MEMBER's entire view, the `assigneeId` filter for managers, **and** the
exact query behind the Redis cache. Three things are deliberately aligned around it:

1. An **index on `Task.assigneeId`** so a scoped query is an index lookup rather
   than a full scan as the table grows.
2. The **access-scoping layer** (`getAccessScope`) which forces `assigneeId = me`
   for MEMBERs at the query level — they can never fetch another user's task even
   with a crafted request.
3. The **cache namespace**, keyed by `assigneeId`, so a MEMBER's view and a
   manager's `assigneeId`-filtered view share the same cache entries and the same
   invalidation path.

A related choice: `Task.assigneeId` is **nullable with `ON DELETE SET NULL`**.
Deleting a user *unassigns* their tasks rather than cascade-deleting real work — the
task history is preserved and can be reassigned. The task *creator* uses
`ON DELETE RESTRICT` for the opposite reason: deleting a user who still owns created
records requires an explicit decision (reassign or delete the records first).

---

## Design decisions & tradeoffs

- **Single-tenant.** No `Organization` entity — the deployment is treated as one
  organisation. This removes an `orgId` from every model, query, and access check,
  keeping the RBAC and caching layers focused. Multi-tenancy is the first extension
  I'd add (see below).
- **Registration + admin provisioning.** `POST /auth/register` creates MEMBER
  accounts (the first user on an empty database bootstraps as ADMIN). Admins can
  create MANAGER/MEMBER accounts via `POST /users` and promote to ADMIN via
  `PUT /users/:id`. Public signup never self-assigns a privileged role.
- **`POST /<resource>/all` for lists.** Filters and pagination travel in the JSON
  body, validated by the same Zod layer as everything else, avoiding ad-hoc
  query-string parsing. The tradeoff is it's less idiomatic REST than `GET ?...`.
- **RBAC in middleware, ownership in the controller.** Role gating is pure middleware
  (`requireRole`); assignee-level ownership is data-level authorization
  (`getAccessScope`). Keeping them separate means the middleware is role-only, as
  required.
- **Bonus features implemented:** analytics endpoint · real-time SSE notifications ·
  integration tests (RBAC matrix + status state machine) · React frontend with admin
  user management.

---

## What I'd improve with more time

- **Multi-tenancy**: add `Organization`, scope all entities and access checks by
  `orgId`, set tenancy at user creation.
- **Invite-only registration**: replace open signup with admin-issued invite tokens
  so users cannot self-register without an explicit invitation.
- **More test coverage**: extend integration tests to cover auth/refresh rotation,
  the cache invalidation layer, and the user management guards.
- **Hardening**: per-user rate limiting, refresh-token device/family tracking,
  structured audit logging of all mutations.
- **Field-level task permissions**: finer control over which fields a MEMBER may
  edit on their own tasks.
- **Frontend Dockerfile build-arg for API URL**: currently `VITE_API_URL` defaults
  to `localhost:8080` at build time. For a real deployment this would be the public
  API domain, passed in as a CI build argument.
