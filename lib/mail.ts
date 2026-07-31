import nodemailer from "nodemailer";

const DEFAULT_SMTP_USER = "lingomindid@gmail.com";

export async function sendMail(to: string, subject: string, text: string): Promise<void> {
  const username = process.env.SMTP_USERNAME || DEFAULT_SMTP_USER;
  const password = process.env.SMTP_PASSWORD;

  if (!password) {
    console.log(`====== EMAIL (dev, SMTP tidak dikonfigurasi) ======`);
    console.log(`To: ${to} | Subject: ${subject}`);
    console.log(text);
    return;
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: { user: username, pass: password },
  });

  await transporter.sendMail({
    from: `LingoMind <${username}>`,
    to,
    subject,
    text,
  });
}
