require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { body, validationResult } = require('express-validator');

const db = require('./db');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_in_production';
const PORT = process.env.PORT || 3000;

// ── Email transport ───────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendMail(opts) {
  if (!process.env.SMTP_USER) return; // skip if not configured
  try { await transporter.sendMail(opts); } catch (e) { console.error('[Mail]', e.message); }
}

// ── Auth middleware ───────────────────────────────────────────────────────────
function requireClient(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    if (req.user.role !== 'client') return res.status(403).json({ error: 'Forbidden' });
    next();
  } catch { res.status(401).json({ error: 'Invalid token' }); }
}

function requireAdmin(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    next();
  } catch { res.status(401).json({ error: 'Invalid token' }); }
}

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
  next();
}

// ════════════════════════════════════════════════════════════════════════════
// PUBLIC ROUTES
// ════════════════════════════════════════════════════════════════════════════

// ── Contact form ─────────────────────────────────────────────────────────────
app.post('/api/contact',
  body('name').trim().notEmpty(),
  body('email').isEmail().normalizeEmail(),
  body('message').trim().isLength({ min: 10 }),
  validate,
  async (req, res) => {
    const { name, email, phone = '', subject = 'General Inquiry', message } = req.body;

    db.prepare(`INSERT INTO inquiries (name, email, phone, subject, message) VALUES (?,?,?,?,?)`)
      .run(name, email, phone, subject, message);

    // Notify business
    await sendMail({
      from: process.env.SMTP_USER,
      to: process.env.NOTIFY_EMAIL || process.env.SMTP_USER,
      subject: `New Inquiry: ${subject} — ${name}`,
      html: `<h2>New Website Inquiry</h2>
        <p><b>Name:</b> ${name}</p>
        <p><b>Email:</b> <a href="mailto:${email}">${email}</a></p>
        <p><b>Phone:</b> ${phone || 'not provided'}</p>
        <p><b>Subject:</b> ${subject}</p>
        <hr><p>${message.replace(/\n/g, '<br>')}</p>`,
    });

    // Auto-reply to sender
    await sendMail({
      from: `"${process.env.BUSINESS_NAME || 'Thompson & Martinez Fine Art Appraisals'}" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'We received your inquiry — Thompson & Martinez',
      html: `<p>Dear ${name},</p>
        <p>Thank you for reaching out to Thompson &amp; Martinez Fine Art Appraisals. We have received your inquiry and will respond within one business day.</p>
        <p>If your matter is urgent, please call us at <b>${process.env.BUSINESS_PHONE || '(800) 738-5334'}</b>.</p>
        <p>Warm regards,<br>Thompson &amp; Martinez Fine Art Appraisals<br>La Jolla, CA</p>`,
    });

    res.json({ ok: true, message: 'Inquiry received. We will be in touch shortly.' });
  }
);

// ── Appointment booking ───────────────────────────────────────────────────────
app.post('/api/appointments',
  body('name').trim().notEmpty(),
  body('email').isEmail().normalizeEmail(),
  body('service').trim().notEmpty(),
  body('preferred_date').isISO8601(),
  body('preferred_time').trim().notEmpty(),
  validate,
  async (req, res) => {
    const { name, email, phone = '', service, preferred_date, preferred_time, notes = '' } = req.body;

    const result = db.prepare(`
      INSERT INTO appointments (name, email, phone, service, preferred_date, preferred_time, notes)
      VALUES (?,?,?,?,?,?,?)
    `).run(name, email, phone, service, preferred_date, preferred_time, notes);

    const apptId = result.lastInsertRowid;

    // Notify business
    await sendMail({
      from: process.env.SMTP_USER,
      to: process.env.NOTIFY_EMAIL || process.env.SMTP_USER,
      subject: `New Appointment Request #${apptId} — ${name}`,
      html: `<h2>New Appointment Request</h2>
        <p><b>ID:</b> #${apptId}</p>
        <p><b>Name:</b> ${name}</p>
        <p><b>Email:</b> <a href="mailto:${email}">${email}</a></p>
        <p><b>Phone:</b> ${phone || 'not provided'}</p>
        <p><b>Service:</b> ${service}</p>
        <p><b>Preferred Date:</b> ${preferred_date}</p>
        <p><b>Preferred Time:</b> ${preferred_time}</p>
        ${notes ? `<p><b>Notes:</b> ${notes}</p>` : ''}
        <p><a href="${process.env.SITE_URL || 'http://localhost:3000'}/admin.html">View in Admin Dashboard →</a></p>`,
    });

    // Confirmation to client
    await sendMail({
      from: `"${process.env.BUSINESS_NAME || 'Thompson & Martinez Fine Art Appraisals'}" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Appointment Request Received — Thompson & Martinez',
      html: `<p>Dear ${name},</p>
        <p>Your appointment request has been received:</p>
        <ul>
          <li><b>Service:</b> ${service}</li>
          <li><b>Preferred Date:</b> ${preferred_date}</li>
          <li><b>Preferred Time:</b> ${preferred_time}</li>
        </ul>
        <p>We will confirm your appointment within one business day. If you need to reach us sooner, please call <b>${process.env.BUSINESS_PHONE || '(800) 738-5334'}</b>.</p>
        <p>Warm regards,<br>Thompson &amp; Martinez Fine Art Appraisals</p>`,
    });

    res.json({ ok: true, id: apptId, message: 'Appointment request received. We will confirm shortly.' });
  }
);

// ── Client auth ───────────────────────────────────────────────────────────────
app.post('/api/auth/login',
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
  validate,
  (req, res) => {
    const { email, password } = req.body;
    const client = db.prepare('SELECT * FROM clients WHERE email = ?').get(email);
    if (!client || !bcrypt.compareSync(password, client.password))
      return res.status(401).json({ error: 'Invalid email or password' });

    const token = jwt.sign({ id: client.id, email: client.email, name: client.name, role: 'client' }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ ok: true, token, name: client.name, email: client.email });
  }
);

// ── Admin auth ────────────────────────────────────────────────────────────────
app.post('/api/auth/admin-login',
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
  validate,
  (req, res) => {
    const { email, password } = req.body;
    const admin = db.prepare('SELECT * FROM admins WHERE email = ?').get(email);
    if (!admin || !bcrypt.compareSync(password, admin.password))
      return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: admin.id, email: admin.email, role: 'admin' }, JWT_SECRET, { expiresIn: '12h' });
    res.json({ ok: true, token });
  }
);

// ════════════════════════════════════════════════════════════════════════════
// CLIENT PORTAL ROUTES (protected)
// ════════════════════════════════════════════════════════════════════════════

app.get('/api/portal/reports', requireClient, (req, res) => {
  const reports = db.prepare('SELECT * FROM reports WHERE client_id = ? ORDER BY report_date DESC').all(req.user.id);
  res.json(reports);
});

app.get('/api/portal/me', requireClient, (req, res) => {
  const client = db.prepare('SELECT id, name, email, phone, created_at FROM clients WHERE id = ?').get(req.user.id);
  res.json(client);
});

// ════════════════════════════════════════════════════════════════════════════
// ADMIN ROUTES (protected)
// ════════════════════════════════════════════════════════════════════════════

// Dashboard stats
app.get('/api/admin/stats', requireAdmin, (req, res) => {
  res.json({
    appointments: {
      total:     db.prepare("SELECT COUNT(*) as c FROM appointments").get().c,
      pending:   db.prepare("SELECT COUNT(*) as c FROM appointments WHERE status='pending'").get().c,
      confirmed: db.prepare("SELECT COUNT(*) as c FROM appointments WHERE status='confirmed'").get().c,
    },
    inquiries: {
      total:  db.prepare("SELECT COUNT(*) as c FROM inquiries").get().c,
      unread: db.prepare("SELECT COUNT(*) as c FROM inquiries WHERE read=0").get().c,
    },
    clients: db.prepare("SELECT COUNT(*) as c FROM clients").get().c,
    reports: db.prepare("SELECT COUNT(*) as c FROM reports").get().c,
  });
});

// Appointments
app.get('/api/admin/appointments', requireAdmin, (req, res) => {
  res.json(db.prepare('SELECT * FROM appointments ORDER BY created_at DESC').all());
});

app.patch('/api/admin/appointments/:id', requireAdmin, (req, res) => {
  const { status } = req.body;
  if (!['pending','confirmed','cancelled'].includes(status))
    return res.status(400).json({ error: 'Invalid status' });
  db.prepare('UPDATE appointments SET status=? WHERE id=?').run(status, req.params.id);
  res.json({ ok: true });
});

// Inquiries
app.get('/api/admin/inquiries', requireAdmin, (req, res) => {
  res.json(db.prepare('SELECT * FROM inquiries ORDER BY created_at DESC').all());
});

app.patch('/api/admin/inquiries/:id/read', requireAdmin, (req, res) => {
  db.prepare('UPDATE inquiries SET read=1 WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// Clients management
app.get('/api/admin/clients', requireAdmin, (req, res) => {
  res.json(db.prepare('SELECT id, name, email, phone, created_at FROM clients ORDER BY created_at DESC').all());
});

app.post('/api/admin/clients',
  requireAdmin,
  body('name').trim().notEmpty(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  validate,
  (req, res) => {
    const { name, email, password, phone = '' } = req.body;
    try {
      const hash = bcrypt.hashSync(password, 10);
      const result = db.prepare('INSERT INTO clients (name, email, password, phone) VALUES (?,?,?,?)').run(name, email, hash, phone);
      res.json({ ok: true, id: result.lastInsertRowid });
    } catch (e) {
      if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Email already exists' });
      throw e;
    }
  }
);

// Reports management
app.get('/api/admin/reports', requireAdmin, (req, res) => {
  const rows = db.prepare(`
    SELECT r.*, c.name as client_name, c.email as client_email
    FROM reports r JOIN clients c ON r.client_id = c.id
    ORDER BY r.created_at DESC
  `).all();
  res.json(rows);
});

app.post('/api/admin/reports',
  requireAdmin,
  body('client_id').isInt(),
  body('title').trim().notEmpty(),
  validate,
  (req, res) => {
    const { client_id, title, artwork_desc = '', appraisal_value = '', report_date = '', file_url = '', notes = '' } = req.body;
    const result = db.prepare(`
      INSERT INTO reports (client_id, title, artwork_desc, appraisal_value, report_date, file_url, notes)
      VALUES (?,?,?,?,?,?,?)
    `).run(client_id, title, artwork_desc, appraisal_value, report_date, file_url, notes);
    res.json({ ok: true, id: result.lastInsertRowid });
  }
);

// ── SPA fallback ──────────────────────────────────────────────────────────────
app.get('/portal', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'portal.html')));
app.get('/admin',  (_req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🎨 Thompson & Martinez website running at http://localhost:${PORT}`);
  console.log(`   Admin dashboard → http://localhost:${PORT}/admin.html`);
  console.log(`   Client portal  → http://localhost:${PORT}/portal.html\n`);
});
