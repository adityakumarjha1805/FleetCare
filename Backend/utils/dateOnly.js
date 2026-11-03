function parseDateOnly(value) {
  if (typeof value !== 'string') return null;

  const parts = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!parts) return null;

  const year = Number(parts[1]);
  const month = Number(parts[2]);
  const day = Number(parts[3]);
  if (year < 1900 || month < 1 || month > 12) return null;

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day < 1 || day > daysInMonth) return null;

  return new Date(Date.UTC(year, month - 1, day));
}

function toDateOnly(value) {
  return value instanceof Date && !Number.isNaN(value.getTime())
    ? value.toISOString().slice(0, 10)
    : null;
}

module.exports = { parseDateOnly, toDateOnly };
