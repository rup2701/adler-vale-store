/**
 * Store settings: the one file with every store-specific constant, kept apart from template code.
 * Values the owner can change in the owner area (announcement, hero, logo, stores, which
 * collections show on home) live in the database; the values here are the defaults and the
 * rules that are not owner-editable.
 */
export const TEMPLATE_VERSION = "2.0.0";

export const settings = {
  templateVersion: TEMPLATE_VERSION,
  store: {
    name: "Alder & Vale",
    tagline: "Designer clothing and accessories, curated in Los Gatos.",
    town: "Los Gatos, California",
    brandWords: ["curated", "polished", "personal"],
    contactEmail: "hello@alderandvale.example",
    responseTime: "We reply within one business day (demo store: messages are not monitored).",
    hours: [
      { days: "Monday to Saturday", hours: "10am to 6pm" },
      { days: "Sunday", hours: "12pm to 5pm" },
    ],
  },
  /** Restrained accent chosen for a fashion boutique: deep bordeaux. Contrast on white is 9.9:1. */
  accent: "#6e2a3a",
  currency: "USD",
  orders: {
    maxQuantityPerLine: 10,
    shippingFlatCents: 1500,
    /** Shipping is free when the subtotal is strictly over this amount. */
    freeShippingOverCents: 50000,
    /** Demo estimate only, not a real tax calculation. */
    taxRate: 0.0875,
    countries: ["United States"],
    referencePrefix: "AV",
  },
  returnsWindowDays: 30,
  photos: {
    maxPerProduct: 8,
    maxBytes: 5 * 1024 * 1024,
    allowedTypes: ["image/jpeg", "image/png", "image/webp"],
    softWidth: 800,
    webWidth: 1600,
    thumbWidth: 640,
  },
  personalization: {
    defaultMaxLength: 12,
    charsetHint: "letters, numbers, spaces and & . , ' -",
  },
  sizes: ["0", "2", "4", "6", "8", "10"],
  paymentMethodsDemo: ["Visa", "Mastercard", "American Express", "Discover", "Apple Pay", "Google Pay"],
  defaults: {
    announcementEnabled: true,
    announcementMessages: [
      "New location: Santa Barbara",
      "Take 10% off sale items with code SAMPLE10",
    ],
    heroHeadline: "Considered pieces from designers we love",
    heroButtonLabel: "Shop new arrivals",
    heroButtonHref: "/collections/new-arrivals",
  },
  auth: {
    sessionDays: 7,
    maxFailedAttempts: 5,
    lockoutMinutes: 15,
    cookieName: "av_owner",
  },
} as const;

export const departments = ["women", "men"] as const;
export type Department = (typeof departments)[number];
