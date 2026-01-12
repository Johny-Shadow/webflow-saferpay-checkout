import { saferpayAuthHeader, saferpayBaseUrl } from '../lib/saferpay.js';
import { createOrder } from '../lib/airtable.js';

function toMinorAmountCHF(total) {
  const n = Number(total);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

function safeJsonStringify(obj) {
  try { return JSON.stringify(obj); } catch { return '[]'; }
}

export default async function handler(req, res) {

  // ✅ EINZIGE ÄNDERUNG: Preflight zulassen
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  // 🔒 alles bleibt wie vorher
  if (req.method !== 'POST') return res.status(405).end();

  try {
const body = req.body || {};

const items =
  body.items ||
  body.cartItems ||
  body.products ||
  [];

const total =
  body.total ||
  body.amount ||
  body.sum ||
  0;

const email =
  body.email ||
  body.mail ||
  body.customerEmail ||
  '';

const firma = body.firma || '';
const firstName = body.firstName || body.vorname || '';
const lastName  = body.lastName  || body.nachname || '';
const phone     = body.phone || '';
const street    = body.street || '';
const houseNumber = body.houseNumber || '';
const zip       = body.zip || '';
const city      = body.city || '';


    if (!email) return res.status(400).json({ error: 'Missing email' });
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Missing items' });
    }

    const orderId =
      `P-${new Date().toISOString().slice(0,10).replaceAll('-','')}` +
      `-${Math.floor(1000 + Math.random()*9000)}`;

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

    const saferpayToken = data.Token;

    const itemsText = items.map(i => `${i.name} x${i.quantity}`).join(', ');
    const itemsJson = safeJsonStringify(items);

    await createOrder({
      Name: `${firstName || ''} ${lastName || ''}`.trim() || email,
      orderId,
      email,
      amount: Number(total),
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
