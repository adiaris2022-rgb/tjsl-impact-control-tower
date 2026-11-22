/**
 * Build a complete hourly order report from paginated order rows.
 * Uses the browser's local time zone by default, matching the prior report UI.
 */
export function summarizeHourlyOrders(orders, timeZone) {
  if (!Array.isArray(orders)) throw new Error("Invalid hourly report orders");
  const grouped = new Map();
  for (const order of orders) {
    if (!order || typeof order.created_at !== "string" || !Number.isFinite(Date.parse(order.created_at))) {
      throw new Error("Invalid hourly report order timestamp");
    }
    const amount = Number(order.total ?? 0);
    if (!Number.isFinite(amount)) throw new Error("Invalid hourly report order total");
    const hour = new Date(order.created_at).toLocaleTimeString("id-ID", {
      hour: "2-digit",
      hour12: false,
      ...(timeZone ? { timeZone } : {}),
    });
    const bucket = grouped.get(hour) || { hour, count: 0, paidTotal: 0 };
    bucket.count += 1;
    if (order.payment_status === "PAID") bucket.paidTotal += amount;
    grouped.set(hour, bucket);
  }
  return Array.from(grouped.values()).sort((a, b) => a.hour.localeCompare(b.hour));
}
