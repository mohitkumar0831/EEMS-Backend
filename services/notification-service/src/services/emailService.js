import nodemailer from 'nodemailer';

let transporter;

const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PORT || 587),
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }
  return transporter;
};

export const sendEmail = async ({ to, subject, html }) => {
  const transport = getTransporter();
  await transport.sendMail({
    from: process.env.EMAIL_FROM || 'EMS <no-reply@ems.com>',
    to,
    subject,
    html,
  });
  // eslint-disable-next-line no-console
  console.log(`[Email] Sent "${subject}" to ${to}`);
};
