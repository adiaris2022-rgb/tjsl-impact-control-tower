import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get("authorization") || "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    if (!token) return json({ error: "AUTH_REQUIRED" }, 401);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const orderHeroKey = process.env.ORDERHERO_SECRET_KEY;
    const enabled = process.env.ORDERHERO_LINKBAYAR_ENABLED === "true";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!supabaseUrl || !anonKey || !serviceKey) return json({ error: "SUPABASE_SERVER_CONFIG_MISSING" }, 503);
    if (!enabled || !orderHeroKey) return json({ error: "ORDERHERO_LINKBAYAR_NOT_CONFIGURED" }, 503);
    if (!appUrl || !appUrl.startsWith("https://")) return json({ error: "NEXT_PUBLIC_APP_URL_HTTPS_REQUIRED" }, 503);

    const body = await request.json();
    const businessId = typeof body.business_id === "string" ? body.business_id : "";
    const outletIds = Array.isArray(body.outlet_ids)
      ? [...new Set(body.outlet_ids.filter((id: unknown) => typeof id === "string"))] as string[]
      : [];
    const planCode = body.plan_code === "NORTAGO_OUTLET_YEARLY"
      ? "NORTAGO_OUTLET_YEARLY"
      : body.plan_code === "NORTAGO_OUTLET_MONTHLY" ? "NORTAGO_OUTLET_MONTHLY" : "";
    if (!businessId || !outletIds.length || outletIds.length > 100 || !planCode) {
      return json({ error: "INVALID_REQUEST" }, 400);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userResult, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userResult.user) return json({ error: "INVALID_SESSION" }, 401);

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const payments: Array<{
      outlet_id: string;
      invoice_no: string;
      amount_idr: number;
      payment_url: string;
      expires_at: string | null;
    }> = [];
    const failures: Array<{ outlet_id: string; error: string }> = [];

    for (const outletId of outletIds) {
      const { data: invoice, error: invoiceError } = await userClient.rpc(
        "nortago_prepare_subscription_invoice",
        { p_business_id: businessId, p_outlet_id: outletId, p_plan_code: planCode },
      );
      if (invoiceError || !invoice) {
        failures.push({ outlet_id: outletId, error: invoiceError?.message || "INVOICE_PREPARATION_FAILED" });
        continue;
      }

      const invoiceNo = String(invoice.invoice_no);
      const amount = Number(invoice.amount_idr);
      const paymentUrl = `https://api.orderhero.id/v1/payment-requests/${encodeURIComponent(invoiceNo)}`;
      const headers = { Authorization: `Bearer ${orderHeroKey}` };

      // Always reconcile the durable reference before creating a new bill.
      const lookupResponse = await fetch(paymentUrl, { headers, cache: "no-store" });
      const lookupBody = await lookupResponse.json().catch(() => ({}));
      let paymentRequest: any = null;
      if (lookupResponse.ok && lookupBody.ok === true) {
        paymentRequest = lookupBody.data?.payment_request || lookupBody.data;
      } else if (lookupResponse.status !== 404) {
        failures.push({ outlet_id: outletId, error: lookupBody.error || "ORDERHERO_LOOKUP_FAILED" });
        continue;
      }

      if (paymentRequest && paymentRequest.status !== "open") {
        failures.push({
          outlet_id: outletId,
          error: `ORDERHERO_PAYMENT_NOT_OPEN_${String(paymentRequest.status || "UNKNOWN").toUpperCase()}`,
        });
        continue;
      }

      if (!paymentRequest) {
        // A previous POST may have timed out after OrderHero accepted it.
        // On GET 404, use a fresh idempotency key while retaining the same
        // durable reference_id. This follows OrderHero's recovery contract.
        const { data: paymentRow, error: paymentReadError } = await admin
          .from("subscription_payments")
          .select("idempotency_key")
          .eq("id", invoice.payment_id)
          .eq("invoice_id", invoice.invoice_id)
          .single();
        if (paymentReadError || !paymentRow?.idempotency_key) {
          failures.push({ outlet_id: outletId, error: "IDEMPOTENCY_STATE_UNAVAILABLE" });
          continue;
        }

        const currentKey = String(paymentRow.idempotency_key);
        const revision = Number(currentKey.match(/\.r(\d+)$/)?.[1] || 1) + 1;
        const nextKey = `${invoiceNo}.r${revision}`;
        const { data: claimedKey, error: claimError } = await admin
          .from("subscription_payments")
          .update({ idempotency_key: nextKey })
          .eq("id", invoice.payment_id)
          .eq("invoice_id", invoice.invoice_id)
          .eq("idempotency_key", currentKey)
          .select("idempotency_key")
          .maybeSingle();
        if (claimError || !claimedKey) {
          failures.push({ outlet_id: outletId, error: "CHECKOUT_RETRY_CONFLICT" });
          continue;
        }

        const payload = {
          title: `NORTAGO Order — ${invoice.plan_code}`,
          description: `Langganan NORTAGO Order outlet ${invoice.outlet_id} · invoice ${invoiceNo}`,
          amount,
          reference_id: invoiceNo,
          customer: {
            name: typeof body.customer_name === "string" ? body.customer_name.slice(0, 120) : "Pemilik Bisnis",
            email: typeof body.customer_email === "string" ? body.customer_email.slice(0, 160) : undefined,
            phone: typeof body.customer_phone === "string"
              ? body.customer_phone.replace(/[^0-9+]/g, "").slice(0, 15)
              : undefined,
          },
          return_url: `${appUrl}/otc/owner/subscriptions?invoice=${encodeURIComponent(invoiceNo)}`,
          metadata: {
            source: "NORTAGO_ORDER_SUBSCRIPTION",
            invoice_id: invoice.invoice_id,
            subscription_id: invoice.subscription_id,
            outlet_id: invoice.outlet_id,
            business_id: invoice.business_id,
          },
        };
        if (!payload.customer.email) delete payload.customer.email;
        if (!payload.customer.phone) delete payload.customer.phone;

        const providerResponse = await fetch("https://api.orderhero.id/v1/payment-requests", {
          method: "POST",
          headers: {
            ...headers,
            "Content-Type": "application/json",
            "Idempotency-Key": nextKey,
          },
          body: JSON.stringify(payload),
          cache: "no-store",
        });
        const providerBody = await providerResponse.json().catch(() => ({}));
        if (providerResponse.ok && providerBody.ok === true) {
          paymentRequest = providerBody.data?.payment_request || providerBody.data;
        } else if (providerBody.error === "REFERENCE_ID_EXISTS"
          || providerBody.error === "IDEMPOTENCY_OUTCOME_UNKNOWN") {
          const recoveryResponse = await fetch(paymentUrl, { headers, cache: "no-store" });
          const recoveryBody = await recoveryResponse.json().catch(() => ({}));
          if (recoveryResponse.ok && recoveryBody.ok === true) {
            paymentRequest = recoveryBody.data?.payment_request || recoveryBody.data;
          } else {
            failures.push({ outlet_id: outletId, error: recoveryBody.error || providerBody.error });
            continue;
          }
        } else {
          failures.push({ outlet_id: outletId, error: providerBody.error || "ORDERHERO_REQUEST_FAILED" });
          continue;
        }
      }

      if (paymentRequest?.status !== "open") {
        failures.push({
          outlet_id: outletId,
          error: `ORDERHERO_PAYMENT_NOT_OPEN_${String(paymentRequest?.status || "UNKNOWN").toUpperCase()}`,
        });
        continue;
      }
      if (!paymentRequest?.url
        || paymentRequest.reference_id !== invoiceNo
        || Number(paymentRequest.amount) !== amount
        || paymentRequest.currency !== "IDR") {
        failures.push({ outlet_id: outletId, error: "ORDERHERO_RESPONSE_INVALID_OR_MISMATCHED" });
        continue;
      }

      const { error: saveError } = await admin.from("subscription_payments")
        .update({
          provider_reference: String(paymentRequest.reference_id),
          provider_payload: paymentRequest,
        })
        .eq("id", invoice.payment_id)
        .eq("invoice_id", invoice.invoice_id);
      if (saveError) {
        failures.push({ outlet_id: outletId, error: "PAYMENT_REFERENCE_SAVE_FAILED" });
        continue;
      }
      payments.push({
        outlet_id: outletId,
        invoice_no: invoiceNo,
        amount_idr: amount,
        payment_url: paymentRequest.url,
        expires_at: paymentRequest.expires_at || null,
      });
    }

    if (!payments.length) return json({ error: "NO_PAYMENT_LINK_CREATED", failures }, 502);
    return json({ ok: true, payments, failures }, failures.length ? 207 : 201);
  } catch (error) {
    return json({
      error: "SUBSCRIPTION_CHECKOUT_FAILED",
      message: error instanceof Error ? error.message : "Unexpected error",
    }, 500);
  }
}
