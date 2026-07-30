import spec from "../../openapi.json";

export const dynamic = "force-dynamic";

export function GET() { return Response.json(spec); }
