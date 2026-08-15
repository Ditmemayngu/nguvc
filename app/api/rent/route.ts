import { requireSession } from "@/app/lib/auth";
import { rentMail } from "@/app/lib/accstack";

export async function POST(request: Request) {
  const unauthorized = await requireSession(request);
  if (unauthorized) return unauthorized;
  try {
    return Response.json(await rentMail(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Không thuê được Gmail" }, { status: 502 });
  }
}
