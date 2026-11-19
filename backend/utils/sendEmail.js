import nodemailer from "nodemailer";

let transporter;
const getTransporter = () => {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST) return null;
  const port = Number(process.env.SMTP_PORT || 587);
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return transporter;
};

const codeEmailHtml = (code) => `
<div style="font-family:Arial,Helvetica,sans-serif;background:#FFFBF5;padding:24px">
  <div style="max-width:420px;margin:auto;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #f1e7da">
    <div style="background:#F97316;padding:22px;text-align:center">
      <div style="font-size:26px;font-weight:800;color:#ffffff">Save<span style="color:#1F2937">Bite</span></div>
    </div>
    <div style="padding:28px;text-align:center;color:#1F2937">
      <p style="margin:0 0 6px;font-size:16px">Your verification code is</p>
      <div style="margin:18px 0;font-size:38px;font-weight:800;letter-spacing:12px;color:#F97316">${code}</div>
      <p style="margin:0;font-size:13px;color:#6B7280">It expires in 10 minutes. If you didn't try to sign up, you can ignore this email.</p>
    </div>
  </div>
</div>`;

export const sendVerificationEmail = async (to, code) => {
  const t = getTransporter();

  if (!t) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Email is not configured (SMTP_HOST is missing)");
    }
    // Development fallback so you can keep building without an email account.
    console.log(`\n[DEV] SaveBite verification code for ${to}: ${code}\n`);
    return;
  }

  await t.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    subject: `${code} is your SaveBite verification code`,
    text: `Your SaveBite verification code is ${code}. It expires in 10 minutes.`,
    html: codeEmailHtml(code),
  });
};
