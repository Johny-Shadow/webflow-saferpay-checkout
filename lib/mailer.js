import nodemailer from 'nodemailer';

export async function sendOrderMail(order) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  await transporter.sendMail({
    from: `"Shop" <${process.env.MAIL_FROM}>`,
    to: order.email || process.env.MAIL_FROM,
    subject: `Bestellbestätigung ${order.id}`,
    text: `
Vielen Dank für Ihre Bestellung!

Bestellnummer: ${order.id}
Betrag: ${order.amount} ${order.currency}
Status: ${order.status}

Dies ist eine Bestellbestätigung, keine Rechnung.
`
  });
}
