/*
 * Email system (Nodemailer / SMTP).
 *
 * Credentials come ONLY from environment variables:
 *   EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASSWORD, OWNER_EMAIL
 *
 * If they are not configured, emails are skipped gracefully and a warning
 * is printed — messages are still saved to the database.
 */
const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  const { EMAIL_HOST, EMAIL_USER, EMAIL_PASSWORD } = process.env;
  if (!EMAIL_HOST || !EMAIL_USER || !EMAIL_PASSWORD) {
    console.warn('[email] EMAIL_* variables are not configured — email sending is disabled (messages are still saved).');
    return null;
  }
  const port = Number(process.env.EMAIL_PORT || 465);
  transporter = nodemailer.createTransport({
    host: EMAIL_HOST,
    port,
    secure: port === 465, // 465 = SSL, 587 = STARTTLS
    auth: { user: EMAIL_USER, pass: EMAIL_PASSWORD }
  });
  return transporter;
}

const esc = s => String(s).replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ------------------------------------------------------------
 * 1) Notification email to the portfolio owner
 *    (name, email, subject, message, date & time submitted)
 * ------------------------------------------------------------ */
async function sendOwnerNotification({ name, email, subject, message, created_at }) {
  const t = getTransporter();
  if (!t) return;
  const owner = process.env.OWNER_EMAIL || process.env.EMAIL_USER;
  const when = new Date(created_at || Date.now()).toLocaleString('en-PH', {
    timeZone: 'Asia/Manila', dateStyle: 'full', timeStyle: 'medium'
  });

  await t.sendMail({
    from: `"Portfolio Contact" <${process.env.EMAIL_USER}>`,
    to: owner,
    replyTo: email,
    subject: `📩 New portfolio message: ${subject}`,
    text:
      `You received a new message through your portfolio contact form.\n\n` +
      `Name:      ${name}\n` +
      `Email:     ${email}\n` +
      `Subject:   ${subject}\n` +
      `Submitted: ${when}\n\n` +
      `Message:\n${message}\n`,
    html: `
      <div style="background:#05070f;padding:32px;font-family:Segoe UI,Arial,sans-serif">
        <div style="max-width:560px;margin:0 auto;background:#0b1122;border:1px solid #1c2a45;border-radius:16px;padding:28px;color:#e9edf7">
          <h2 style="margin:0 0 4px;font-size:18px">New message from your portfolio ✦</h2>
          <p style="margin:0 0 20px;color:#98a2ba;font-size:13px">Submitted on ${esc(when)}</p>
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <tr><td style="padding:8px 0;color:#38bdf8;width:90px;vertical-align:top">Name</td><td>${esc(name)}</td></tr>
            <tr><td style="padding:8px 0;color:#38bdf8;vertical-align:top">Email</td><td><a href="mailto:${esc(email)}" style="color:#7dd3fc">${esc(email)}</a></td></tr>
            <tr><td style="padding:8px 0;color:#38bdf8;vertical-align:top">Subject</td><td>${esc(subject)}</td></tr>
          </table>
          <div style="margin-top:16px;background:#05070f;border:1px solid #1c2a45;border-radius:12px;padding:16px;font-size:14px;line-height:1.6;color:#c8cfe0;white-space:pre-wrap">${esc(message)}</div>
          <p style="margin:20px 0 0;color:#98a2ba;font-size:12px">Hit reply to respond directly to ${esc(name)}.</p>
        </div>
      </div>`
  });
}

/* ------------------------------------------------------------
 * 2) Auto-reply confirmation to the visitor
 * ------------------------------------------------------------ */
async function sendAutoReply({ name, email, subject }) {
  const t = getTransporter();
  if (!t) return;
  const firstName = esc(name.split(' ')[0]);

  await t.sendMail({
    from: `"John Emerson T. Gutierrez" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `Thanks for reaching out, ${firstName}!`,
    text:
      `Hi ${name},\n\n` +
      `Thank you for your message${subject ? ` about "${subject}"` : ''}. ` +
      `I have received it and will review it as soon as I can.\n\n` +
      `Best regards,\nJohn Emerson T. Gutierrez\n` +
      `BSIT 3rd Year — Pateros Technological College\n`,
    html: `
      <div style="background:#05070f;padding:32px;font-family:Segoe UI,Arial,sans-serif">
        <div style="max-width:560px;margin:0 auto;background:#0b1122;border:1px solid #1c2a45;border-radius:16px;padding:28px;color:#e9edf7">
          <h2 style="margin:0 0 14px;font-size:18px">Message received ✦</h2>
          <p style="font-size:14px;line-height:1.7;color:#c8cfe0">Hi ${firstName},</p>
          <p style="font-size:14px;line-height:1.7;color:#c8cfe0">
            Thank you for your message${subject ? ` about <b style="color:#7dd3fc">"${esc(subject)}"</b>` : ''}.
            I have received it and will review it as soon as I can.
          </p>
          <div style="margin-top:24px;padding-top:20px;border-top:1px solid #1c2a45">
            <p style="margin:0;font-size:14px;font-weight:700;color:#e9edf7">John Emerson T. Gutierrez</p>
            <p style="margin:4px 0 0;font-size:12px;color:#98a2ba">BSIT 3rd Year — Pateros Technological College</p>
          </div>
        </div>
      </div>`
  });
}

module.exports = { sendOwnerNotification, sendAutoReply };
