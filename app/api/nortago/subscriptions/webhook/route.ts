import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

function validSignature(rawBody: string, header: string, secret: string, timestampHeader: string) {
  const match = /^t=(\d+),v1=([a-f0-9]{64})$/i.exec(header);
  if (!match || match[1] !== timestampHeader) return false;
  const timestamp = Number(match[1]);
  if (!Number.isFinite(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`, "utf8").digest();
  const supplied = Buffer.from(match[2], "hex");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export async function POST(request: NextRequest) {
  const secret = process.env.ORDERHERO_LINKBAYAR_WEBHOOK_SECRET;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const apiKey = process.env.ORDERHERO_SECRET_KEY;
  if (!secret || !supabaseUrl || !serviceKey || !apiKey) {
    return json({ error: "WEBHOOK_SERVER_CONFIG_MISSING" }, 503);
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-webhook-signature") || "";
  const timestamp = request.headers.get("x-webhook-timestamp") || "";
  const deliveryId = request.headers.get("x-webhook-delivery") || "";
  const eventHeader = request.headers.get("x-webhook-event") || "";
  if (!deliveryId || !validSignature(rawBody, signature, secret, timestamp)) {
    return json({ error: "INVALID_WEBHOOK_SIGNATURE" }, 401);
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return json({ error: "INVALID_JSON" }, 400);
  }
  const bodyEventType = event?.type || event?.event || "";
  if (eventHeader && bodyEventType && eventHeader !== bodyEventType) {
    return json({ error: "WEBHOOK_EVENT_HEADER_MISMATCH" }, 400);
  }
  const eventType = eventHeader || bodyEventType;
  if (event?.data?.test === true || event?.test === true) {
    return json({ ok: true, ignored: "TEST_EVENT" });
  }
  if (!["payment_request.paid", "payment_request.cancelled", "payment_request.expired"].includes(eventType)) {
    return json({ ok: true, ignored: "UNSUPPORTED_EVENT" });
  }

  const object = event?.data?.object;
  const referenceId = object?.reference_id;
  if (!referenceId) return json({ error: "MISSING_REFERENCE_ID" }, 400);

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: payment, error: paymentError } = await admin.from("subscription_payments")
    .select("id,invoice_id,provider_reference,amount_idr,currency,invoice:subscription_invoices(invoice_no,amount_idr,currency)")
    .eq("provider", "ORDERHERO_LINKBAYAR")
    .eq("provider_reference", referenceId)
    .maybeSingle();
  if (paymentError || !payment) return json({ error: "PAYMENT_REFERENCE_NOT_FOUND" }, 404);
  const invoice = Array.isArray(payment.invoice) ? payment.invoice[0] : payment.invoice;
  if (!invoice?.invoice_no) return json({ error: "INVOICE_NOT_FOUND" }, 404);

  // Re-fetch the authoritative provider state for every supported event,
  // not only "paid". A signed notification is an event signal, not the
  // canonical payment record; delayed/out-of-order events must not regress it.
  const providerResponse = await fetch(
    `https://api.orderhero.id/v1/payment-requests/${encodeURIComponent(referenceId)}`,
    { headers: { Authorization: `Bearer ${apiKey}` }, cache: "no-store" },
  );
  const providerBody = await providerResponse.json().catch(() => ({}));
  if (!providerResponse.ok || providerBody.ok !== true) {
    return json({ error: "PROVIDER_RECHECK_FAILED" }, 502);
  }
  const verified = providerBody.data?.payment_request || providerBody.data;
  const expectedStatus = eventType === "payment_request.paid"
    ? "paid"
    : eventType === "payment_request.cancelled" ? "cancelled" : "expired";
  if (verified?.status !== expectedStatus
    || verified?.reference_id !== referenceId
    || Number(verified?.amount) !== Number(invoice.amount_idr)
    || verified?.currency !== "IDR") {
    return json({ error: "PROVIDER_EVENT_MISMATCH" }, 409);
  }

  const { data: result, error: settleError } = await admin.rpc("nortago_settle_subscription_payment", {
    p_delivery_id: deliveryId,
    p_event_type: eventType,
    p_invoice_no: invoice.invoice_no,
    p_provider_reference: referenceId,
    p_provider_status: verified.status,
    p_amount_idr: Number(verified.amount),
    p_currency: verified.currency,
    p_provider_payload: verified || {},
  });
  if (settleError) {
    return json({ error: "SUBSCRIPTION_SETTLEMENT_FAILED", message: settleError.message }, 500);
  }
  return json({ ok: true, result });
}
