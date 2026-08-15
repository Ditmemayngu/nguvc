type JsonRecord = Record<string, unknown>;
type Product = JsonRecord & { id: number; name: string; kind?: string; price?: number; stock?: number };

const baseUrl = () => (process.env.ACCSTACK_BASE_URL || "https://accstack.io/api/v1").replace(/\/$/, "");

async function get(path: string, query?: Record<string, string | number>) {
  const apiKey = process.env.ACCSTACK_API_KEY?.trim();
  if (!apiKey) throw new Error("ACCSTACK_API_KEY chưa được cấu hình trên máy chủ");
  const url = new URL(`${baseUrl()}/${path.replace(/^\//, "")}`);
  Object.entries(query || {}).forEach(([key, value]) => url.searchParams.set(key, String(value)));
  const response = await fetch(url, {
    method: "GET",
    headers: { "X-API-Key": apiKey, Accept: "application/json", "User-Agent": "GmailOtpWeb/1.0" },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({})) as JsonRecord;
  if (!response.ok || !["success", "ok"].includes(String(payload.status || "success").toLowerCase())) {
    throw new Error(String(payload.message || payload.error || `API trả về lỗi ${response.status}`));
  }
  return payload;
}

function normalize(value: unknown) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

export async function selectedProduct() {
  const payload = await get("products");
  const products = Array.isArray(payload.products) ? payload.products.filter((item): item is Product => Boolean(item && typeof item === "object")) : [];
  const configuredId = process.env.ACCSTACK_PRODUCT_ID?.trim();
  if (configuredId) {
    const byId = products.find((item) => String(item.id) === configuredId);
    if (byId) return byId;
    throw new Error(`Không tìm thấy PRODUCT_ID ${configuredId}`);
  }
  const target = normalize(process.env.ACCSTACK_PRODUCT_NAME || "Gmail ChatGPT");
  const exact = products.find((item) => normalize(item.name) === target);
  if (exact) return exact;
  const tokens = target.split(" ");
  const fallback = products.find((item) => {
    const name = normalize(item.name);
    return normalize(item.kind) === "rent" && tokens.every((token) => name.includes(token));
  });
  if (!fallback) throw new Error("Không tìm thấy sản phẩm Gmail ChatGPT; hãy cấu hình ACCSTACK_PRODUCT_ID");
  return fallback;
}

export async function rentMail() {
  const product = await selectedProduct();
  return get("mail", { product_id: product.id });
}

export async function getCode(order: string) {
  return get("code", { order });
}

export async function rerentMail(order: string) {
  return get("rerent", { order });
}

export function validOrder(value: unknown) {
  const order = String(value || "").trim();
  if (!/^[A-Za-z0-9_-]{3,80}$/.test(order)) throw new Error("Mã đơn không hợp lệ");
  return order;
}
