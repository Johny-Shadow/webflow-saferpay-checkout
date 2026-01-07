import { saveOrderToAirtable } from '../lib/airtable.js';
import { sendOrderMail } from '../lib/mailer.js';

export default async function handler(req, res) {
  try {
    const { result, orderId } = req.query;

    const status = result === 'success' ? 'PAID' : 'FAILED';

    const order = {
      id: orderId,
      email: '',
      amount: '',
      currency: 'CHF',
      status,
      items: []
    };

    await saveOrderToAirtable(order);

    if (status === 'PAID') {
      await sendOrderMail(order);
    }

    const redirect =
      status === 'PAID'
        ? process.env.WEBFLOW_SUCCESS_URL
        : process.env.WEBFLOW_FAIL_URL;

    res.redirect(302, redirect);
  } catch (e) {
    res.status(500).send(e.message);
  }
}
