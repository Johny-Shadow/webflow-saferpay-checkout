import { saferpayAuthHeader, saferpayBaseUrl } from '../lib/saferpay.js';
import { findOrderByOrderId, updateOrderByRecordId } from '../lib/airtable.js';
import { sendOrderMail } from '../lib/mailer.js';

function mapPaymentMethod(assertData) {
  const brand = assertData?.PaymentMeans?.Brand;
  // Saferpay liefert z.B. Name: "VISA" / "PayPal" / "TWINT" etc.
  return brand?.Name || brand?.PaymentMethod || 'Saferpay';
}

export default async function handler(req, res) {
  try {
    const { orderId } = req.query;
    if (!orderId) return res.status(400).send('Missing orderId');

    const record = await findOrderByOrderId(orderId);
    if (!record) return res.status(404).send('Order not found');

    const fields = record.fields || {};
    const saferpayToken = fields.saferpayToken;

    // Wir versuchen immer Assert – wenn nicht möglich, bleiben wir robust
    let paymentMethod = fields.paymentMethod || '';
    let paid = false;

    if (saferpayToken) {
      const assertPayload = {
        RequestHeader: {
          SpecVersion: '1.50',
          CustomerId: process.env.SAFERPAY_CUSTOMER_ID,
          RequestId: `ASSERT-${orderId}`,
          RetryIndicator: 0
        },
        Token: saferpayToken
      };

      const ar = await fetch(`${saferpayBaseUrl()}/Payment/v1/PaymentPage/Assert`, {
        method: 'POST',
        headers: {
          Authorization: saferpayAuthHeader(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(assertPayload)
      });

      const assertData = await ar.json();

      // paid wenn Status nicht FAILED/ABORTED (je nach Methode)
      const status = assertData?.Transaction?.Status;
      paid = status && !['FAILED', 'ABORTED'].includes(status);

      paymentMethod = mapPaymentMethod(assertData);

      // Update in Airtable
      await updateOrderByRecordId(record.id, {
        status: paid ? 'PAID' : 'FAILED',
        paymentMethod
      });
    } else {
      // Token fehlt -> wir können nicht assert-en
      await updateOrderByRecordId(record.id, { status: 'FAILED' });
    }

    // Order-Objekt für Mail bauen (inkl. itemsJson parsen)
    let itemsArr = [];
    try {
      itemsArr = fields.itemsJson ? JSON.parse(fields.itemsJson) : [];
    } catch { itemsArr = []; }

    const orderForMail = {
      orderId: fields.orderId,
      amount: fields.amount,
      email: fields.email,

      firma: fields.firma || '',
      firstName: fields.firstName || '',
      lastName: fields.lastName || '',
      phone: fields.phone || '',
      street: fields.street || '',
      houseNumber: fields.houseNumber || '',
      zip: fields.zip || '',
      city: fields.city || fields.location || '',
      country: fields.country || 'Schweiz',

      paymentMethod: paymentMethod || 'Saferpay',
      items: itemsArr
    };

    // Mail nur bei PAID
    if (paid) {
      await sendOrderMail(orderForMail);
    }

    // Redirect zurück zu Webflow
    const redirect = paid ? process.env.WEBFLOW_SUCCESS_URL : process.env.WEBFLOW_FAIL_URL;
    return res.redirect(302, redirect);
  } catch (e) {
    console.error('saferpay-return error:', e);
    return res.status(500).send(e.message);
  }
}
