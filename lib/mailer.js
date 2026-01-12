export async function sendOrderMail(order) {
  try {
    // ------------------------
    // 1) Access Token holen
    // ------------------------
    const tokenRes = await fetch(
      `https://login.microsoftonline.com/${process.env.MS_TENANT_ID}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          client_id: process.env.MS_CLIENT_ID,
          client_secret: process.env.MS_CLIENT_SECRET,
          scope: 'https://graph.microsoft.com/.default',
          grant_type: 'client_credentials'
        })
      }
    );

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok) {
      console.error('TOKEN ERROR:', tokenData);
      throw new Error('Could not get Microsoft access token');
    }

    const accessToken = tokenData.access_token;

    // ------------------------
    // 2) Mail-Inhalt bauen
    // ------------------------
    const itemsText = (order.items || [])
      .map(i => `- ${i.name} x${i.quantity}`)
      .join('<br>');

    const mailHtml = `
      <p>Hallo ${order.firstName || ''},</p>

      <p>vielen Dank für deine Bestellung!</p>

      <p>
        <strong>Bestellnummer:</strong> ${order.orderId}<br>
        <strong>Betrag:</strong> CHF ${order.amount}
      </p>

      <p><strong>Produkte:</strong><br>
      ${itemsText}</p>

      <p>Wir melden uns, sobald deine Bestellung versendet wird.</p>

      <p>Liebe Grüße<br>
      Payyap</p>
    `;

    // ------------------------
    // 3) Mail über Graph senden
    // ------------------------
    const sendRes = await fetch(
      `https://graph.microsoft.com/v1.0/users/${process.env.MAIL_SENDER}/sendMail`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: {
            subject: `Bestellbestätigung – ${order.orderId}`,
            body: {
              contentType: 'HTML',
              content: mailHtml
            },
            toRecipients: [
              {
                emailAddress: {
                  address: order.email
                }
              }
            ]
          },
          saveToSentItems: true
        })
      }
    );

    if (!sendRes.ok) {
      const err = await sendRes.text();
      console.error('GRAPH MAIL ERROR:', err);
      throw new Error('Mail send failed');
    }

  } catch (e) {
    console.error('MAILER ERROR:', e);
    throw e;
  }
}
