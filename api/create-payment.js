import { saferpayAuthHeader, saferpayBaseUrl } from '../lib/saferpay.js';

// Wenn dein Projekt < Node 18 läuft, dann:
// import fetch from 'node-fetch';

export default async function handler(req, res) {

  // ------------------------
  // CORS
  // ------------------------
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method !== 'POST') return res.status(405).end();

    const { items, total, currency = 'CHF', customer } = req.body;

    if (!items || !items.length) {
      return res.status(400).json({ error: 'Missing items' });
    }
    if (!customer || !customer.email) {
      return res.status(400).json({ error: 'Missing customer data' });
    }

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
    // Order-Text bauen
    // ------------------------
    const itemsText = items
      .map(i => `${i.name} x${i.quantity}`)
      .join(', ')
      .slice(0, 200);

    // ------------------------
    // Airtable vorbereiten
    // ------------------------
    const tableName = encodeURIComponent(process.env.AIRTABLE_TABLE_NAME);
    const airtableUrl =
      `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${tableName}`;

    const airtablePayload = {
      records: [
        {
          fields: {
            orderId,
            email: customer.email,
            amount: amount / 100,
            currency,
            status: 'pending',
            items: itemsText,

            firstName: customer.firstName || '',
            lastName: customer.lastName || '',
            company: customer.company || '',
            phone: customer.phone || '',
            street: customer.street || '',
            houseNumber: customer.houseNumber || '',
            zip: customer.zip || '',
            city: customer.city || '',

            createdAt: new Date() // passt für Datumsfeld in Airtable
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
      return res.status(500).json({ error: 'Airtable save failed' });
    }

    // ------------------------
    // Saferpay Payment starten
    // ------------------------
    const payload = {
      RequestHeader: {
        SpecVersion: '1.30',
        CustomerId: process.env.SAFERPAY_CUSTOMER_ID,
        RequestId: orderId,
        RetryIndicator: 0
      },
      TerminalId: process.env.SAFERPAY_TERMINAL_ID,
      Payment: {
        Amount: { Value: amount, CurrencyCode: currency },
        OrderId: orderId,
        Description: itemsText || 'Webflow Bestellung'
      },
      ReturnUrls: {
        Success: `${process.env.RETURN_BASE_URL}/api/saferpay-return?result=success&orderId=${orderId}`,
        Fail: `${process.env.RETURN_BASE_URL}/api/saferpay-return?result=fail&orderId=${orderId}`
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
const saferpayToken = data.Token;


    if (!r.ok || !data.RedirectUrl) {
      console.error('Saferpay error:', data);
      return res.status(500).json({ error: 'Saferpay init failed' });
    }

    // ------------------------
    // Fertig
    // ------------------------
    return res.json({
      redirectUrl: data.RedirectUrl,
      orderId
    });

  } catch (e) {
    console.error('SERVER ERROR:', e);
    return res.status(500).json({ error: e.message });
  }
}
