/**
 * Liveness probe. Deliberately does not touch the database. `deploymentId` (Vercel only) tells an
 * open page whether a newer deployment is live (`src/lib/pwa/app-update.ts`); not a secret, every
 * asset URL carries it.
 */
export function GET() {
  return Response.json({
    status: "ok",
    time: new Date().toISOString(),
    deploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? null,
  });
}
