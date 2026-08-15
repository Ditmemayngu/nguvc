import { requireSession } from "@/app/lib/auth";
import { rerentMail, validOrder } from "@/app/lib/accstack";

export async function POST(request: Request) {
  const unauthorized = await requireSession(request);
  if (unauthorized) return unauthorized;
  try {
    const body = await request.json() as { order?: string };
    return Response.json(await rerentMail(validOrder(body.order)), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Không thuê lại được Gmail" }, { status: 502 });
  }
}
