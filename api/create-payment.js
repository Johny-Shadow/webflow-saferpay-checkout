import { saferpayAuthHeader, saferpayBaseUrl } from '../lib/saferpay.js';
import { createOrder } from '../lib/airtable.js';

function toMinorAmountCHF(total) {
  // total kommt bei dir i.d.R. als Zahl mit CHF (z.B. 488) -> Saferpay erwartet i.d.R. Minor Units (Rappen)
  // Wenn du total bereits in CHF ohne Rappen nutzt, bleib konsistent:
  // Empfehlung: total im Frontend als "CHF" mit 2 Dezimalen schicken.
  const n = Number(total);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

function safeJsonStringify(obj) {
  try { return JSON.stringify(obj); } catch { return '[]'; }
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).end();

    const {
      items,
      total,
      // Form Felder (von dir)
      firma,
      firstName,
      lastName,
      email,
      phone,
      street,
      houseNumber,
      zip,
      city
    } = req.body;

    if (!email) return res.status(400).json({ error: 'Missing email' });
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Missing items' });
    }

    const orderId = `P-${new Date().toISOString().slice(0,10).replaceAll('-','')}-${Math.floor(1000 + Math.random()*9000)}`;

    // Betrag (Rappen)
    const amount = toMinorAmountCHF(total);

    const payload = {
      RequestHeader: {
        SpecVersion: '1.50',
        CustomerId: process.env.SAFERPAY_CUSTOMER_ID,
        RequestId: orderId,
        RetryIndicator: 0
      },
      TerminalId: process.env.SAFERPAY_TERMINAL_ID,
      Payment: {
        Amount: { Value: amount, CurrencyCode: 'CHF' },
        OrderId: orderId,
        Description: 'Payyap Bestellung'
      },
      ReturnUrl: {
        // Wir leiten immer auf unseren Return-Endpoint zurück
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

    // Token unbedingt speichern, damit wir im Return Assert machen können
    const saferpayToken = data.Token;

    // Items formatiert
    const itemsText = items.map(i => `${i.name} x${i.quantity}`).join(', ');
    const itemsJson = safeJsonStringify(items);

    await createOrder({
      Name: `${firstName || ''} ${lastName || ''}`.trim() || email,
      orderId,
      email,
      amount: Number(total),      // fürs Airtable-UI in CHF (wie du’s bisher hattest)
      currency: 'CHF',
      status: 'PENDING',
      items: itemsText,
      itemsJson,
      paymentMethod: '',

      firma: firma || '',
      firstName: firstName || '',
      lastName: lastName || '',
      phone: phone || '',
      street: street || '',
      houseNumber: houseNumber || '',
      zip: zip || '',
      city: city || '',
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

