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
    const outletId = typeof body.outlet_id === "string" ? body.outlet_id : "";
    const planCode = body.plan_code === "NORTAGO_OUTLET_YEARLY"
      ? "NORTAGO_OUTLET_YEARLY" : body.plan_code === "NORTAGO_OUTLET_MONTHLY"
      ? "NORTAGO_OUTLET_MONTHLY" : "";
    if (!businessId || !outletId || !planCode) return json({ error: "INVALID_REQUEST" }, 400);

    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userResult, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userResult.user) return json({ error: "INVALID_SESSION" }, 401);

    const { data: invoice, error: invoiceError } = await userClient.rpc("nortago_prepare_subscription_invoice", {
      p_business_id: businessId,
      p_outlet_id: outletId,
      p_plan_code: planCode,
    });
    if (invoiceError || !invoice) {
      const message = invoiceError?.message || "INVOICE_PREPARATION_FAILED";
      const status = /FORBIDDEN/.test(message) ? 403 : /AUTH_REQUIRED/.test(message) ? 401 : 400;
      return json({ error: "INVOICE_PREPARATION_FAILED", message }, status);
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const payload = {
      title: `NORTAGO Order — ${invoice.plan_code}`,
      description: `Langganan NORTAGO Order outlet ${invoice.outlet_id} · invoice ${invoice.invoice_no}`,
      amount: Number(invoice.amount_idr),
      reference_id: invoice.invoice_no,
      customer: {
        name: typeof body.customer_name === "string" ? body.customer_name.slice(0, 120) : "Pemilik Bisnis",
        email: typeof body.customer_email === "string" ? body.customer_email.slice(0, 160) : undefined,
        phone: typeof body.customer_phone === "string" ? body.customer_phone.replace(/[^0-9+]/g, "").slice(0, 15) : undefined,
      },
      return_url: `${appUrl}/otc/owner/subscriptions?invoice=${encodeURIComponent(invoice.invoice_no)}`,
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
        Authorization: `Bearer ${orderHeroKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": String(invoice.invoice_no).slice(0, 128),
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    const providerBody = await providerResponse.json().catch(() => ({}));
    if (!providerResponse.ok || providerBody.ok !== true) {
      const providerError = providerBody.error || "ORDERHERO_REQUEST_FAILED";
      return json({ error: providerError, message: providerBody.message || "OrderHero tidak dapat membuat tagihan." }, providerResponse.status || 502);
    }
    const paymentRequest = providerBody.data?.payment_request || providerBody.data;
    if (!paymentRequest?.url || !paymentRequest?.reference_id) {
      return json({ error: "ORDERHERO_RESPONSE_INVALID" }, 502);
    }

    const { error: saveError } = await admin.from("subscription_payments")
      .update({
        provider_reference: String(paymentRequest.reference_id),
        provider_payload: paymentRequest,
      })
      .eq("id", invoice.payment_id)
      .eq("invoice_id", invoice.invoice_id);
    if (saveError) return json({ error: "PAYMENT_REFERENCE_SAVE_FAILED" }, 500);

    return json({
      ok: true,
      invoice_no: invoice.invoice_no,
      amount_idr: invoice.amount_idr,
      currency: "IDR",
      payment_url: paymentRequest.url,
      expires_at: paymentRequest.expires_at || null,
    }, 201);
  } catch (error) {
    return json({ error: "SUBSCRIPTION_CHECKOUT_FAILED", message: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
}
