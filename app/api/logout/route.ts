import { clearSessionCookie, sameOrigin } from "@/app/lib/auth";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Yêu cầu không hợp lệ" }, { status: 403 });
  return Response.json({ success: true }, { headers: { "Set-Cookie": clearSessionCookie(request) } });
}
