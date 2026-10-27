import { cn } from "@/lib/utils";

/** Neutral stand-in shown until the owner uploads a photo. Decorative, so hidden from assistive tech. */
export function Placeholder({ className, label = "Photo coming soon" }: { className?: string; label?: string }) {
  return (
    <div
      aria-hidden="true"
      data-testid="photo-placeholder"
      className={cn("flex h-full w-full items-center justify-center bg-[#ebe7e1] text-[#6f6a64]", className)}
    >
      <span className="eyebrow px-2 text-center">{label}</span>
    </div>
  );
}
