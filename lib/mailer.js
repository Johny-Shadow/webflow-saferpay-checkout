export async function sendOrderMail(order) {
  try {
    // ------------------------
    // 1) Access Token holen
    // ------------------------
    const tokenRes = await fetch(
      `https://login.microsoftonline.com/${process.env.MS_TENANT_ID}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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
    // 2) Daten aufbereiten
    // ------------------------
    const fullName =
      `${order.firstName || ''} ${order.lastName || ''}`.trim() || 'Kunde';

    const orderDate = new Date().toLocaleDateString('de-CH');

    // 👉 HIER der entscheidende Punkt
    const paymentMethod =
      order.paymentMethod && order.paymentMethod !== ''
        ? order.paymentMethod
        : 'Onlinezahlung';

    const productList = (order.items || [])
      .map(i => `• ${i.name} x${i.quantity}`)
      .join('<br>');

    const deliveryAddress = `
      ${order.firstName || ''} ${order.lastName || ''}<br>
      ${order.street || ''} ${order.houseNumber || ''}<br>
      ${order.zip || ''} ${order.city || ''}<br>
      Schweiz
    `;

    // ------------------------
    // 3) Mail-Template
    // ------------------------
    const mailHtml = `
      <p>Hallo ${order.firstName || ''},</p>

      <p>
        Vielen Dank für deine Bestellung bei Payyap! 🎉<br>
        Wir haben deine Bestellung erfolgreich erhalten und bearbeiten sie nun.
      </p>

      <p><strong>Bestelldetails:</strong><br>
        Bestellnummer: ${order.orderId}<br>
        Bestelldatum: ${orderDate}<br>
        Gesamtbetrag: ${order.amount} CHF<br>
        Zahlungsmethode: ${paymentMethod}
      </p>

      <p><strong>Bestellte Produkte:</strong><br>
        ${productList || '—'}
      </p>

      <p><strong>Lieferadresse:</strong><br>
        ${deliveryAddress}
      </p>

      <p>
        Sobald deine Bestellung versendet wurde, erhältst du eine weitere E-Mail
        mit den Versandinformationen.
      </p>

      <p>
        Falls du Fragen zu deiner Bestellung hast, erreichst du uns jederzeit unter
        <a href="mailto:info@payyap.ch">info@payyap.ch</a>
        oder über unser Kontaktformular auf
        <a href="https://www.payyap.ch">www.payyap.ch</a>.
      </p>

      <p>
        Vielen Dank für dein Vertrauen und viel Freude mit deiner neuen Kasse!
      </p>

      <p>
        Liebe Grüsse<br>
        Dein Payyap-Team
      </p>
    `;

    // ------------------------
    // 4) Mail über Microsoft Graph senden
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
                emailAddress: { address: order.email }
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
