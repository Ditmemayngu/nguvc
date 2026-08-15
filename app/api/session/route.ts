import { hasValidSession } from "@/app/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return Response.json({ authenticated: await hasValidSession(request) }, { headers: { "Cache-Control": "no-store" } });
}
