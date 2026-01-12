import { saferpayAuthHeader, saferpayBaseUrl } from '../lib/saferpay.js';

export default async function handler(req, res) {

  // CORS / Preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') return res.status(405).end();

  try {
    const body = req.body || {};
    const customer = body.customer || {};
    const items = Array.isArray(body.items) ? body.items : [];
    const total = body.total; // bereits in Rappen
    const currency = body.currency || 'CHF';

    // 🔒 genau wie gestern
    if (!customer || !customer.email) {
      return res.status(400).json({ error: 'Missing customer data' });
    }

    // ------------------------
    // Order-ID: P-YYYYMMDD-XXXX
    // ------------------------
    const now = new Date();
    const ymd =
      now.getFullYear().toString() +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0');

    const random4 = Math.floor(1000 + Math.random() * 9000);
    const orderId = `P-${ymd}-${random4}`;

    // total ist schon in Rappen
    const amountMinor = Math.round(Number(total));
    if (!amountMinor || amountMinor <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    // ------------------------
    // Saferpay Init
    // ------------------------
    const payload = {
      RequestHeader: {
        SpecVersion: '1.50',
        CustomerId: process.env.SAFERPAY_CUSTOMER_ID,
        RequestId: orderId,
        RetryIndicator: 0
      },
      TerminalId: process.env.SAFERPAY_TERMINAL_ID,
      Payment: {
        Amount: { Value: amountMinor, CurrencyCode: currency },
        OrderId: orderId,
        Description: 'Payyap Bestellung'
      },
      ReturnUrl: {
        Url: `${process.env.RETURN_BASE_URL}/api/saferpay-return?orderId=${encodeURIComponent(orderId)}`
      }
    };

    const r = await fetch(
      `${saferpayBaseUrl()}/Payment/v1/PaymentPage/Initialize`,
      {
        method: 'POST',
        headers: {
          Authorization: saferpayAuthHeader(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      }
    );

    const data = await r.json();
    if (!r.ok) return res.status(500).json(data);

    // ------------------------
    // Airtable (GENAU wie gestern)
    // ------------------------
    const tableName = process.env.AIRTABLE_TABLE_NAME;

    const airtableUrl =
      `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${tableName}`;

    const airtablePayload = {
      records: [
        {
          fields: {
            Name: `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || customer.email,
            orderId,
            email: customer.email,
            amount: amountMinor / 100, // CHF
            currency,
            status: 'PENDING',
            items: items.map(i => `${i.name} x${i.quantity}`).join(', '),

            company: customer.company || '',
            firstName: customer.firstName || '',
            lastName: customer.lastName || '',
            phone: customer.phone || '',
            street: customer.street || '',
            houseNumber: customer.houseNumber || '',
            zip: customer.zip || '',
            city: customer.city || '',

            createdAt: new Date() // exakt wie gestern
          }
        }
      ]
    };

    const airtableRes = await fetch(airtableUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(airtablePayload)
    });

    const airtableData = await airtableRes.json();

    if (!airtableRes.ok) {
      console.error('Airtable error:', airtableData);
      return res.status(500).json({ error: 'Airtable error' });
    }

    // ------------------------
    // Erfolg → Redirect-URL zurück
    // ------------------------
    return res.json({
      redirectUrl: data.RedirectUrl,
      orderId
    });

  } catch (e) {
    console.error('create-payment error:', e);
    return res.status(500).json({ error: e.message });
  }
}
