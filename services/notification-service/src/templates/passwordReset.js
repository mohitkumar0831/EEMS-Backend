/**
 * Generates the HTML email for password reset requests.
 */
export const passwordResetTemplate = ({ name, resetToken }) => ({
  subject: 'EMS — Password Reset Request',
  html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Reset Your Password</title>
  <style>
    body { margin:0; padding:0; background:#f4f6f9; font-family:'Segoe UI',Arial,sans-serif; }
    .wrapper { max-width:600px; margin:40px auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 4px 20px rgba(0,0,0,0.08); }
    .header { background:linear-gradient(135deg,#0ea5e9,#6366f1); padding:36px 32px; text-align:center; }
    .header h1 { color:#fff; margin:0; font-size:26px; font-weight:700; }
    .body { padding:36px 32px; }
    .text { font-size:15px; color:#475569; line-height:1.7; margin-bottom:20px; }
    .token-box { background:#1e293b; color:#a5f3fc; font-family:monospace; font-size:14px; padding:14px 20px; border-radius:8px; word-break:break-all; margin:16px 0; }
    .footer { background:#f8fafc; padding:20px 32px; text-align:center; font-size:12px; color:#94a3b8; border-top:1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header"><h1>🔐 Password Reset</h1></div>
    <div class="body">
      <p class="text">Hello <strong>${name}</strong>,</p>
      <p class="text">We received a request to reset your EMS password. Use the token below in the reset form:</p>
      <div class="token-box">${resetToken}</div>
      <p class="text">This token expires in <strong>1 hour</strong>. If you did not request a password reset, please ignore this email.</p>
    </div>
    <div class="footer">© ${new Date().getFullYear()} EMS — Automated email, do not reply.</div>
  </div>
</body>
</html>`,
});
