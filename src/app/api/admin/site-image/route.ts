import { requireOwnerApi } from "@/lib/auth";
import { ImageRejected, processImage, uploadKey, validateDeclared } from "@/lib/images";
import { getStorage, StorageNotConfiguredError } from "@/lib/storage";
import { getHomeSettings, saveSetting } from "@/lib/site-settings";

/** Upload the hero banner or the logo (multipart fields: kind = hero | logo, file). */
export async function POST(req: Request) {
  const denied = await requireOwnerApi();
  if (denied) return denied;
  let storage;
  try {
    storage = getStorage();
  } catch (e) {
    if (e instanceof StorageNotConfiguredError) return Response.json({ ok: false, error: e.message, code: "storage_not_configured" }, { status: 503 });
    throw e;
  }
  const form = await req.formData().catch(() => null);
  const kind = form?.get("kind");
  const file = form?.get("file");
  if ((kind !== "hero" && kind !== "logo") || !(file instanceof File)) {
    return Response.json({ ok: false, error: "No file was received." }, { status: 400 });
  }
  try {
    validateDeclared(file.name, file.type, file.size);
    const img = await processImage(Buffer.from(await file.arrayBuffer()), file.name);
    const base = uploadKey(`site/${kind}`);
    await storage.put(`${base}-original.${img.originalExt}`, img.original, img.originalType);
    const url = await storage.put(`${base}-web.webp`, img.web, "image/webp");
    const home = await getHomeSettings();
    const old = kind === "hero" ? home.heroImageUrl : home.logoUrl;
    const next = kind === "hero" ? { ...home, heroImageUrl: url } : { ...home, logoUrl: url };
    await saveSetting("home", next);
    if (old) await storage.remove(old);
    const warnings: string[] = [];
    if (kind === "hero" && img.width < 1600) warnings.push(`The banner is ${img.width} pixels wide. Wide screens look best with 1600 pixels or more.`);
    return Response.json({ ok: true, url, warnings });
  } catch (e) {
    if (e instanceof ImageRejected) return Response.json({ ok: false, error: e.message }, { status: 400 });
    console.error("[site image] failed", e);
    return Response.json({ ok: false, error: "The upload failed on our side. Nothing was changed. Please try again." }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const denied = await requireOwnerApi();
  if (denied) return denied;
  const kind = new URL(req.url).searchParams.get("kind");
  if (kind !== "hero" && kind !== "logo") return Response.json({ ok: false, error: "Unknown image." }, { status: 400 });
  const home = await getHomeSettings();
  const old = kind === "hero" ? home.heroImageUrl : home.logoUrl;
  await saveSetting("home", kind === "hero" ? { ...home, heroImageUrl: null } : { ...home, logoUrl: null });
  if (old) {
    try {
      await getStorage().remove(old);
    } catch {
      /* best effort */
    }
  }
  return Response.json({ ok: true });
}
