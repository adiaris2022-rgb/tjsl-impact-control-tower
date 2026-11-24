import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const reservationRoutes = [
  "app/otc/reservation/page.tsx",
  "otc/app/reservation/page.tsx",
];

for (const route of reservationRoutes) {
  test(`${route} remains a static unavailable page outside NORTAGO ORDER`, () => {
    const source = readFileSync(route, "utf8");

    assert.match(source, /Reservasi meja tidak tersedia/i);
    assert.match(source, /Dine-In/i);
    assert.match(source, /Walk-In/i);
    assert.match(source, /Kembali ke menu pesanan/i);

    assert.doesNotMatch(
      source,
      /<form\b|onSubmit|useState|setOk|Buat Reservasi|Status:\s*CONFIRMED|nortago_create_customer_reservation|nortago_update_reservation_status/i,
    );
  });
}
