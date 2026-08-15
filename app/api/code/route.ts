import { requireSession } from "@/app/lib/auth";
import { getCode, validOrder } from "@/app/lib/accstack";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const unauthorized = await requireSession(request);
  if (unauthorized) return unauthorized;
  try {
    const order = validOrder(new URL(request.url).searchParams.get("order"));
    return Response.json(await getCode(order), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Không lấy được OTP" }, { status: 502 });
  }
}
