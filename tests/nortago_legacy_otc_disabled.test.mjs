import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const legacyLayout = readFileSync("otc/app/layout.tsx", "utf8");
const activeOrderLayout = readFileSync("app/otc/layout.tsx", "utf8");

test("legacy standalone OTC app renders only the disabled notice", () => {
  assert.match(legacyLayout, /NORTAGO Order \| Legacy demo disabled/);
  assert.match(legacyLayout, /Aplikasi OTC legacy ini dinonaktifkan/);
  assert.match(legacyLayout, /bukan bukti transaksi/);
  assert.doesNotMatch(legacyLayout, /\{children\}|children\s*:/);
  assert.doesNotMatch(legacyLayout, /Owner Control Tower|NORTAGO OTC/);
});

test("active root NORTAGO Order app still renders its route children", () => {
  assert.match(activeOrderLayout, /title:\s*"NORTAGO Order"/);
  assert.match(activeOrderLayout, /return children/);
});
