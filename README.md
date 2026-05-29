# Team Task Tracker API

A REST API for managing tasks within a team, with JWT authentication, role-based
access control, a server-enforced task status state machine, Redis caching, and a
zero-setup containerized deployment.

Built with **Node.js + TypeScript + Express + Prisma (PostgreSQL) + Redis**.

---

## Table of contents

- [Quick start](#quick-start)
- [Architecture](#architecture)
- [Authentication & roles](#authentication--roles)
- [API reference](#api-reference)
- [Error format](#error-format)
- [Caching strategy & invalidation](#caching-strategy--invalidation)
- [Database design](#database-design)
- [Design decisions & tradeoffs](#design-decisions--tradeoffs)
- [What I'd improve with more time](#what-id-improve-with-more-time)

---

## Quick start

The reviewer needs **only Docker**. No `.env`, no manual migrations, no seeding step.

```bash
cd backend
docker compose up --build
```

This will:

1. Start **PostgreSQL** and **Redis** (with healthchecks).
2. Build the backend image (multi-stage).
3. On boot, the backend automatically runs `prisma migrate deploy`, seeds an admin
   user, then starts the server.

The API is then available at **http://localhost:8080/api**.

A health check confirms it's up:

```bash
curl http://localhost:8080/api/health        # {"status":"ok"}
curl http://localhost:8080/api/health/ready   # checks Postgres + Redis
```

### Seeded admin

A single ADMIN account is seeded so you can authenticate immediately:

| Email | Password |
|-------|----------|
| `admin@example.com` | `Admin@12345` |

```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"Admin@12345"}'
```

### Port conflicts

If `5432`, `6379`, or `8080` are already in use on your machine, override the
published ports (internal networking is unaffected):

```bash
POSTGRES_PORT=55432 REDIS_PORT=56379 PORT=8099 docker compose up --build
```

### Local development (without Docker)

```bash
cd backend
cp .env.example .env        # adjust DATABASE_URL / REDIS_URL to your local services
npm install
npm run db:migrate          # prisma migrate dev
npm run db:seed
npm run dev                 # tsx watch
```

### Tests

Integration tests cover the two most critical flows — the **RBAC permission matrix**
and the **task status state machine** — exercising the real Express app via
`supertest`. They need a Postgres and Redis (a throwaway pair is easiest) and a
migrated schema:

```bash
# 1. start throwaway services
docker run -d --name test-pg  -e POSTGRES_USER=taskuser -e POSTGRES_PASSWORD=taskpassword \
  -e POSTGRES_DB=tasktracker -p 5432:5432 postgres:16-alpine
docker run -d --name test-redis -p 6379:6379 redis:7-alpine

# 2. apply migrations, then run the suite
cd backend
DATABASE_URL=postgresql://taskuser:taskpassword@localhost:5432/tasktracker npm run db:migrate:deploy
DATABASE_URL=postgresql://taskuser:taskpassword@localhost:5432/tasktracker \
REDIS_URL=redis://localhost:6379 \
JWT_ACCESS_SECRET=test_access_secret_at_least_32_characters_long \
JWT_REFRESH_SECRET=test_refresh_secret_at_least_32_characters_long \
npm test
```

The suite runs serially (`--runInBand`) and truncates tables between suites.

### Frontend (optional)

A React task board lives in [`frontend/`](frontend/README.md). With the backend
running: `cd frontend && npm install && npm run dev`, then open http://localhost:5173
and sign in with the seeded admin.

---

## Architecture

```
backend/src
├── app.ts                 # express app: helmet, cors, rate-limit, json, routes, error handler
├── server.ts              # http server bootstrap + graceful shutdown
├── config/                # env (zod-validated), logger (pino), database (prisma), redis (ioredis)
├── core/
│   ├── BaseApiRoutes.ts   # declarative router base (REST + custom routes)
│   ├── BaseController.ts   # generic CRUD: pagination, search, filters, access scoping, lifecycle hooks
│   ├── ApiError.ts        # typed errors -> consistent JSON shape
│   └── asyncHandler.ts    # promise error forwarding
├── middleware/            # authenticate, requireRole (RBAC), validate (zod), error, requestId
├── modules/
│   ├── auth/              # login / refresh (rotation) / logout
│   ├── user/              # user CRUD (ADMIN-managed)
│   ├── project/           # project CRUD
│   └── task/              # task CRUD, filtering, status state machine, caching
└── utils/                 # jwt, password (bcrypt), cache (versioned task cache)
```

**Key idea — a thin generic base.** `BaseController` implements CRUD once
(pagination, search, list filters, row-level access scoping, and `before*/after*`
lifecycle hooks). Each module is small and declarative: it overrides hooks
(`getAccessScope`, `beforeSave`, `afterUpdate`, …) rather than re-implementing
controllers. RBAC is layered on at the route level via middleware.

---

## Authentication & roles

- **Login** issues a short-lived **access token** (JWT, 15m) in the response body
  and a long-lived **refresh token** (7d) in an `httpOnly`, `sameSite=lax` cookie
  scoped to `/api/auth/refresh`.
- **Refresh token rotation**: each `/auth/refresh` revokes the presented token and
  issues a new one. Refresh tokens are persisted; presenting a **revoked/expired**
  token triggers **reuse detection** — all of that user's active refresh tokens are
  revoked (defends against stolen-token replay).
- Access tokens carry `{ sub, role }` and are verified by the `authenticate`
  middleware (`Authorization: Bearer <token>`).

### Roles & permissions

| Capability | ADMIN | MANAGER | MEMBER |
|---|:---:|:---:|:---:|
| Manage users (create/update/delete) | ✅ | — | — |
| View team roster (list users) | ✅ | ✅ | — |
| Manage projects (create/update/delete) | ✅ | ✅ | — |
| View projects | ✅ | ✅ | ✅ |
| Create / delete tasks, assign members | ✅ | ✅ | — |
| View / update **any** task | ✅ | ✅ | — |
| View / update tasks **assigned to them** | ✅ | ✅ | ✅ |
| Change task status | ✅ | ✅ | assignee only |

**Where RBAC lives:** *role* checks are enforced in the `requireRole(...)`
**middleware** (not in controllers), as required. *Ownership* rules (e.g. "a MEMBER
may only touch tasks assigned to them") are a separate, data-level concern enforced
via `BaseController.getAccessScope()` and the task `beforeSave` hook.

---

## API reference

Base URL: `/api`. All non-auth routes require `Authorization: Bearer <accessToken>`.

> 📮 A ready-to-run **[Postman collection](postman_collection.json)** is included. Import
> it, run **Auth → Login** (the access token is captured automatically), then
> **Projects → Create** and **Tasks → Create** (ids are captured into variables) — the
> rest of the requests chain without any manual editing.

> **List convention:** list endpoints are `POST /<resource>/all` with filters and
> pagination in the JSON body (not `GET` query strings). This keeps complex,
> typed filter payloads clean and consistently validated. See
> [tradeoffs](#design-decisions--tradeoffs).

### Auth
| Method | Path | Access | Body |
|---|---|---|---|
| POST | `/auth/login` | public | `{ email, password }` |
| POST | `/auth/refresh` | refresh cookie | — |
| POST | `/auth/logout` | authenticated | — |

### Users (ADMIN-managed)
| Method | Path | Access |
|---|---|---|
| POST | `/users/all` | ADMIN, MANAGER |
| GET | `/users/:id` | ADMIN, MANAGER |
| POST | `/users` | ADMIN |
| PUT | `/users/:id` | ADMIN |
| DELETE | `/users/:id` | ADMIN |

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
| POST | `/tasks` | ADMIN, MANAGER | `title` required; `dueDate` must be future |
| PUT | `/tasks/:id` | any authenticated | MEMBER: own task, cannot reassign/move |
| DELETE | `/tasks/:id` | ADMIN, MANAGER | |
| PATCH | `/tasks/:id/status` | assignee or MANAGER/ADMIN | enforced transitions |

### Real-time notifications (SSE)
| Method | Path | Access |
|---|---|---|
| GET | `/notifications/stream` | authenticated (token via header or `?access_token=`) |

A [Server-Sent Events](#real-time-notifications-sse-1) stream that pushes a
`task.status` event to a user whenever a task **assigned to them** changes status.

**Task list filters** (`POST /tasks/all` body): `status`, `priority`, `assigneeId`,
`projectId`, `search`, `page`, `limit`, `orderBy`, `order`.

**Status state machine** (server-enforced):

```
TODO ──▶ IN_PROGRESS ──▶ IN_REVIEW ──▶ DONE        (DONE is terminal)
  └──────────┴───────────────┴──────▶ BLOCKED      (from any active state)
BLOCKED ──▶ TODO | IN_PROGRESS | IN_REVIEW          (resume)
```

Illegal transitions return `409 INVALID_TRANSITION` with the allowed set. Status is
**only** mutable through this endpoint — it cannot be set via create/update.

#### Example: create a task
```bash
curl -X POST http://localhost:8080/api/tasks \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"title":"Build login","priority":"HIGH","projectId":"<id>","assigneeId":"<userId>","dueDate":"2027-01-01"}'
```

---

## Error format

Every error returns a consistent JSON shape:

```json
{ "status": 400, "code": "VALIDATION_ERROR", "message": "dueDate must be a future date" }
```

Validation errors include a `details` object with per-field messages. Common codes:
`VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`,
`INVALID_TRANSITION`, `RATE_LIMITED`, `INTERNAL_ERROR`.

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

where `filterHash` is a hash of the result-affecting query params (page, limit,
status, priority, projectId, search, order).

**Invalidation — version bumping.** Each assignee has a monotonically increasing
version counter (`tasks:assignee:version:{userId}`). Any change to that user's tasks
**increments the version**, which changes the key prefix for every subsequent read —
instantly orphaning *all* previously cached filter combinations for that user. Old
keys are never scanned or deleted; they simply fall out via TTL.

The version is bumped on:

- **create** → the new assignee
- **update** → the assignee (and, on **reassignment**, *both* the old and new assignee)
- **status change** → the assignee
- **delete** → the assignee

**Why this approach:** it's atomic (a single `INCR`), avoids the cost and race
conditions of tracking/deleting individual keys (`KEYS`/`SCAN` patterns), and makes
"invalidate everything for this user" an O(1) operation regardless of how many
filter permutations were cached. The tradeoff is some stale keys lingering until TTL,
which is harmless because they can never be read again.

---

## Real-time notifications (SSE)

Clients subscribe to `GET /api/notifications/stream` and receive a `task.status`
event the moment a relevant task transitions status. **Delivery is role-aware:** a
MEMBER is notified about tasks **assigned to them** (per the brief), while an
ADMIN/MANAGER receives **all** task status events so their board — which shows every
task — stays live.

```bash
curl -N "http://localhost:8080/api/notifications/stream?access_token=$TOKEN"

event: connected
data: {"userId":"..."}

event: task.status
data: {"taskId":"...","title":"...","from":"TODO","to":"IN_PROGRESS","projectId":"..."}
```

**Event-driven design.** Status changes are published to a **Redis pub/sub** channel,
not a process-local emitter. Each backend instance keeps an in-memory registry of the
SSE connections it holds and applies the role-aware delivery rule above when fanning
out a message.
Because delivery rides on Redis, a notification published by one instance reaches a
client connected to any other instance — so this scales horizontally without sticky
sessions. SSE (vs. WebSocket) keeps it a plain one-way HTTP stream: no upgrade
handshake, auto-reconnect built into the browser's `EventSource`, and trivial auth
(`EventSource` can't set headers, so a `?access_token=` query param is accepted).

## Database design

Entities: **User**, **RefreshToken**, **Project**, **Task** (`Role`, `Priority`,
`TaskStatus` enums). See [`backend/prisma/schema.prisma`](backend/prisma/schema.prisma).

```
User 1───* Task   (assignee, optional, ON DELETE SET NULL)
User 1───* Task   (creator,           ON DELETE RESTRICT)
User 1───* Project (creator)
Project 1───* Task  (ON DELETE CASCADE)
User 1───* RefreshToken (ON DELETE CASCADE)
```

**Indexes** on the frequently-queried task columns: `status`, `assigneeId`,
`dueDate` (plus `projectId`).

### A design decision, explained — the `assigneeId` index + access pattern

The single most common read in this system is *"list the tasks for one assignee"* —
it's the MEMBER's entire view, the `assigneeId` filter for managers, **and** the
exact query behind the Redis cache. I deliberately aligned three things around it:

1. an **index on `Task.assigneeId`**, so that scoped query is an index lookup rather
   than a full scan as the table grows;
2. the **access-scoping layer** (`getAccessScope`) which forces `assigneeId = me` for
   MEMBERs at the query level — they can never even fetch another user's task; and
3. the **cache namespace**, keyed by `assigneeId`, so a MEMBER's view and a manager's
   `assigneeId`-filtered view share the same cache entries and the same invalidation.

A related choice: `Task.assigneeId` is **nullable with `ON DELETE SET NULL`**.
Deleting a user **unassigns** their tasks rather than cascade-deleting real work — the
task history is preserved and can be reassigned. The task *creator* uses
`ON DELETE RESTRICT` for the opposite reason: you shouldn't be able to delete a user
while they still own created records without an explicit decision.

---

## Design decisions & tradeoffs

These are intentional scope choices for a 3-day build; each is easy to extend.

- **Single-tenant.** The brief describes an organization-scoped system; this
  implementation treats the deployment as a single organization (no `Organization`
  entity). This removes an `orgId` from every model, query, and access check, keeping
  the RBAC and caching layers focused. Multi-tenancy is the first thing I'd add back
  (see below).
- **Admin-provisioned users (no public registration).** Users are created by an ADMIN
  via `POST /users` rather than self-service signup, modeling controlled team
  membership. The seeded admin bootstraps the system.
- **`POST /<resource>/all` for lists.** Filters/pagination travel in the JSON body and
  are validated by the same zod layer as everything else, avoiding ad-hoc query-string
  parsing. The tradeoff is that it's less "RESTful" than `GET ?status=...`.
- **RBAC in middleware, ownership in the controller.** Role gating is pure middleware
  (`requireRole`); assignee-level ownership is data-level authorization
  (`getAccessScope`). Keeping them separate keeps the middleware role-only, as the
  brief requires.
- **Bonus features**: real-time SSE notifications, integration tests (RBAC + status
  state machine), and a React task board ([`frontend/`](frontend/README.md)) are
  implemented; an analytics endpoint is not (yet).

---

## What I'd improve with more time

- **Multi-tenancy**: reintroduce `Organization`, scope all entities and access checks
  by `orgId`, and set tenancy at user creation.
- **More test coverage**: the critical flows (RBAC matrix, status state machine) have
  integration tests; I'd extend coverage to auth/refresh rotation and the cache layer.
- **OpenAPI spec**: generate a Swagger/OpenAPI document (a Postman collection is
  already included; an OpenAPI spec would add schema-level validation and a live
  Swagger UI).
- **Analytics endpoint**: overdue tasks per user and average completion time (the
  schema already supports this with a `completedAt` addition).
- **Hardening**: per-user rate limiting, refresh-token family/device tracking, and
  structured audit logging of mutations.
- **Field-level task permissions**: finer control over which fields a MEMBER may edit.
```
