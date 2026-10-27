"use client";
import { useState } from "react";
import { Placeholder } from "@/components/shop/placeholder";
import { cn } from "@/lib/utils";

export type GalleryImage = { id: number; url: string; thumbUrl: string; alt: string; width: number; height: number };

export function ProductGallery({ images, name }: { images: GalleryImage[]; name: string }) {
  const [index, setIndex] = useState(0);
  if (images.length === 0) {
    return (
      <div className="aspect-[3/4] w-full" data-testid="gallery-placeholder">
        <Placeholder label="Photo coming soon" />
      </div>
    );
  }
  const current = images[Math.min(index, images.length - 1)];
  return (
    <div className="flex flex-col-reverse gap-2 md:flex-row" data-testid="gallery">
      {images.length > 1 && (
        <ul className="flex gap-2 md:w-20 md:flex-col" aria-label={`${name} photos`}>
          {images.map((img, i) => (
            <li key={img.id} className="w-16 shrink-0 md:w-full">
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Show photo ${i + 1} of ${images.length}`}
                aria-pressed={i === index}
                className={cn("block aspect-[3/4] w-full cursor-pointer overflow-hidden border-2", i === index ? "border-foreground" : "border-transparent")}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.thumbUrl} alt="" className="h-full w-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="relative aspect-[3/4] w-full flex-1 overflow-hidden bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={current.url} alt={current.alt} className="h-full w-full object-cover" data-testid="gallery-main" />
      </div>
    </div>
  );
}
