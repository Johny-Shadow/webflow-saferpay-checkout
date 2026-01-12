import { sendOrderMail } from '../lib/mailer.js';
import { saferpayAuthHeader, saferpayBaseUrl } from '../lib/saferpay.js';

export default async function handler(req, res) {
  try {
    const { result, orderId } = req.query;

    if (!orderId) {
      return res.status(400).send('Missing orderId');
    }

    const status = result === 'success' ? 'paid' : 'failed';

    // ------------------------
    // Airtable Setup
    // ------------------------
    const tableName = encodeURIComponent(process.env.AIRTABLE_TABLE_NAME);
    const airtableUrl =
      `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${tableName}`;

    // ------------------------
    // 1) Bestellung finden
    // ------------------------
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

    // ------------------------
    // 2) Zahlungsart via Saferpay Assert holen
    // ------------------------
    let paymentMethod = 'Saferpay';

    if (status === 'paid' && fields.saferpayToken) {
      try {
        const assertPayload = {
          RequestHeader: {
            SpecVersion: '1.30',
            CustomerId: process.env.SAFERPAY_CUSTOMER_ID,
            RequestId: `${orderId}-assert`,
            RetryIndicator: 0
          },
          Token: fields.saferpayToken
        };

        const assertRes = await fetch(
          `${saferpayBaseUrl()}/Payment/v1/PaymentPage/Assert`,
          {
            method: 'POST',
            headers: {
              Authorization: saferpayAuthHeader(),
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(assertPayload)
          }
        );

        const assertData = await assertRes.json();

        console.log('SAFERPAY ASSERT RESPONSE:', JSON.stringify(assertData, null, 2));

        if (assertRes.ok) {
          // 🔥 GENAU DEIN RESPONSE-FORMAT
          const method =
            assertData?.PaymentMeans?.Brand?.PaymentMethod ||
            assertData?.PaymentMeans?.DisplayText ||
            null;

          if (method) {
            paymentMethod = method.toUpperCase();
          }
        }

      } catch (e) {
        console.error('SAFERPAY ASSERT ERROR:', e);
      }
    }

    // ------------------------
    // 3) Airtable updaten
    // ------------------------
    const updateRes = await fetch(
      `${airtableUrl}/${record.id}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fields: {
            status,
            paymentMethod
          }
        })
      }
    );

    if (!updateRes.ok) {
      const err = await updateRes.text();
      console.error('AIRTABLE UPDATE ERROR:', err);
    }

    // ------------------------
    // 4) Mail bei Erfolg
    // ------------------------
    if (status === 'paid') {

      const orderForMail = {
        orderId: fields.orderId,
        email: fields.email,
        amount: fields.amount,

        firstName: fields.firstName,
        lastName: fields.lastName,

        street: fields.street,
        houseNumber: fields.houseNumber,
        zip: fields.zip,
        city: fields.city,

        paymentMethod,

        items: (fields.items || '')
          .split(',')
          .map(s => {
            const [name, qty] = s.split(' x');
            return {
              name: (name || '').trim(),
              quantity: Number(qty) || 1
            };
          })
      };

      await sendOrderMail(orderForMail);
    }

    // ------------------------
    // 5) Redirect
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
