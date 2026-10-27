import Link from "next/link";
import { Placeholder } from "@/components/shop/placeholder";
import { formatCentsExact } from "@/lib/money";
import type { PricedLine } from "@/lib/cart-types";

/** Product thumbnail, name, chosen options and personalization. Used on the cart, checkout and confirmation. */
export function LineSummary({ line, quantity }: { line: Pick<PricedLine, "name" | "brandName" | "imageUrl" | "imageAlt" | "options" | "personalization" | "slug">; quantity?: number }) {
  return (
    <div className="flex gap-3">
      <div className="h-24 w-[4.5rem] shrink-0 overflow-hidden bg-muted">
        {line.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={line.imageUrl} alt={line.imageAlt} className="h-full w-full object-cover" />
        ) : (
          <Placeholder label="" />
        )}
      </div>
      <div className="min-w-0 text-sm">
        {line.brandName && <p className="eyebrow text-[10px] text-muted-foreground">{line.brandName}</p>}
        <p className="font-medium">
          <Link href={`/products/${line.slug}`} className="hover:underline underline-offset-4">
            {line.name}
          </Link>
        </p>
        {line.options.length > 0 && (
          <ul className="text-muted-foreground" data-testid="line-options">
            {line.options.map((o) => (
              <li key={o.option}>
                {o.option}: {o.value}
              </li>
            ))}
          </ul>
        )}
        {line.personalization && (
          <p className="text-muted-foreground" data-testid="line-personalization">
            Personalization: “{line.personalization}”
          </p>
        )}
        {quantity != null && <p className="text-muted-foreground">Qty {quantity}</p>}
      </div>
    </div>
  );
}

export function money(cents: number) {
  return formatCentsExact(cents);
}
