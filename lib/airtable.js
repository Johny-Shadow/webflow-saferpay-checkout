const AIRTABLE_BASE = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TABLE = process.env.AIRTABLE_TABLE || 'Orders';
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;

function airtableUrl(path = '') {
  return `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(AIRTABLE_TABLE)}${path}`;
}

async function airtableFetch(url, options = {}) {
  const r = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${AIRTABLE_TOKEN}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    console.error('Airtable error:', data);
    throw new Error(data?.error?.message || 'Airtable request failed');
  }
  return data;
}

export async function createOrder(fields) {
  return airtableFetch(airtableUrl(), {
    method: 'POST',
    body: JSON.stringify({ records: [{ fields }] })
  });
}

export async function findOrderByOrderId(orderId) {
  const formula = encodeURIComponent(`{orderId}="${orderId}"`);
  const url = `${airtableUrl()}?filterByFormula=${formula}&maxRecords=1`;
  const data = await airtableFetch(url, { method: 'GET' });
  return data.records?.[0] || null;
}

export async function updateOrderByRecordId(recordId, fields) {
  return airtableFetch(airtableUrl(`/${recordId}`), {
    method: 'PATCH',
    body: JSON.stringify({ fields })
  });
}
