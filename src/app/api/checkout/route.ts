import { placeOrder } from "@/lib/checkout";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const result = await placeOrder(body);
  if (result.ok) return Response.json(result);
  const status =
    result.kind === "validation" ? 422 : result.kind === "issues" || result.kind === "price_changed" ? 409 : result.kind === "error" ? 500 : 400;
  return Response.json(result, { status });
}
