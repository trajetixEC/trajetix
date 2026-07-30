import spec from "../../openapi.json";

export function GET() { return Response.json(spec); }
