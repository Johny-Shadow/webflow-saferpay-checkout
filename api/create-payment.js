import { saferpayAuthHeader, saferpayBaseUrl } from '../lib/saferpay.js';
import { createOrder } from '../lib/airtable.js';

function safeJsonStringify(obj) {
  try { return JSON.stringify(obj); } catch { return '[]'; }
}

// total kommt bei dir bereits in Rappen (z.B. 49800)
function normalizeAmountMinor(total) {
  const n = Number(total);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n);
}

export default async function handler(req, res) {

  // Preflight erlauben (CORS)
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
    const currency = body.currency || 'CHF';

    const email = customer.email || body.email || '';
    const firma = customer.company || body.firma || '';
    const firstName = customer.firstName || body.firstName || '';
    const lastName = customer.lastName || body.lastName || '';
    const phone = customer.phone || body.phone || '';
    const street = customer.street || body.street || '';
    const houseNumber = customer.houseNumber || body.houseNumber || '';
    const zip = customer.zip || body.zip || '';
    const city = customer.city || body.city || '';

    if (!email) return res.status(400).json({ error: 'Missing email' });
    if (!items.length) return res.status(400).json({ error: 'Missing items' });

    const orderId =
      `P-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}` +
      `-${Math.floor(1000 + Math.random() * 9000)}`;

    // total ist bereits "minor units" (Rappen)
    const amountMinor = normalizeAmountMinor(body.total);

    if (!amountMinor || amountMinor <= 0) {
      return res.status(400).json({ error: 'Missing/invalid total' });
    }

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

    const r = await fetch(`${saferpayBaseUrl()}/Payment/v1/PaymentPage/Initialize`, {
      method: 'POST',
      headers: {
        Authorization: saferpayAuthHeader(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await r.json();
    if (!r.ok) return res.status(500).json(data);

    const saferpayToken = data.Token;

    // Für Airtable: Betrag in CHF (49800 -> 498.00)
    const amountChf = Math.round(amountMinor) / 100;

    // Items Text + JSON
    const itemsText = items.map(i => `${i.name} x${i.quantity}`).join(', ');
    const itemsJson = safeJsonStringify(items);

    await createOrder({
      Name: `${firstName} ${lastName}`.trim() || email,
      orderId,
      email,
      amount: amountChf,
      currency,
      status: 'PENDING',
      items: itemsText,
      itemsJson,
      paymentMethod: '',

      firma,
      firstName,
      lastName,
      phone,
      street,
      houseNumber,
      zip,
      city,
      country: 'Schweiz',

      saferpayToken,
      createdAt: new Date().toISOString()
    });

    return res.json({ redirectUrl: data.RedirectUrl, orderId });

  } catch (e) {
    console.error('create-payment error:', e);
    return res.status(500).json({ error: e.message });
  }
}
