const COOKIE_NAME = "gmail_otp_session";
const SESSION_SECONDS = 60 * 60 * 12;

function env(name: string) {
  return process.env[name]?.trim() || "";
}

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hmac(value: string) {
  const secret = env("SESSION_SECRET");
  if (!secret) throw new Error("SESSION_SECRET chưa được cấu hình");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toHex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
}

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let i = 0; i < left.length; i += 1) mismatch |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return mismatch === 0;
}

function readCookie(request: Request) {
  const cookieHeader = request.headers.get("cookie") || "";
  for (const item of cookieHeader.split(";")) {
    const [name, ...parts] = item.trim().split("=");
    if (name === COOKIE_NAME) return decodeURIComponent(parts.join("="));
  }
  return "";
}

export async function hasValidSession(request: Request) {
  if (request.headers.get("oai-authenticated-user-email")) return true;
  const token = readCookie(request);
  const [expiresRaw, signature] = token.split(".");
  const expires = Number(expiresRaw);
  if (!expires || !signature || expires <= Math.floor(Date.now() / 1000)) return false;
  try {
    return safeEqual(signature, await hmac(expiresRaw));
  } catch {
    return false;
  }
}

export async function verifyPassword(password: string) {
  const expected = env("APP_PASSWORD");
  if (!expected) throw new Error("APP_PASSWORD chưa được cấu hình");
  const encoder = new TextEncoder();
  const [left, right] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(password)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  return safeEqual(toHex(left), toHex(right));
}

export async function sessionCookie(request: Request) {
  const expires = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const token = `${expires}.${await hmac(String(expires))}`;
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_SECONDS}${secure}`;
}

export function clearSessionCookie(request: Request) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`;
}

export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  return origin === new URL(request.url).origin;
}

export async function requireSession(request: Request) {
  if (!(await hasValidSession(request))) {
    return Response.json({ error: "Phiên đăng nhập đã hết hạn" }, { status: 401 });
  }
  if (request.method !== "GET" && !sameOrigin(request)) {
    return Response.json({ error: "Yêu cầu không hợp lệ" }, { status: 403 });
  }
  return null;
}
