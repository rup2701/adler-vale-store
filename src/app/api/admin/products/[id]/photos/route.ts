import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import * as s from "@/db/schema";
import { requireOwnerApi } from "@/lib/auth";
import { settings } from "@/config/settings";
import { ImageRejected, processImage, uploadKey, validateDeclared } from "@/lib/images";
import { getStorage, StorageNotConfiguredError } from "@/lib/storage";

type Ctx = { params: Promise<{ id: string }> };

/** Upload one photo (multipart field "file"). Several files are sent as several requests so one bad file never blocks the rest. */
export async function POST(req: Request, ctx: Ctx) {
  const denied = await requireOwnerApi();
  if (denied) return denied;
  const { id: idParam } = await ctx.params;
  const productId = Number(idParam);
  if (!Number.isInteger(productId)) return Response.json({ ok: false, error: "Unknown product." }, { status: 404 });
  const [product] = await db.select({ id: s.products.id, name: s.products.name }).from(s.products).where(eq(s.products.id, productId));
  if (!product) return Response.json({ ok: false, error: "This product no longer exists." }, { status: 404 });

  let storage;
  try {
    storage = getStorage();
  } catch (e) {
    if (e instanceof StorageNotConfiguredError) return Response.json({ ok: false, error: e.message, code: "storage_not_configured" }, { status: 503 });
    throw e;
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return Response.json({ ok: false, error: "No file was received." }, { status: 400 });

  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(s.productImages).where(eq(s.productImages.productId, productId));
  if (n >= settings.photos.maxPerProduct) {
    return Response.json(
      { ok: false, error: `This product already has ${settings.photos.maxPerProduct} photos, the most allowed. Remove one to add another.` },
      { status: 400 },
    );
  }

  try {
    validateDeclared(file.name, file.type, file.size);
    const buf = Buffer.from(await file.arrayBuffer());
    const img = await processImage(buf, file.name);
    const base = uploadKey(`products/${productId}`);
    const [original, web, thumb] = await Promise.all([
      storage.put(`${base}-original.${img.originalExt}`, img.original, img.originalType),
      storage.put(`${base}-web.webp`, img.web, "image/webp"),
      storage.put(`${base}-thumb.webp`, img.thumb, "image/webp"),
    ]);
    const [row] = await db
      .insert(s.productImages)
      .values({
        productId,
        url: web,
        thumbUrl: thumb,
        originalUrl: original,
        alt: product.name,
        position: n,
        width: img.width,
        height: img.height,
        resized: img.resized,
      })
      .returning();
    const warnings: string[] = [];
    if (img.soft) warnings.push(`${file.name} is only ${img.width} pixels wide, so it may look soft on large screens. Photos at least ${settings.photos.softWidth} pixels wide look best.`);
    if (img.resized) warnings.push(`${file.name} was resized for the web (the original is kept). Shoppers get the faster version.`);
    return Response.json({ ok: true, image: row, warnings });
  } catch (e) {
    if (e instanceof ImageRejected) return Response.json({ ok: false, error: e.message }, { status: 400 });
    console.error("[photo upload] failed", e);
    return Response.json({ ok: false, error: "The upload failed on our side. Nothing was saved. Please try again." }, { status: 500 });
  }
}

const putSchema = z.object({
  photos: z.array(z.object({ id: z.number().int(), alt: z.string().trim().max(200) })).max(settings.photos.maxPerProduct),
});

/** Save the order (the first is the cover) and the alt text of every photo. */
export async function PUT(req: Request, ctx: Ctx) {
  const denied = await requireOwnerApi();
  if (denied) return denied;
  const productId = Number((await ctx.params).id);
  const [product] = await db.select({ name: s.products.name }).from(s.products).where(eq(s.products.id, productId));
  if (!product) return Response.json({ ok: false, error: "This product no longer exists." }, { status: 404 });
  const parsed = putSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: "That request could not be read." }, { status: 400 });
  await db.transaction(async (tx) => {
    for (let i = 0; i < parsed.data.photos.length; i++) {
      const p = parsed.data.photos[i];
      await tx
        .update(s.productImages)
        .set({ position: i, alt: p.alt || product.name })
        .where(and(eq(s.productImages.id, p.id), eq(s.productImages.productId, productId)));
    }
  });
  const rows = await db.select().from(s.productImages).where(eq(s.productImages.productId, productId)).orderBy(asc(s.productImages.position), asc(s.productImages.id));
  return Response.json({ ok: true, images: rows });
}
