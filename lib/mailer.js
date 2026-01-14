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

    const paymentMethod =
      order.paymentMethod && order.paymentMethod !== ''
        ? order.paymentMethod
        : 'Onlinezahlung';

    const productListHtml = (order.items || [])
      .map(i => `• ${i.name} x${i.quantity}`)
      .join('<br>');

    const productListText = (order.items || [])
      .map(i => `- ${i.name} x${i.quantity}`)
      .join('\n');

    const deliveryAddressHtml = `
      ${order.firstName || ''} ${order.lastName || ''}<br>
      ${order.street || ''} ${order.houseNumber || ''}<br>
      ${order.zip || ''} ${order.city || ''}<br>
      ${order.country || 'Schweiz'}
    `;

    const deliveryAddressText = `
${order.firstName || ''} ${order.lastName || ''}
${order.street || ''} ${order.houseNumber || ''}
${order.zip || ''} ${order.city || ''}
${order.country || 'Schweiz'}
    `.trim();

    // ------------------------
    // 3) Kunden-Mail
    // ------------------------
    const customerMailHtml = `
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
        ${productListHtml || '—'}
      </p>

      <p><strong>Lieferadresse:</strong><br>
        ${deliveryAddressHtml}
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
    // 4) Admin-Mail (NEU)
    // ------------------------
    const adminMailText = `
Neue Bestellung eingegangen 🚀

Bestellnummer: ${order.orderId}
Datum: ${orderDate}
Betrag: CHF ${order.amount}
Zahlungsmethode: ${paymentMethod}

Kundendaten:
Name: ${fullName}
E-Mail: ${order.email}
Telefon: ${order.phone || '-'}

Lieferadresse:
${deliveryAddressText}

Produkte:
${productListText || '-'}
    `.trim();

    // ------------------------
    // 5) Beide Mails senden
    // ------------------------
    const sendMail = async (message) => {
      const res = await fetch(
        `https://graph.microsoft.com/v1.0/users/${process.env.MAIL_SENDER}/sendMail`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message,
            saveToSentItems: true
          })
        }
      );

      if (!res.ok) {
        const err = await res.text();
        console.error('GRAPH MAIL ERROR:', err);
        throw new Error('Mail send failed');
      }
    };

    // 👉 1) Mail an Kunde
    await sendMail({
      subject: `Bestellbestätigung – ${order.orderId}`,
      body: {
        contentType: 'HTML',
        content: customerMailHtml
      },
      toRecipients: [
        { emailAddress: { address: order.email } }
      ]
    });

    // 👉 2) Mail an Payyap (Admin)
    await sendMail({
      subject: `Neue Bestellung – ${order.orderId}`,
      body: {
        contentType: 'Text',
        content: adminMailText
      },
      toRecipients: [
        { emailAddress: { address: 'info@payyap.ch' } }
      ]
    });

  } catch (e) {
    console.error('MAILER ERROR:', e);
    throw e;
  }
}
