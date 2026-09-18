export async function GET() {
  return Response.json({
    ok: true,
    service: 'tjsl-impact-control-tower',
    environment: process.env.TJSL_ENV || 'unknown',
    methodologyVersion: process.env.TJSL_SROI_METHOD_VERSION || 'unset'
  });
}