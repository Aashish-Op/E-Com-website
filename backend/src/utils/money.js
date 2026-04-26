function toPaise(value) {
  if (typeof value === 'number') return Math.round(value * 100);
  const numeric = String(value || '').replace(/[^\d.]/g, '');
  return Math.round((Number(numeric) || 0) * 100);
}

function formatINR(paise) {
  return '₹' + Math.round((paise || 0) / 100).toLocaleString('en-IN');
}

module.exports = { toPaise, formatINR };
