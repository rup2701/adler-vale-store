import { z } from "zod";
import { settings } from "@/config/settings";

export const customerSchema = z.object({
  name: z.string().trim().min(1, "Enter your full name.").max(100, "Keep your name under 100 characters."),
  email: z
    .string()
    .trim()
    .min(1, "Enter your email address.")
    .max(200, "That email address is too long.")
    .regex(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, "Enter a valid email address, like name@example.com."),
  address1: z.string().trim().max(120),
  address2: z.string().trim().max(120),
  city: z.string().trim().max(80),
  state: z.string().trim().max(60),
  postalCode: z.string().trim().max(12),
  country: z.string().trim(),
});

export type CustomerInput = z.infer<typeof customerSchema>;

export const lineSchema = z.object({
  productId: z.number().int().positive(),
  slug: z.string().max(120).default(""),
  optionValueIds: z.array(z.number().int().positive()).max(10),
  personalization: z.string().max(100),
  quantity: z.number().int(),
  seenUnitPriceCents: z.number().int().min(0),
});

export const checkoutSchema = z.object({
  token: z.string().min(16).max(80),
  fulfilment: z.enum(["ship", "pickup"]),
  storeId: z.number().int().positive().nullable().optional(),
  customer: customerSchema,
  lines: z.array(lineSchema).max(50),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

export type FieldErrors = Partial<Record<keyof CustomerInput | "storeId", string>>;

/** Checks the parts of the form that depend on ship vs pickup. Shared by the browser and the server. */
export function validateCustomer(customer: CustomerInput, fulfilment: "ship" | "pickup", storeId: number | null | undefined): FieldErrors {
  const errors: FieldErrors = {};
  const base = customerSchema.safeParse(customer);
  if (!base.success) {
    for (const issue of base.error.issues) {
      const k = issue.path[0] as keyof CustomerInput;
      errors[k] ??= issue.message;
    }
  }
  if (fulfilment === "ship") {
    if (!customer.address1.trim()) errors.address1 = "Enter your street address.";
    if (!customer.city.trim()) errors.city = "Enter your city.";
    if (!customer.state.trim()) errors.state = "Enter your state or region.";
    if (!customer.postalCode.trim()) errors.postalCode = "Enter your ZIP or postal code.";
    else if (!/^\d{5}(-\d{4})?$/.test(customer.postalCode.trim()))
      errors.postalCode = "Enter a US ZIP code with 5 digits, like 95030.";
    if (!(settings.orders.countries as readonly string[]).includes(customer.country))
      errors.country = "Choose a country from the list. We currently ship within the United States only.";
  } else if (!storeId) {
    errors.storeId = "Choose the store where you will pick up your order.";
  }
  return errors;
}
