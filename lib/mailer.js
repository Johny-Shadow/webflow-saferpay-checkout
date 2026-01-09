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

  const itemsText = order.items
    .map(i => `- ${i.name} x${i.quantity}`)
    .join('\n');

  const mailText = `
Hallo ${order.firstName},

vielen Dank für deine Bestellung!

Bestellnummer: ${order.orderId}
Betrag: CHF ${order.amount}

Produkte:
${itemsText}

Wir melden uns, sobald deine Bestellung versendet wird.

Liebe Grüße  
Payyap
`;

  await transporter.sendMail({
    from: process.env.MAIL_FROM,
    to: order.email,
    subject: 'Bestellbestätigung – Payyap',
    text: mailText
  });
}
