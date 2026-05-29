# Task Tracker — Frontend

A minimal task board for the Team Task Tracker API. Built with **React 19 + Vite +
TypeScript**, TanStack Query, Zustand, React Router, and Tailwind v4.

## Features

- **Login** (JWT) with the seeded admin, token persisted in `localStorage`, automatic
  refresh-token rotation on `401`.
- **Kanban board** — five columns (To Do / In Progress / In Review / Done / Blocked)
  with task cards showing priority, assignee, and due date (overdue highlighted).
- **Status transitions** — each card only offers the moves the server's state machine
  allows; invalid moves can't be selected.
- **Projects** — create a project (ADMIN/MANAGER) and filter the board by project.
- **Create task** dialog (ADMIN/MANAGER) with project + assignee pickers.
- **Real-time updates** — subscribes to the backend SSE stream and live-refreshes the
  board (with a toast) when a task changes status. Members see updates for their own
  tasks; admins/managers see all of them.
- Role-aware UI: the "New task" button only appears for ADMIN/MANAGER.

## Run

The backend must be running first (`cd ../backend && docker compose up`).

```bash
cd frontend
cp .env.example .env      # VITE_API_URL=http://localhost:8080/api (default)
npm install
npm run dev               # http://localhost:5173
```

Sign in with the seeded admin: `admin@example.com` / `Admin@12345`.

> The backend's `CORS_ORIGINS` includes `http://localhost:5173` by default. If you run
> the frontend on a different port, add it to `CORS_ORIGINS` in the backend env.

## Build

```bash
npm run build     # tsc -b && vite build  ->  dist/
npm run preview
```
