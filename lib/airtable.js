export async function saveOrderToAirtable(order) {
  const res = await fetch(
    `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/Orders`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fields: {
          orderId: order.id,
          email: order.email,
          amount: order.amount,
          currency: order.currency,
          status: order.status,
          items: JSON.stringify(order.items),
          createdAt: new Date().toISOString()
        }
      })
    }
  );

  if (!res.ok) {
    const t = await res.text();
    throw new Error('Airtable error: ' + t);
  }
}
