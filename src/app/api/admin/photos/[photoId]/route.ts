import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { requireOwnerApi } from "@/lib/auth";
import { getStorage } from "@/lib/storage";

export async function DELETE(_req: Request, ctx: { params: Promise<{ photoId: string }> }) {
  const denied = await requireOwnerApi();
  if (denied) return denied;
  const id = Number((await ctx.params).photoId);
  const [img] = await db.select().from(s.productImages).where(eq(s.productImages.id, id));
  if (!img) return Response.json({ ok: false, error: "That photo was already removed." }, { status: 404 });
  await db.delete(s.productImages).where(eq(s.productImages.id, id));
  const rest = await db
    .select()
    .from(s.productImages)
    .where(eq(s.productImages.productId, img.productId))
    .orderBy(asc(s.productImages.position), asc(s.productImages.id));
  for (let i = 0; i < rest.length; i++) await db.update(s.productImages).set({ position: i }).where(eq(s.productImages.id, rest[i].id));
  try {
    const storage = getStorage();
    await Promise.all([storage.remove(img.url), storage.remove(img.thumbUrl), storage.remove(img.originalUrl)]);
  } catch {
    /* best effort */
  }
  // A published product must keep at least one photo.
  let unpublished = false;
  if (rest.length === 0) {
    const [p] = await db.select({ status: s.products.status }).from(s.products).where(eq(s.products.id, img.productId));
    if (p?.status === "published") {
      await db.update(s.products).set({ status: "draft" }).where(eq(s.products.id, img.productId));
      unpublished = true;
    }
  }
  return Response.json({ ok: true, images: rest.map((r, i) => ({ ...r, position: i })), unpublished });
}
