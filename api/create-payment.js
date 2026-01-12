  return res.status(400).json({ error: 'Missing customer data' });
    }

    const orderId = 'WF-' + Date.now();
    // ------------------------
    // 🆕 Order-ID erzeugen: P-YYYYMMDD-XXXX
    // ------------------------
    const now = new Date();
    const ymd =
      now.getFullYear().toString() +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0');

    const random4 = Math.floor(1000 + Math.random() * 9000);
    const orderId = `P-${ymd}-${random4}`;

    const amount = Math.round(Number(total)); // already in cents

    // ------------------------
@@ -46,10 +57,6 @@ export default async function handler(req, res) {
    const airtableUrl =
      `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${tableName}`;

    console.log('AIRTABLE BASE:', process.env.AIRTABLE_BASE_ID);
    console.log('AIRTABLE TABLE:', process.env.AIRTABLE_TABLE_NAME);
    console.log('AIRTABLE TOKEN SET:', !!process.env.AIRTABLE_TOKEN);

    const airtablePayload = {
      records: [
        {
@@ -70,7 +77,7 @@ export default async function handler(req, res) {
            zip: customer.zip || '',
            city: customer.city || '',

            createdAt: new Date().toISOString()
            createdAt: new Date() // passt für Datumsfeld in Airtable
          }
        }
      ]
