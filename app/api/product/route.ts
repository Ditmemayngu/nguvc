import { requireSession } from "@/app/lib/auth";
import { selectedProduct } from "@/app/lib/accstack";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const unauthorized = await requireSession(request);
  if (unauthorized) return unauthorized;
  try {
    const product = await selectedProduct();
    return Response.json({ product: { id: product.id, name: product.name, price: product.price, stock: product.stock } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Không lấy được sản phẩm" }, { status: 502 });
  }
}
