import { z } from "zod";
import { SLUG_PATTERN } from "@/lib/slug";
import { parseDollarsToCents } from "@/lib/money";
import { departments } from "@/config/settings";

/** What the owner form submits. Everything the owner types arrives as text and is checked here. */
export const optionValueSchema = z.object({
  id: z.number().int().positive().optional(),
  value: z.string().trim().min(1, "Enter a value, for example “Black”.").max(40, "Keep the value under 40 characters."),
  adjust: z.string().trim().default("0"),
  stock: z.string().trim().default("0"),
});

export const optionSchema = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().trim().min(1, "Name the option, for example “Size”.").max(40, "Keep the name under 40 characters."),
  required: z.boolean(),
  defaultValue: z.string().trim().nullable(),
  tracksStock: z.boolean(),
  values: z.array(optionValueSchema).min(1, "Add at least one value."),
});

export const productInputSchema = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().trim().min(1, "Enter a product name.").max(80, "The name can be 80 characters at most."),
  slug: z.string().trim().max(80, "The web address can be 80 characters at most."),
  tagline: z.string().trim().max(100, "Keep the tagline under 100 characters."),
  brandId: z.number().int().positive().nullable(),
  categoryId: z.number().int({ message: "Choose a category." }).positive({ message: "Choose a category." }),
  department: z.enum(departments),
  description: z.string().trim().max(2000, "The description can be 2000 characters at most."),
  price: z.string().trim().min(1, "Enter a price."),
  compareAt: z.string().trim(),
  stock: z.string().trim(),
  personalizable: z.boolean(),
  personalizationLabel: z.string().trim().max(40, "Keep the label under 40 characters."),
  personalizationMaxLength: z.string().trim(),
  materialsCare: z.string().max(2000, "Keep this under 2000 characters."),
  specifications: z.string().max(2000, "Keep this under 2000 characters."),
  collectionIds: z.array(z.number().int().positive()),
  options: z.array(optionSchema).max(5, "A product can have up to 5 options."),
});

export type ProductInput = z.infer<typeof productInputSchema>;

export type ParsedProduct = {
  id?: number;
  name: string;
  slug: string;
  tagline: string;
  brandId: number | null;
  categoryId: number;
  department: (typeof departments)[number];
  description: string;
  priceCents: number;
  compareAtCents: number | null;
  stock: number;
  personalizable: boolean;
  personalizationLabel: string;
  personalizationMaxLength: number;
  materialsCare: string[];
  specifications: { label: string; value: string }[];
  collectionIds: number[];
  options: {
    id?: number;
    name: string;
    required: boolean;
    defaultValue: string | null;
    tracksStock: boolean;
    values: { id?: number; value: string; priceAdjustCents: number; stock: number }[];
  }[];
};

export type FieldErrors = Record<string, string>;

export function lines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

/** Validates the raw form and converts it to typed values. Returns field errors keyed by field path. */
export function parseProductInput(raw: unknown): { ok: true; data: ParsedProduct } | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {};
  const parsed = productInputSchema.safeParse(raw);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".") || "form";
      if (!errors[key]) errors[key] = issue.message;
    }
    // Still try to continue below with what we can read, so every problem is shown at once.
  }
  const input = (parsed.success ? parsed.data : (raw as ProductInput)) as ProductInput;
  if (!input || typeof input !== "object") return { ok: false, errors: { form: "Something was wrong with the form." } };

  const priceCents = parseDollarsToCents(input.price ?? "");
  if (priceCents === null) errors.price ??= "Enter a price in dollars with at most two decimals, for example 48.00.";
  else if (priceCents <= 0) errors.price = "The price must be greater than $0.";
  else if (priceCents > 10_000_000) errors.price = "That price is too large.";

  let compareAtCents: number | null = null;
  if (input.compareAt) {
    const c = parseDollarsToCents(input.compareAt);
    if (c === null || c <= 0) errors.compareAt = "Enter the original price in dollars, for example 640.00, or leave it empty.";
    else if (priceCents !== null && c <= priceCents) errors.compareAt = "The original price should be higher than the price.";
    else compareAtCents = c;
  }

  const options = Array.isArray(input.options) ? input.options : [];
  const tracked = options.filter((o) => o.tracksStock).length;
  if (tracked > 1) errors["options.0.tracksStock"] = "Only one option can have its own stock per value.";

  let stock = 0;
  const stockIsDerived = tracked > 0;
  if (!stockIsDerived) {
    if (!/^\d+$/.test(input.stock ?? "")) errors.stock = "Enter the stock as a whole number, 0 or more.";
    else stock = Number(input.stock);
  }

  let maxLen = 12;
  if (input.personalizable) {
    if (!/^\d+$/.test(input.personalizationMaxLength ?? "") || Number(input.personalizationMaxLength) < 1 || Number(input.personalizationMaxLength) > 40) {
      errors.personalizationMaxLength = "Enter a character limit between 1 and 40.";
    } else maxLen = Number(input.personalizationMaxLength);
    if (!input.personalizationLabel) errors.personalizationLabel = "Enter a label for the field, for example “Monogram”.";
  }

  const outOptions: ParsedProduct["options"] = [];
  const seenNames = new Set<string>();
  options.forEach((o, oi) => {
    const nameKey = o.name?.trim().toLowerCase();
    if (nameKey && seenNames.has(nameKey)) errors[`options.${oi}.name`] = "Two options have the same name.";
    if (nameKey) seenNames.add(nameKey);
    const seenValues = new Set<string>();
    const vals: ParsedProduct["options"][number]["values"] = [];
    (o.values ?? []).forEach((v, vi) => {
      const vk = v.value?.trim().toLowerCase();
      if (vk && seenValues.has(vk)) errors[`options.${oi}.values.${vi}.value`] = "This value is listed twice.";
      if (vk) seenValues.add(vk);
      const adjust = parseDollarsToCents(v.adjust ?? "0");
      if (adjust === null) errors[`options.${oi}.values.${vi}.adjust`] = "Enter a price change in dollars, for example 40 or -10.";
      else if (priceCents !== null && priceCents > 0 && priceCents + adjust <= 0)
        errors[`options.${oi}.values.${vi}.adjust`] = "With this change the price would be $0 or less.";
      let vstock = 0;
      if (o.tracksStock) {
        if (!/^\d+$/.test(v.stock ?? "")) errors[`options.${oi}.values.${vi}.stock`] = "Enter stock as a whole number, 0 or more.";
        else vstock = Number(v.stock);
      }
      vals.push({ id: v.id, value: v.value?.trim() ?? "", priceAdjustCents: adjust ?? 0, stock: vstock });
    });
    if (o.defaultValue && !vals.some((v) => v.value === o.defaultValue)) {
      errors[`options.${oi}.defaultValue`] = "The default must be one of the values.";
    }
    outOptions.push({
      id: o.id,
      name: o.name?.trim() ?? "",
      required: !!o.required,
      defaultValue: o.defaultValue ? o.defaultValue : null,
      tracksStock: !!o.tracksStock,
      values: vals,
    });
  });

  const specs: { label: string; value: string }[] = [];
  lines(input.specifications ?? "").forEach((l, i) => {
    const idx = l.indexOf(":");
    if (idx < 1 || idx === l.length - 1) errors.specifications ??= `Line ${i + 1} should look like “Label: value”.`;
    else specs.push({ label: l.slice(0, idx).trim(), value: l.slice(idx + 1).trim() });
  });

  const slug = input.slug || "";
  if (slug && !SLUG_PATTERN.test(slug)) errors.slug ??= "Use lowercase letters, numbers and hyphens only, for example “linen-dress”.";

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const derived = outOptions.filter((o) => o.tracksStock).flatMap((o) => o.values).reduce((a, v) => a + v.stock, 0);

  return {
    ok: true,
    data: {
      id: input.id,
      name: input.name,
      slug,
      tagline: input.tagline,
      brandId: input.brandId,
      categoryId: input.categoryId,
      department: input.department,
      description: input.description,
      priceCents: priceCents!,
      compareAtCents,
      stock: stockIsDerived ? derived : stock,
      personalizable: input.personalizable,
      personalizationLabel: input.personalizationLabel || "Monogram",
      personalizationMaxLength: maxLen,
      materialsCare: lines(input.materialsCare ?? ""),
      specifications: specs,
      collectionIds: [...new Set(input.collectionIds ?? [])],
      options: outOptions,
    },
  };
}
