# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Full-stack marketing website for Thompson & Martinez Fine Art Appraisals: public marketing site, appointment booking, contact form, a client portal (view appraisal reports), and an admin dashboard (manage appointments, inquiries, clients, reports).

## Commands

```bash
npm install         # install dependencies
npm start            # run the server (node server.js) → http://localhost:3000
npm run dev           # run with nodemon for auto-reload
```

There is no build step, no test suite, and no linter configured in this repo. The frontend is served as static files with no bundler.

### Environment setup

Copy `.env.example` to `.env` (not present in this checkout — create one from the table in README.md) and set at minimum `JWT_SECRET` and `ADMIN_PASSWORD`. Email (SMTP_*) is optional; without it, forms still work but confirmation emails are silently skipped (see `sendMail` in `server.js`).

## Architecture

This is a minimal three-layer app with no framework abstraction on either side — read `server.js` top to bottom to understand a route; there's no router/controller/service split.

- **`server.js`** — single Express app containing all routes, auth middleware, validation, and email sending. Routes are grouped by comment banners: PUBLIC ROUTES → CLIENT PORTAL ROUTES (protected) → ADMIN ROUTES (protected).
- **`db.js`** — better-sqlite3 (synchronous, no async/await needed for queries) connection + full schema (`CREATE TABLE IF NOT EXISTS`) + admin-account seeding, all run on module load. The SQLite file `data.db` is created in the repo root on first run and is not checked in.
- **`public/`** — static, vanilla HTML/CSS/JS, no build step, one file per page:
  - `index.html` — marketing site (hero, services, booking form, contact form)
  - `portal.html` — client login + report viewer
  - `admin.html` — admin login + dashboard (appointments, inquiries, clients, reports tabs)

  Each page is self-contained (inline `<style>` and `<script>`), calls the JSON API directly via `fetch`, and stores its JWT in `localStorage` (see `TOKEN_KEY` in `admin.html`/`portal.html`).

### Auth model

Two independent JWT-based roles, both signed with the same `JWT_SECRET`:
- **Client**: `POST /api/auth/login` → token with `role: 'client'`, checked by `requireClient` middleware. Grants access to `/api/portal/*`.
- **Admin**: `POST /api/auth/admin-login` → token with `role: 'admin'`, checked by `requireAdmin` middleware. Grants access to `/api/admin/*`. The admin account is auto-seeded on server startup from `ADMIN_EMAIL`/`ADMIN_PASSWORD` env vars (see `seedAdmin()` in `db.js`) into its own `admins` table — separate from `clients`.

Passwords are hashed with bcryptjs before storage; tokens carry role + id and are sent as `Authorization: Bearer <token>`.

### Data model (`db.js`)

Four content tables plus `admins`:
- `clients` — portal login accounts (created by admin, not self-service)
- `appointments` — booking requests from the public site; `status` is `pending | confirmed | cancelled`, changed via admin PATCH
- `inquiries` — contact form submissions; `read` flag toggled by admin
- `reports` — appraisal reports, each tied to a `client_id`; visible only to that client in the portal

### Request flow example

Booking form (`index.html`) → `POST /api/contact` or `/api/appointments` (validated with `express-validator`) → row inserted → two emails sent via `sendMail()` (business notification + client auto-reply, both no-ops if `SMTP_USER` isn't set) → admin sees/manages it under the corresponding tab in `admin.html`, which calls `/api/admin/*` endpoints.

## Conventions

- All API responses are JSON; success responses generally include `{ ok: true, ... }`, errors `{ error: '...' }`.
- Validation uses `express-validator` (`body(...)` chains + the shared `validate` middleware) on every mutating public/admin endpoint.
- Money/report values (`appraisal_value`) are stored as free-text strings, not numeric types.
