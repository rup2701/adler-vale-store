import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { isDeployed, objectStorageConfigured } from "@/lib/env";

/** Small adapter so the rest of the app never knows where photos live. */
export interface StorageAdapter {
  readonly kind: "local" | "blob";
  put(key: string, data: Buffer, contentType: string): Promise<string>;
  remove(url: string): Promise<void>;
}

export const LOCAL_UPLOAD_DIR = path.join(process.cwd(), ".uploads");

const localAdapter: StorageAdapter = {
  kind: "local",
  async put(key, data) {
    const file = path.join(LOCAL_UPLOAD_DIR, key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, data);
    return `/uploads/${key}`;
  },
  async remove(url) {
    if (!url.startsWith("/uploads/")) return;
    const file = path.join(LOCAL_UPLOAD_DIR, url.slice("/uploads/".length));
    if (!file.startsWith(LOCAL_UPLOAD_DIR)) return;
    await unlink(file).catch(() => {});
  },
};

const blobAdapter: StorageAdapter = {
  kind: "blob",
  async put(key, data, contentType) {
    const { put } = await import("@vercel/blob");
    const res = await put(key, data, { access: "public", contentType, addRandomSuffix: false, allowOverwrite: true });
    return res.url;
  },
  async remove(url) {
    const { del } = await import("@vercel/blob");
    await del(url).catch(() => {});
  },
};

export class StorageNotConfiguredError extends Error {}

/** Deployed builds use object storage only. They refuse to fall back to the server's disk. */
export function getStorage(): StorageAdapter {
  if (objectStorageConfigured()) return blobAdapter;
  if (isDeployed()) {
    throw new StorageNotConfiguredError(
      "Photo storage is not set up yet. Connect Vercel Blob to this project (it adds BLOB_READ_WRITE_TOKEN) and redeploy, then try again.",
    );
  }
  return localAdapter;
}

export function storageStatus(): { ok: boolean; kind: string; message: string } {
  if (objectStorageConfigured()) return { ok: true, kind: "Vercel Blob", message: "Photos are stored in object storage." };
  if (isDeployed())
    return {
      ok: false,
      kind: "none",
      message: "Photo storage is not set up. Connect Vercel Blob to this project (BLOB_READ_WRITE_TOKEN) and redeploy.",
    };
  return { ok: true, kind: "Local disk (development)", message: "Photos are saved to the .uploads folder on this computer." };
}
