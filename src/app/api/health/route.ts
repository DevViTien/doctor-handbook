/** Liveness probe. Deliberately does not touch the database. */
export function GET() {
  return Response.json({ status: "ok", time: new Date().toISOString() });
}
