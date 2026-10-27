import { z } from "zod";
import { priceLines } from "@/lib/cart-pricing";
import { lineSchema } from "@/lib/checkout-schema";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = z.object({ lines: z.array(lineSchema).max(50) }).safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid cart." }, { status: 400 });
  try {
    const lines = await priceLines(parsed.data.lines);
    return Response.json({ lines });
  } catch (e) {
    console.error("[cart/price] failed", e);
    return Response.json({ error: "We couldn't refresh your cart right now. Your items are saved. Please try again." }, { status: 503 });
  }
}
