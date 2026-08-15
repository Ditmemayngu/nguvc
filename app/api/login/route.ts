import { sameOrigin, sessionCookie, verifyPassword } from "@/app/lib/auth";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Yêu cầu không hợp lệ" }, { status: 403 });
  try {
    const body = await request.json() as { password?: string };
    if (!(await verifyPassword(String(body.password || "")))) {
      return Response.json({ error: "Mật khẩu không đúng" }, { status: 401 });
    }
    return Response.json({ success: true }, { headers: { "Set-Cookie": await sessionCookie(request), "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Không thể đăng nhập" }, { status: 503 });
  }
}
