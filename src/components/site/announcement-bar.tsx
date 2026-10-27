"use client";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function AnnouncementBar({ messages }: { messages: string[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = messages.length;

  useEffect(() => {
    if (count < 2 || paused) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % count), 5000);
    return () => window.clearInterval(id);
  }, [count, paused]);

  if (count === 0) return null;
  const current = messages[index % count];

  return (
    <div
      className="on-dark bg-foreground text-background"
      role="region"
      aria-label="Announcements"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="site-container flex min-h-9 items-center justify-center gap-3 py-1.5 text-center text-xs tracking-wide">
        {count > 1 && (
          <button
            type="button"
            className="p-1 hover:opacity-70 cursor-pointer"
            aria-label="Previous announcement"
            onClick={() => setIndex((i) => (i - 1 + count) % count)}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
        <p data-testid="announcement" aria-live="off" className="min-w-0">
          {current}
        </p>
        {count > 1 && (
          <button
            type="button"
            className="p-1 hover:opacity-70 cursor-pointer"
            aria-label="Next announcement"
            onClick={() => setIndex((i) => (i + 1) % count)}
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}
