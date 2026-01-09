export default async function handler(req, res) {
  try {
    const { result, orderId } = req.query;

    if (!orderId) {
      return res.status(400).send('Missing orderId');
    }

    const status = result === 'success' ? 'paid' : 'failed';

    // ------------------------
    // Airtable vorbereiten
    // ------------------------
    const tableName = encodeURIComponent(process.env.AIRTABLE_TABLE_NAME);
    const airtableBase = process.env.AIRTABLE_BASE_ID;
    const airtableUrl =
      `https://api.airtable.com/v0/${airtableBase}/${tableName}`;

    // ------------------------
    // 1) Order suchen
    // ------------------------
    const findRes = await fetch(
      `${airtableUrl}?filterByFormula=${encodeURIComponent(`{orderId}="${orderId}"`)}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`
        }
      }
    );

    const findData = await findRes.json();

    if (!findRes.ok || !findData.records || !findData.records.length) {
      console.error('Order not found in Airtable:', orderId);
      return res.status(404).send('Order not found');
    }

    const recordId = findData.records[0].id;

    // ------------------------
    // 2) Status updaten
    // ------------------------
    await fetch(
      `${airtableUrl}/${recordId}`,
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

    // ------------------------
    // 3) Weiterleitung Kunde
    // ------------------------
    const redirect =
      status === 'paid'
        ? process.env.WEBFLOW_SUCCESS_URL
        : process.env.WEBFLOW_FAIL_URL;

    return res.redirect(302, redirect);

  } catch (e) {
    console.error('RETURN ERROR:', e);
    return res.status(500).send('Server error');
  }
}
