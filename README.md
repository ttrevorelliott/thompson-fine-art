# Thompson & Martinez Fine Art Appraisals — Website

Full-stack marketing website with contact forms, appointment booking, client portal, and admin dashboard.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env — at minimum set JWT_SECRET and ADMIN_PASSWORD

# 3. Start the server
npm start
# → http://localhost:3000
```

## Pages

| URL | Description |
|-----|-------------|
| `/` | Main marketing site — hero, services, booking, contact |
| `/portal.html` | Client login & appraisal report dashboard |
| `/admin.html` | Admin login & full dashboard |

## Environment Variables (`.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port (default 3000) |
| `JWT_SECRET` | **Yes** | Secret for signing JWTs — make it long and random |
| `ADMIN_EMAIL` | No | Admin login email (default: admin@thompson-martinez.com) |
| `ADMIN_PASSWORD` | **Yes** | Admin login password — change before deploying |
| `SMTP_HOST` | For email | SMTP hostname (e.g. smtp.gmail.com) |
| `SMTP_PORT` | For email | SMTP port (e.g. 587) |
| `SMTP_USER` | For email | SMTP username / Gmail address |
| `SMTP_PASS` | For email | SMTP password or App Password |
| `NOTIFY_EMAIL` | For email | Where new inquiries/appointments are sent |

> Email is optional — the site works without it; forms just won't send confirmation emails.

## Gmail Setup (recommended for email)

1. Enable 2-factor authentication on your Google account
2. Go to Google Account → Security → App Passwords
3. Create an App Password for "Mail"
4. Use that 16-character password as `SMTP_PASS`

## Workflow

### Receiving appointments
1. Client submits booking form → stored in SQLite + email notification sent
2. Admin logs into `/admin.html` → clicks Confirm or Cancel
3. Confirmation email sent to client (if email configured)

### Setting up a client portal account
1. Admin → Clients tab → "+ New Client" → enter name, email, password
2. Share those credentials with the client
3. Client logs into `/portal.html` to view their reports

### Adding an appraisal report
1. Admin → Reports tab → "+ Add Report"
2. Select client, enter report details and optional file URL (Google Drive link, etc.)
3. Client sees it immediately in their portal

## Deployment (example: Railway / Render / Fly.io)

1. Push this folder to a GitHub repo
2. Create a new project on your hosting platform
3. Set all environment variables in the platform dashboard
4. The platform will run `npm start` automatically

The SQLite database (`data.db`) is created on first run. For production, consider mounting a persistent volume so the database survives deploys.

## Tech Stack

- **Backend**: Node.js + Express
- **Database**: SQLite (via better-sqlite3)
- **Auth**: JWT (jsonwebtoken) + bcrypt
- **Email**: Nodemailer (SMTP)
- **Frontend**: Vanilla HTML/CSS/JS — no build step required
- **Fonts**: Google Fonts (Cormorant Garamond + Inter)
