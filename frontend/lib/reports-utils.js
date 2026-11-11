export function maxChartValue(items) {
  return Math.max(1, ...items.map((item) => item.count || item.completed || 0));
}
