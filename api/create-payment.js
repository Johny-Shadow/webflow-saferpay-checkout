
import { saferpayAuthHeader, saferpayBaseUrl } from '../lib/saferpay.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).end();

    const { items, total, email } = req.body;
    if (!email) return res.status(400).json({ error: 'Missing email' });

    const orderId = 'WF-' + Date.now();
    const amount = Math.round(Number(total));

    const payload = {
      RequestHeader: {
        SpecVersion: '1.30',
        CustomerId: process.env.SAFERPAY_CUSTOMER_ID,
        RequestId: orderId,
        RetryIndicator: 0
      },
      TerminalId: process.env.SAFERPAY_TERMINAL_ID,
      Payment: {
        Amount: { Value: amount, CurrencyCode: 'CHF' },
        OrderId: orderId,
        Description: 'Webflow Bestellung'
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

    if (!r.ok) return res.status(500).json(data);

    res.json({ redirectUrl: data.RedirectUrl, orderId });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
