export async function sendOrderMail(order) {
  // 1) Token holen
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

  // 2) Daten formatieren
  const orderDate = new Date().toLocaleDateString('de-CH');

  const productList = (order.items || [])
    .map(i => {
      const price = (i.price !== undefined && i.price !== null) ? ` – CHF ${i.price}` : '';
      return `• ${i.name} × ${i.quantity}${price}`;
    })
    .join('<br>');

  const addressLines = [
    `${order.firstName || ''} ${order.lastName || ''}`.trim(),
    `${order.street || ''} ${order.houseNumber || ''}`.trim(),
    `${order.zip || ''} ${order.city || ''}`.trim(),
    `${order.country || 'Schweiz'}`
  ].filter(Boolean);

  const addressBlock = addressLines.join('<br>');

  const paymentMethodText = order.paymentMethod || 'Saferpay';

  // 3) HTML-Template
  const mailHtml = `
    <p>Hallo ${order.firstName || ' '},</p>

    <p>Vielen Dank für deine Bestellung bei <strong>Payyap</strong>! 🎉</p>
    <p>Wir haben deine Bestellung erfolgreich erhalten und bearbeiten sie nun.</p>

    <p><strong>Bestelldetails:</strong><br>
    Bestellnummer: ${order.orderId}<br>
    Bestelldatum: ${orderDate}<br>
    Gesamtbetrag: ${order.amount} CHF<br>
    Zahlungsmethode: ${paymentMethodText}</p>

    <p><strong>Bestellte Produkte:</strong><br>
    ${productList || '—'}</p>

    <p><strong>Lieferadresse:</strong><br>
    ${addressBlock || '—'}</p>

    <p>
      Sobald deine Bestellung versendet wurde, erhältst du eine weitere E-Mail
      mit den Versandinformationen.
    </p>

    <p>
      Falls du Fragen zu deiner Bestellung hast, erreichst du uns jederzeit unter
      <a href="mailto:info@payyap.ch">info@payyap.ch</a> oder über unser Kontaktformular auf
      <a href="https://www.payyap.ch">www.payyap.ch</a>.
    </p>

    <p>Vielen Dank für dein Vertrauen und viel Freude mit deiner neuen Kasse!</p>

    <p>Liebe Grüsse<br><strong>Dein Payyap-Team</strong></p>
  `;

  // 4) Senden via Graph
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
          body: { contentType: 'HTML', content: mailHtml },
          toRecipients: [{ emailAddress: { address: order.email } }]
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
}
