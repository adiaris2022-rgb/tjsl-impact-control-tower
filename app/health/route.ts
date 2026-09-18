export async function GET() {
  return Response.json({ status: "ok", app: "tjsl-impact-control-tower", env: process.env.TJSL_ENV ?? "unknown" });
}
