"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Star, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { settings } from "@/config/settings";

export type PhotoDTO = {
  id: number;
  url: string;
  thumbUrl: string;
  alt: string;
  width: number;
  height: number;
  resized: boolean;
};

type Upload = { key: string; file: File; progress: number; status: "uploading" | "failed"; error?: string };

export function PhotoManager({
  productId,
  productName,
  initial,
  storage,
  onChange,
}: {
  productId: number;
  productName: string;
  initial: PhotoDTO[];
  storage: { ok: boolean; message: string };
  onChange: (photos: PhotoDTO[], unpublished?: boolean) => void;
}) {
  const [photos, setPhotos] = useState<PhotoDTO[]>(initial);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const photosRef = useRef(photos);
  photosRef.current = photos;

  useEffect(() => onChange(photos), [photos.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const room = settings.photos.maxPerProduct - photos.length;

  function send(file: File, key: string) {
    return new Promise<void>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `/api/admin/products/${productId}/photos`);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          setUploads((u) => u.map((x) => (x.key === key ? { ...x, progress: Math.round((e.loaded / e.total) * 100) } : x)));
        }
      };
      const fail = (message: string) => {
        setUploads((u) => u.map((x) => (x.key === key ? { ...x, status: "failed", error: message } : x)));
        resolve();
      };
      xhr.onerror = () => fail("The upload failed (the connection dropped). Your other changes are safe. Try again.");
      xhr.onload = () => {
        let body: { ok?: boolean; error?: string; image?: PhotoDTO; warnings?: string[] } = {};
        try {
          body = JSON.parse(xhr.responseText);
        } catch {
          /* not JSON */
        }
        if (xhr.status >= 200 && xhr.status < 300 && body.ok && body.image) {
          const image = body.image;
          setPhotos((p) => [...p, image]);
          setUploads((u) => u.filter((x) => x.key !== key));
          if (body.warnings?.length) setNotes((n) => [...n, ...body.warnings!]);
          setStatus(`Uploaded ${file.name}.`);
          resolve();
        } else if (xhr.status === 401) {
          fail("Your session ended. Sign in again, then retry.");
        } else {
          fail(body.error ?? "The upload failed. Please try again.");
        }
      };
      const data = new FormData();
      data.append("file", file);
      xhr.send(data);
    });
  }

  async function startUploads(files: File[]) {
    setError(null);
    const limited = files.slice(0, Math.max(0, room));
    if (files.length > limited.length) {
      setError(
        `Only ${settings.photos.maxPerProduct} photos are allowed per product. ${files.length - limited.length} file(s) were not added.`,
      );
    }
    const items: Upload[] = limited.map((file) => ({
      key: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 7)}`,
      file,
      progress: 0,
      status: "uploading",
    }));
    setUploads((u) => [...u, ...items]);
    // One at a time keeps the order predictable and progress readable.
    for (const it of items) await send(it.file, it.key);
  }

  async function retry(u: Upload) {
    setUploads((list) => list.map((x) => (x.key === u.key ? { ...x, status: "uploading", progress: 0, error: undefined } : x)));
    await send(u.file, u.key);
  }

  async function persist(next: PhotoDTO[]) {
    setPhotos(next);
    setStatus("Saving photo order…");
    const res = await fetch(`/api/admin/products/${productId}/photos`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ photos: next.map((p) => ({ id: p.id, alt: p.alt })) }),
    });
    if (!res.ok) {
      setError("We couldn't save the photo changes. Please try again.");
      setStatus("");
    } else {
      setStatus("Photo changes saved.");
      setError(null);
    }
  }

  function move(index: number, delta: number) {
    const next = [...photosRef.current];
    const j = index + delta;
    if (j < 0 || j >= next.length) return;
    [next[index], next[j]] = [next[j], next[index]];
    void persist(next);
  }

  async function remove(p: PhotoDTO) {
    if (!window.confirm("Remove this photo? This can't be undone.")) return;
    const res = await fetch(`/api/admin/photos/${p.id}`, { method: "DELETE" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "We couldn't remove that photo.");
      return;
    }
    setPhotos(body.images as PhotoDTO[]);
    setStatus("Photo removed.");
    if (body.unpublished) onChange(body.images, true);
  }

  return (
    <section aria-labelledby="photos-heading" className="border bg-white p-5" data-testid="photo-manager">
      <h2 id="photos-heading" className="text-xl">
        Photos <span className="text-base text-muted-foreground">({photos.length} of {settings.photos.maxPerProduct})</span>
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        The first photo is the cover shoppers see on cards. JPEG, PNG or WebP, up to 5 MB each. Wider than {settings.photos.softWidth} pixels looks best.
      </p>

      {!storage.ok && (
        <p role="alert" data-testid="storage-warning" className="mt-3 border border-destructive bg-[#fbeceb] p-3 text-sm">
          {storage.message}
        </p>
      )}

      <p className="visually-hidden" role="status" aria-live="polite">{status}</p>
      {error && (
        <p role="alert" data-testid="photo-error" className="mt-3 text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      {notes.length > 0 && (
        <ul className="mt-3 space-y-1 border-l-4 border-[#c79a00] bg-[#fdf6dd] p-3 text-sm" data-testid="photo-notes">
          {notes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      )}

      <ul className="mt-4 space-y-3" data-testid="photo-list">
        {photos.map((p, i) => (
          <li key={p.id} className="flex flex-wrap items-start gap-3 border p-3" data-testid="photo-item">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.thumbUrl} alt={p.alt || productName} className="h-24 w-[4.5rem] shrink-0 object-cover" />
            <div className="min-w-48 flex-1">
              <p className="text-xs font-medium uppercase tracking-wider">
                {i === 0 ? <span className="text-primary" data-testid="cover-badge">Cover photo</span> : `Photo ${i + 1}`}
                <span className="ml-2 font-normal normal-case text-muted-foreground">{p.width} × {p.height}px</span>
              </p>
              <label htmlFor={`alt-${p.id}`} className="mt-1 block text-xs">Alt text (describes the photo for people who can&apos;t see it)</label>
              <input
                id={`alt-${p.id}`}
                defaultValue={p.alt}
                maxLength={200}
                className="mt-0.5 h-9 w-full border border-[#8a847c] px-2 text-sm"
                onBlur={(e) => {
                  const value = e.target.value.trim() || productName;
                  if (value !== p.alt) void persist(photosRef.current.map((x) => (x.id === p.id ? { ...x, alt: value } : x)));
                }}
              />
              {p.width < settings.photos.softWidth && (
                <p className="mt-1 text-xs text-[#6b4a00]">This photo is under {settings.photos.softWidth}px wide and may look soft.</p>
              )}
              {p.resized && <p className="mt-1 text-xs text-muted-foreground">Resized for the web; the original is kept.</p>}
            </div>
            <div className="flex gap-1">
              <button type="button" className="p-2 hover:bg-muted disabled:opacity-30 cursor-pointer" aria-label={`Move photo ${i + 1} up`} disabled={i === 0} onClick={() => move(i, -1)}>
                <ArrowUp className="h-4 w-4" aria-hidden="true" />
              </button>
              <button type="button" className="p-2 hover:bg-muted disabled:opacity-30 cursor-pointer" aria-label={`Move photo ${i + 1} down`} disabled={i === photos.length - 1} onClick={() => move(i, 1)}>
                <ArrowDown className="h-4 w-4" aria-hidden="true" />
              </button>
              {i !== 0 && (
                <button type="button" className="p-2 hover:bg-muted cursor-pointer" aria-label={`Make photo ${i + 1} the cover`} data-testid="make-cover" onClick={() => move(i, -i)}>
                  <Star className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
              <button type="button" className="p-2 text-destructive hover:bg-muted cursor-pointer" aria-label={`Remove photo ${i + 1}`} data-testid="remove-photo" onClick={() => remove(p)}>
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </li>
        ))}
        {uploads.map((u) => (
          <li key={u.key} className="border p-3 text-sm" data-testid="upload-item">
            <p className="font-medium">{u.file.name}</p>
            {u.status === "uploading" ? (
              <>
                <progress value={u.progress} max={100} className="mt-1 h-2 w-full" aria-label={`Uploading ${u.file.name}`} />
                <p className="text-xs text-muted-foreground">Uploading… {u.progress}%</p>
              </>
            ) : (
              <div role="alert" className="mt-1 text-destructive" data-testid="upload-failed">
                <p>{u.error}</p>
                <div className="mt-2 flex gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => retry(u)}>Retry</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setUploads((l) => l.filter((x) => x.key !== u.key))}>Dismiss</Button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-4">
        <input
          ref={inputRef}
          id="photo-input"
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          className="visually-hidden"
          data-testid="photo-input"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            if (files.length) void startUploads(files);
          }}
        />
        <Button type="button" variant="outline" disabled={room <= 0 || !storage.ok} onClick={() => inputRef.current?.click()}>
          <Upload className="h-4 w-4" aria-hidden="true" />
          {room <= 0 ? "Photo limit reached" : "Upload photos"}
        </Button>
      </div>
    </section>
  );
}
