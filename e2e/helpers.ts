import { Pool } from "pg";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";

try {
  process.loadEnvFile(".env");
} catch {
  /* env may come from the host */
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export const OWNER = {
  email: process.env.OWNER_EMAIL ?? "",
  password: process.env.E2E_OWNER_PASSWORD ?? "",
};

let seq = 0;
export const uid = () => `${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

/** Each test gets its own "address" so the sign-in rate limit of one test never affects another. */
export function freshAddress() {
  return `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
}

export async function signInAsOwner(page: Page, address = freshAddress()) {
  await page.context().setExtraHTTPHeaders({ "x-forwarded-for": address });
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(OWNER.email);
  await page.getByLabel("Password").fill(OWNER.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/admin/products");
}

export type TestProductOpts = {
  name?: string;
  priceCents?: number;
  stock?: number;
  status?: "draft" | "published";
  category?: string;
  brand?: string;
  personalizable?: boolean;
  personalizationMaxLength?: number;
  /** Tracked "Size" option with per-size stock. */
  sizes?: Record<string, number>;
  colors?: string[];
  /** Extra untracked option with price adjustments. */
  finish?: { name: string; values: { value: string; adjust: number }[]; def?: string };
  withPhoto?: boolean;
};

export type TestProduct = {
  id: number;
  slug: string;
  name: string;
  priceCents: number;
  valueIds: Record<string, Record<string, number>>;
};

/** Inserts a product straight into the database (setup only). Slugs start with e2e- so they can be cleaned up. */
export async function createProduct(o: TestProductOpts = {}): Promise<TestProduct> {
  const id = uid();
  const name = o.name ?? `E2E Piece ${id}`;
  const slug = `e2e-${id}`;
  const price = o.priceCents ?? 12000;
  const cat = (await pool.query("select id from categories where name = $1", [o.category ?? "Dresses"])).rows[0].id;
  const brand = (await pool.query("select id from brands where name = $1", [o.brand ?? "Marlowe"])).rows[0].id;
  const tracked = o.sizes ? Object.values(o.sizes).reduce((a, b) => a + b, 0) : null;
  const stock = tracked ?? o.stock ?? 5;
  const {
    rows: [p],
  } = await pool.query(
    `insert into products (slug, name, tagline, brand_id, category_id, department, description, price_cents, stock, status, personalizable, personalization_max_length)
     values ($1,$2,$3,$4,$5,'women',$6,$7,$8,$9,$10,$11) returning id`,
    [slug, name, "Test tagline", brand, cat, "Test description", price, stock, o.status ?? "published", !!o.personalizable, o.personalizationMaxLength ?? 12],
  );
  const valueIds: TestProduct["valueIds"] = {};
  let pos = 0;
  const addOption = async (optName: string, values: { value: string; adjust?: number; stock?: number }[], def: string | null, tracksStock: boolean) => {
    const {
      rows: [opt],
    } = await pool.query(
      "insert into product_options (product_id, name, required, default_value, tracks_stock, position) values ($1,$2,true,$3,$4,$5) returning id",
      [p.id, optName, def, tracksStock, pos++],
    );
    valueIds[optName] = {};
    for (let i = 0; i < values.length; i++) {
      const v = values[i];
      const {
        rows: [row],
      } = await pool.query(
        "insert into product_option_values (option_id, value, price_adjust_cents, stock, position) values ($1,$2,$3,$4,$5) returning id",
        [opt.id, v.value, v.adjust ?? 0, v.stock ?? 0, i],
      );
      valueIds[optName][v.value] = row.id;
    }
  };
  if (o.colors) await addOption("Color", o.colors.map((value) => ({ value })), o.colors[0], false);
  if (o.finish) await addOption(o.finish.name, o.finish.values.map((v) => ({ value: v.value, adjust: v.adjust })), o.finish.def ?? o.finish.values[0].value, false);
  if (o.sizes) await addOption("Size", Object.entries(o.sizes).map(([value, s]) => ({ value, stock: s })), null, true);
  if (o.withPhoto) {
    await pool.query(
      "insert into product_images (product_id, url, thumb_url, original_url, alt, position, width, height) values ($1,'/uploads/none.webp','/uploads/none.webp','/uploads/none.webp',$2,0,1200,1600)",
      [p.id, name],
    );
  }
  return { id: p.id, slug, name, priceCents: price, valueIds };
}

export async function cleanup() {
  await pool.query("delete from orders where customer_email like '%@e2e.test'");
  await pool.query("delete from products where slug like 'e2e-%'");
  await pool.query("delete from categories where name like 'E2E %'");
  await pool.query("delete from email_signups where email like '%@e2e.test'");
}

/** Put lines straight into the browser cart before the page loads (only when it is empty). */
export async function preloadCart(
  context: BrowserContext,
  lines: { product: TestProduct; valueIds?: number[]; quantity?: number; seenPriceCents?: number; personalization?: string }[],
  token = `tok-${uid()}-${uid()}`,
) {
  const state = {
    token,
    lines: lines.map((l) => {
      const ids = [...(l.valueIds ?? [])].sort((a, b) => a - b);
      const pers = l.personalization ?? "";
      return {
        key: `${l.product.id}|${ids.join(".")}|${pers}`,
        productId: l.product.id,
        slug: l.product.slug,
        optionValueIds: ids,
        personalization: pers,
        quantity: l.quantity ?? 1,
        seenUnitPriceCents: l.seenPriceCents ?? l.product.priceCents,
      };
    }),
  };
  await context.addInitScript(
    ([k, v]) => {
      if (!window.localStorage.getItem(k)) window.localStorage.setItem(k, v);
    },
    ["av_cart_v1", JSON.stringify(state)] as const,
  );
  return state;
}

export async function fillCheckout(page: Page, over: Partial<Record<string, string>> = {}) {
  const v = {
    name: "Ada Lovelace",
    email: "ada@e2e.test",
    address1: "12 Analytical Way",
    city: "Los Gatos",
    state: "CA",
    postalCode: "95030",
    ...over,
  };
  await page.getByLabel("Full name").fill(v.name);
  await page.getByLabel("Email").fill(v.email);
  await page.getByLabel("Street address").fill(v.address1);
  await page.getByLabel("City").fill(v.city);
  await page.getByLabel("State / region").fill(v.state);
  await page.getByLabel("ZIP / postal code").fill(v.postalCode);
}

export async function orderCount(): Promise<number> {
  return Number((await pool.query("select count(*)::int as n from orders")).rows[0].n);
}

export { expect, test };
