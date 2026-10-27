import sharp from "sharp";
import { randomBytes } from "node:crypto";
import { settings } from "@/config/settings";

export type ProcessedImage = {
  original: Buffer;
  originalExt: string;
  originalType: string;
  web: Buffer;
  thumb: Buffer;
  width: number;
  height: number;
  resized: boolean;
  soft: boolean;
};

export class ImageRejected extends Error {}

const EXT: Record<string, { ext: string; type: string }> = {
  jpeg: { ext: "jpg", type: "image/jpeg" },
  png: { ext: "png", type: "image/png" },
  webp: { ext: "webp", type: "image/webp" },
};

export function validateDeclared(name: string, type: string, size: number) {
  const label = name || "This file";
  if (!(settings.photos.allowedTypes as readonly string[]).includes(type)) {
    throw new ImageRejected(`${label} is not a JPEG, PNG or WebP image. Only JPEG, PNG and WebP photos can be uploaded.`);
  }
  if (size > settings.photos.maxBytes) {
    throw new ImageRejected(
      `${label} is ${(size / 1024 / 1024).toFixed(1)} MB. Photos can be 5 MB at most. Please resize or compress it and try again.`,
    );
  }
  if (size === 0) throw new ImageRejected(`${label} is empty.`);
}

export async function processImage(buf: Buffer, name: string): Promise<ProcessedImage> {
  let meta;
  try {
    meta = await sharp(buf).metadata();
  } catch {
    throw new ImageRejected(`${name || "This file"} could not be read as an image. Only JPEG, PNG and WebP photos can be uploaded.`);
  }
  const kind = meta.format ? EXT[meta.format] : undefined;
  if (!kind || !meta.width || !meta.height) {
    throw new ImageRejected(`${name || "This file"} is not a JPEG, PNG or WebP image. Only JPEG, PNG and WebP photos can be uploaded.`);
  }
  // Orientation can swap width and height.
  const swap = (meta.orientation ?? 1) >= 5;
  const width = swap ? meta.height : meta.width;
  const height = swap ? meta.width : meta.height;
  const resized = width > settings.photos.webWidth;
  const web = await sharp(buf)
    .rotate()
    .resize({ width: settings.photos.webWidth, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
  const thumb = await sharp(buf)
    .rotate()
    .resize({ width: settings.photos.thumbWidth, withoutEnlargement: true })
    .webp({ quality: 78 })
    .toBuffer();
  return {
    original: buf,
    originalExt: kind.ext,
    originalType: kind.type,
    web,
    thumb,
    width,
    height,
    resized,
    soft: width < settings.photos.softWidth,
  };
}

export function uploadKey(scope: string) {
  return `${scope}/${Date.now().toString(36)}-${randomBytes(4).toString("hex")}`;
}
