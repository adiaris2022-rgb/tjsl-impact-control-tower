# NORTAGO Order — Reservation Capacity & Double-Booking Design

## Status
Design proposal only. This document does not enable capacity enforcement or change production behavior.

## Problem confirmed during code audit
Customer reservations are submitted for an outlet, date/time, and party size. The current flow records requests and staff manage status, but the reservation model does not expose a configured seating capacity, time-slot inventory, or conflict prevention. Confirmation alone is not a guarantee that seating capacity is available.

## Proposed model
Use explicit, outlet-scoped reservation settings. Do not infer capacity from restaurant name, number of outlets, or party size.

- **Outlet settings:** reservation enabled; timezone (IANA); default slot duration; slot interval; maximum party size; configurable buffer; operating hours per weekday.
- **Capacity:** either a simple maximum simultaneous guests per time slot, or table inventory (table size and count) for restaurants requiring table assignment. Start with simple guest-capacity mode for MVP; table inventory is a later option.
- **Slot calculation:** slot starts are generated in the outlet's timezone from configured operating hours. A reservation occupies its configured duration plus buffer. Overlapping intervals are evaluated, not only identical clock times.
- **Statuses:** PENDING consumes capacity only if the outlet chooses a configurable hold policy; CONFIRMED consumes capacity; CANCELLED, NO_SHOW and COMPLETED release capacity according to policy. Default policy for MVP: only CONFIRMED reservations consume capacity; PENDING has a short configurable hold only after an outlet explicitly enables it.
- **Concurrency:** all capacity validation and confirmation must run in one database transaction with row/slot locking or an atomic capacity ledger. A read-then-write client check is not sufficient. Concurrent requests must not overbook.
- **Time:** store timestamptz in UTC; derive slot boundaries from the outlet timezone. Handle daylight-saving transitions for non-Indonesia outlets; reject invalid/ambiguous local times unless resolved.
- **Tenant isolation:** every setting and capacity record is outlet/business-scoped. RLS and RPC authorization use membership/role checks; customer-facing RPCs accept only active outlet IDs and never trust client-supplied business IDs.
- **Auditing:** record status changes, actor, timestamp, previous/new status, and reason. Customer data must be minimized and access scoped.

## MVP implementation sequence
1. Add outlet reservation settings and default-safe migration values (reservation feature remains disabled until owner configures it).
2. Add slot availability RPC returning capacity, reserved party size, remaining capacity, and availability for a selected date/time range.
3. Implement transactional reservation creation and confirmation capacity checks with concurrency-safe locking.
4. Add owner UI for operating hours, slot duration, capacity, buffers, and reservation policy.
5. Add customer UI that displays only returned available slots; preserve server validation on submit.
6. Add SQL smoke tests: inactive outlet, invalid timezone/time, past slot, out-of-hours slot, party-size limit, capacity edge, overlapping interval, cancellation releasing capacity, pending policy, unauthorized confirmation, and two concurrent requests that cannot exceed capacity.
7. Add audit history and owner notifications; only after staging UAT.

## Acceptance criteria
- No overbooking under concurrent requests.
- Customer UI availability is advisory; database RPC is authoritative.
- Reservations are isolated across businesses/outlets.
- Capacity changes cannot silently invalidate confirmed bookings; owner sees impact and must explicitly acknowledge.
- Existing reservations remain readable and status management is backward compatible.
- No staging/production migration is applied by this design PR.

## Decisions needed before implementation
The MVP should use guest-count capacity unless table assignment is a must-have. Each outlet owner must configure operating hours, slot duration, guest capacity, and buffer; no defaults should be treated as real capacity.