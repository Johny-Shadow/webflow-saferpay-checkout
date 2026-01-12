import { sendOrderMail } from '../lib/mailer.js';

export default async function handler(req, res) {
  try {
    const { result, orderId } = req.query;

    if (!orderId) {
      return res.status(400).send('Missing orderId');
    }

    const status = result === 'success' ? 'paid' : 'failed';

    // ------------------------
    // Airtable Status updaten
    // ------------------------
    const tableName = encodeURIComponent(process.env.AIRTABLE_TABLE_NAME);
    const airtableUrl =
      `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${tableName}`;

    // 1) Datensatz suchen
    const findRes = await fetch(
      `${airtableUrl}?filterByFormula=${encodeURIComponent(`{orderId}='${orderId}'`)}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`
        }
      }
    );

    const findData = await findRes.json();

    if (!findRes.ok || !findData.records || !findData.records.length) {
      console.error('ORDER NOT FOUND IN AIRTABLE:', findData);
      return res.status(500).send('Order not found');
    }

    const record = findData.records[0];
    const fields = record.fields;

    // 2) Status setzen
    const updateRes = await fetch(
      `${airtableUrl}/${record.id}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fields: { status }
        })
      }
    );

    if (!updateRes.ok) {
      const err = await updateRes.text();
      console.error('AIRTABLE UPDATE ERROR:', err);
    }

    // ------------------------
    // Mail nur bei Erfolg
    // ------------------------
    if (status === 'paid') {

      const orderForMail = {
        orderId: fields.orderId,
        email: fields.email,
        amount: fields.amount,

        firstName: fields.firstName || '',
        lastName: fields.lastName || '',

        // 🔹 Produkte
        items: (fields.items || '')
          .split(',')
          .map(s => {
            const [name, qty] = s.split(' x');
            return {
              name: (name || '').trim(),
              quantity: Number(qty) || 1
            };
          }),

        // 🔹 Lieferadresse (JETZT korrekt)
        street: fields.street || '',
        houseNumber: fields.houseNumber || '',
        zip: fields.zip || '',
        location: fields.city || '',   // Airtable → Mail-Template

        // 🔹 Zahlungsart (vorerst fix, später von Saferpay Assert)
        paymentMethod: 'Saferpay'
      };

      await sendOrderMail(orderForMail);
    }

    // ------------------------
    // Redirect zurück zu Webflow
    // ------------------------
    const redirectUrl =
      status === 'paid'
        ? process.env.WEBFLOW_SUCCESS_URL
        : process.env.WEBFLOW_FAIL_URL;

    return res.redirect(302, redirectUrl);

  } catch (e) {
    console.error('SAFERPAY RETURN ERROR:', e);
    return res.status(500).send('Return handling failed');
  }
}
