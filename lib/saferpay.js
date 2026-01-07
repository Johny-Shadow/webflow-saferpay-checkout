
export function saferpayAuthHeader() {
  const token = Buffer.from(
    process.env.SAFERPAY_USER + ':' + process.env.SAFERPAY_PASS
  ).toString('base64');

  return `Basic ${token}`;
}

export function saferpayBaseUrl() {
  return 'https://test.saferpay.com/api';
}
