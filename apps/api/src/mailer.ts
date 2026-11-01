import nodemailer from "nodemailer";

export async function sendPanEmail(to: string, subject: string, html: string) {
  const host = process.env.SMTP_HOST;
  if (!host) {
    if (process.env.NODE_ENV === "production") throw new Error("SMTP is required for transactional email in production.");
    console.info("[PAN development email]", { to, subject, html });
    return;
  }
  const transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD || "" } : undefined
  });
  await transporter.sendMail({
    from: process.env.MAIL_FROM || "PAN Network <no-reply@pan.example>",
    to,
    subject,
    html
  });
}
