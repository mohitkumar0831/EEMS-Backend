/**
 * Generates the HTML email sent to a newly registered user (employee/manager/finance/auditor) of a tenant.
 */
export const userWelcomeTemplate = ({ name, email, role, tenantSlug, password }) => {
  const loginUrl = `http://localhost:5173/tenant/${tenantSlug}/login`;
  const companyName = tenantSlug.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  
  return {
    subject: `Welcome to ${companyName} — Your account is ready`,
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Welcome to ${companyName}</title>
  <style>
    body { margin: 0; padding: 0; background: #f4f6f9; font-family: 'Segoe UI', Arial, sans-serif; }
    .wrapper { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 40px 32px; text-align: center; }
    .header h1 { color: #fff; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px; }
    .header p { color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 15px; }
    .body { padding: 36px 32px; }
    .greeting { font-size: 18px; font-weight: 600; color: #1e293b; margin-bottom: 12px; }
    .text { font-size: 15px; color: #475569; line-height: 1.7; margin-bottom: 20px; }
    .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 24px; margin: 24px 0; }
    .card-row { display: flex; margin-bottom: 12px; }
    .card-label { font-size: 13px; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; min-width: 140px; }
    .card-value { font-size: 14px; color: #1e293b; font-weight: 500; word-break: break-all; }
    .password-box { background: #1e293b; color: #a5f3fc; font-family: monospace; font-size: 20px; letter-spacing: 3px; padding: 14px 20px; border-radius: 8px; text-align: center; margin: 12px 0; }
    .btn { display: block; width: fit-content; margin: 28px auto 0; padding: 14px 36px; background: linear-gradient(135deg, #4f46e5, #7c3aed); color: #fff; text-decoration: none; border-radius: 8px; font-size: 15px; font-weight: 600; text-align: center; }
    .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 6px; font-size: 13px; color: #92400e; margin-top: 24px; }
    .footer { background: #f8fafc; padding: 20px 32px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>🎉 Welcome to ${companyName}</h1>
      <p>Expense Management System</p>
    </div>
    <div class="body">
      <div class="greeting">Hello, ${name}!</div>
      <p class="text">
        Your account has been successfully created on the ${companyName} platform.
        You have been assigned the role of <strong>${role}</strong>.
      </p>
      
      <div class="card">
        <div class="card-row">
          <div class="card-label">Your Email</div>
          <div class="card-value">${email}</div>
        </div>
        <div class="card-row">
          <div class="card-label">Company Slug</div>
          <div class="card-value">${tenantSlug}</div>
        </div>
        <div class="card-row">
          <div class="card-label">Your Role</div>
          <div class="card-value">${role}</div>
        </div>
        
        <div style="margin-top: 24px; padding-top: 16px; border-top: 1px dashed #cbd5e1;">
          <div class="card-label" style="margin-bottom: 8px; text-align: center;">Temporary Password</div>
          <div class="password-box">${password}</div>
        </div>
      </div>

      <a href="${loginUrl}" class="btn">Login to Your Dashboard</a>
      
      <div class="warning">
        <strong>Security Notice:</strong> Please change your password immediately after logging in for the first time.
      </div>
    </div>
    <div class="footer">
      This is an automated message from the EMS platform.<br>
      Please do not reply directly to this email.
    </div>
  </div>
</body>
</html>`
  };
};
