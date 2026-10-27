import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  position: integer("position").notNull().default(0),
});

/** Old slugs of renamed categories, so old shopper URLs keep working. */
export const categoryAliases = pgTable("category_aliases", {
  slug: text("slug").primaryKey(),
  categoryId: integer("category_id")
    .notNull()
    .references(() => categories.id, { onDelete: "cascade" }),
});

export const brands = pgTable("brands", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description").notNull().default(""),
  position: integer("position").notNull().default(0),
});

export const collections = pgTable("collections", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description").notNull().default(""),
  showOnHome: boolean("show_on_home").notNull().default(false),
  homePosition: integer("home_position").notNull().default(0),
});

export const stores = pgTable("stores", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  phone: text("phone").notNull(),
  pickup: boolean("pickup").notNull().default(true),
  pickupReady: text("pickup_ready").notNull().default(""),
  note: text("note").notNull().default(""),
  position: integer("position").notNull().default(0),
});

export type SpecRow = { label: string; value: string };

export const products = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    tagline: text("tagline").notNull().default(""),
    brandId: integer("brand_id").references(() => brands.id, { onDelete: "restrict" }),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    department: text("department").notNull().default("women"),
    description: text("description").notNull().default(""),
    materialsCare: jsonb("materials_care").$type<string[]>().notNull().default([]),
    specifications: jsonb("specifications").$type<SpecRow[]>().notNull().default([]),
    priceCents: integer("price_cents").notNull(),
    compareAtCents: integer("compare_at_cents"),
    /** Whole-product stock. When an option tracks stock this is kept equal to the sum of its values' stock. */
    stock: integer("stock").notNull().default(0),
    status: text("status").notNull().default("draft"), // draft | published
    isSample: boolean("is_sample").notNull().default(false),
    personalizable: boolean("personalizable").notNull().default(false),
    personalizationLabel: text("personalization_label").notNull().default("Monogram"),
    personalizationMaxLength: integer("personalization_max_length").notNull().default(12),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("products_category_idx").on(t.categoryId), index("products_brand_idx").on(t.brandId)],
);

export const productCollections = pgTable(
  "product_collections",
  {
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    collectionId: integer("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.productId, t.collectionId] })],
);

export const productOptions = pgTable("product_options", {
  id: serial("id").primaryKey(),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  required: boolean("required").notNull().default(true),
  /** Text of the default value, or null when the shopper must choose. */
  defaultValue: text("default_value"),
  /** When true each value has its own stock (for example sizes). */
  tracksStock: boolean("tracks_stock").notNull().default(false),
  position: integer("position").notNull().default(0),
});

export const productOptionValues = pgTable("product_option_values", {
  id: serial("id").primaryKey(),
  optionId: integer("option_id")
    .notNull()
    .references(() => productOptions.id, { onDelete: "cascade" }),
  value: text("value").notNull(),
  priceAdjustCents: integer("price_adjust_cents").notNull().default(0),
  stock: integer("stock").notNull().default(0),
  position: integer("position").notNull().default(0),
});

export const productImages = pgTable("product_images", {
  id: serial("id").primaryKey(),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  thumbUrl: text("thumb_url").notNull(),
  originalUrl: text("original_url").notNull(),
  alt: text("alt").notNull(),
  position: integer("position").notNull().default(0),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  resized: boolean("resized").notNull().default(false),
});

export type OrderOptionChoice = { option: string; value: string };

export const orders = pgTable(
  "orders",
  {
    id: serial("id").primaryKey(),
    reference: text("reference").notNull(),
    token: text("token").notNull(),
    status: text("status").notNull().default("placed"),
    fulfilment: text("fulfilment").notNull(), // ship | pickup
    customerName: text("customer_name").notNull(),
    customerEmail: text("customer_email").notNull(),
    address1: text("address1").notNull().default(""),
    address2: text("address2").notNull().default(""),
    city: text("city").notNull().default(""),
    state: text("state").notNull().default(""),
    postalCode: text("postal_code").notNull().default(""),
    country: text("country").notNull().default(""),
    pickupStoreId: integer("pickup_store_id").references(() => stores.id, { onDelete: "set null" }),
    pickupStoreName: text("pickup_store_name").notNull().default(""),
    pickupReady: text("pickup_ready").notNull().default(""),
    subtotalCents: integer("subtotal_cents").notNull(),
    shippingCents: integer("shipping_cents").notNull(),
    taxCents: integer("tax_cents").notNull(),
    totalCents: integer("total_cents").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("orders_reference_idx").on(t.reference), uniqueIndex("orders_token_idx").on(t.token)],
);

export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  productId: integer("product_id").references(() => products.id, { onDelete: "set null" }),
  productName: text("product_name").notNull(),
  brandName: text("brand_name").notNull().default(""),
  options: jsonb("options").$type<OrderOptionChoice[]>().notNull().default([]),
  personalization: text("personalization").notNull().default(""),
  unitPriceCents: integer("unit_price_cents").notNull(),
  quantity: integer("quantity").notNull(),
  lineTotalCents: integer("line_total_cents").notNull(),
});

export const emailSignups = pgTable("email_signups", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Owner-editable key/value settings (announcement, hero, logo). */
export const siteSettings = pgTable("site_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
});

export const ownerSessions = pgTable("owner_sessions", {
  tokenHash: text("token_hash").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const loginAttempts = pgTable(
  "login_attempts",
  {
    id: serial("id").primaryKey(),
    address: text("address").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("login_attempts_addr_idx").on(t.address, t.createdAt)],
);

/** Things the owner should know about, such as a checkout that failed. Shown on the owner status page. */
export const systemEvents = pgTable("system_events", {
  id: serial("id").primaryKey(),
  kind: text("kind").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
