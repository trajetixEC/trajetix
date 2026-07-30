export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ status: "ok", service: "trajetix-web", timestamp: new Date().toISOString() });
}
