export function formatPrice(vndAmount, currency) {
  if (currency === 'USD') {
    const usd = Math.round(vndAmount / 25000);
    return `US$${usd.toLocaleString()}`;
  }
  return `VND ${vndAmount.toLocaleString('vi-VN')}`;
}

