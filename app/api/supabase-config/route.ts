import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return NextResponse.json(
      { error: "Supabase runtime configuration is missing." },
      { status: 503 }
    );
  }

  return NextResponse.json(
    { url, key },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
