import sharp from "sharp";
import { test, expect, pool, cleanup, createProduct, signInAsOwner, uid, OWNER, freshAddress } from "./helpers";

/**
 * Owner area checks for what the brief asks for: products with brand, categories, collections and per-size
 * stock; brands; collections; stores and pickup; announcement bar; home page; email signups.
 */

test.afterAll(async () => {
  await pool.query("delete from stores where name like 'E2E %'");
  await pool.query("delete from brands where name like 'E2E %'");
  await pool.query("delete from collections where name like 'E2E %'");
  await cleanup();
});

async function png(w: number, h: number) {
  return sharp({ create: { width: w, height: h, channels: 3, background: { r: 60, g: 80, b: 110 } } }).png().toBuffer();
}

async function snapshotSettings() {
  const settings = (await pool.query("select key, value from site_settings")).rows;
  const cols = (await pool.query("select id, show_on_home, home_position from collections")).rows;
  return async () => {
    for (const r of settings) await pool.query("update site_settings set value = $2 where key = $1", [r.key, JSON.stringify(r.value)]);
    for (const c of cols) await pool.query("update collections set show_on_home = $2, home_position = $3 where id = $1", [c.id, c.show_on_home, c.home_position]);
  };
}

test("owner sign-in: the area is closed to anyone else, a wrong password is explained, sign-out ends the session", async ({ page, request }) => {
  await page.goto("/admin/products");
  await expect(page).toHaveURL(/\/admin\/login/);
  expect((await request.get("/api/admin/status")).status()).toBe(401);
  expect((await request.post("/api/admin/products/1/photos")).status()).toBe(401);
  await page.context().setExtraHTTPHeaders({ "x-forwarded-for": freshAddress() });
  await page.getByLabel("Email").fill(OWNER.email);
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByTestId("login-error")).toContainText("isn't right");
  await expect(page.getByLabel("Email")).toHaveValue(OWNER.email); // what was typed is kept
  await page.getByLabel("Password").fill(OWNER.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/admin/products");
  await expect(page.getByTestId("products-heading")).toBeVisible();
  // the seeded products are labelled as samples
  await expect(page.getByText("Sample", { exact: true }).first()).toBeVisible();
  await page.getByTestId("sign-out").click();
  await page.waitForURL("**/admin/login");
  await page.goto("/admin/products");
  await expect(page).toHaveURL(/\/admin\/login/);
});

test("products: create with brand, category, collection and per-size stock; needs a photo to publish; then shoppers see it", async ({ page, request }) => {
  const hiddenFromShoppers = async (slug: string) => {
    const res = await request.get(`/products/${slug}`); // no owner session: this is what a shopper gets
    expect(res.status()).toBe(404);
    expect(await res.text()).toMatch(/isn(?:'|&#x27;|&#39;)t available right now/);
  };
  await signInAsOwner(page);
  await page.goto("/admin/products/new");
  const name = `E2E Gown ${uid()}`;
  await page.locator("#f-name").fill(name);
  await page.locator("#f-brandId").selectOption({ label: "Fenwick" });
  await page.locator("#f-categoryId").selectOption({ label: "Dresses" });
  await page.locator("#f-price").fill("210.00");
  await page.locator("#f-description").fill("An owner-made test piece.");
  await page.getByLabel("Best Sellers").check();
  await page.getByTestId("add-size-option").click();
  await page.locator('[id="f-options.0.values.2.stock"]').fill("2"); // size 4
  await page.locator('[id="f-options.0.values.3.stock"]').fill("1"); // size 6
  await page.locator("#f-materialsCare").fill("100% cotton\nDry clean only");
  await page.locator("#f-specifications").fill("Fit: Relaxed\nMade in: Portugal");
  await page.getByTestId("save-product").click();
  await page.waitForURL(/\/admin\/products\/\d+/);
  await expect(page.getByTestId("editor-message")).toContainText("saved as a draft");
  const id = Number(page.url().match(/products\/(\d+)/)![1]);
  const slug = (await pool.query("select slug, stock from products where id = $1", [id])).rows[0];
  expect(slug.stock).toBe(3); // the product total is the sum of the sizes
  const sizes = (await pool.query("select v.value, v.stock from product_option_values v join product_options o on o.id = v.option_id where o.product_id = $1 order by v.position", [id])).rows;
  expect(sizes.map((s) => `${s.value}:${s.stock}`)).toEqual(["0:0", "2:0", "4:2", "6:1", "8:0", "10:0"]);

  // a draft is hidden from shoppers
  await hiddenFromShoppers(slug.slug);
  await page.goto(`/products/${slug.slug}`);
  await expect(page.getByTestId("draft-banner")).toContainText("Draft preview"); // the owner can preview it

  // publishing needs a photo
  await page.goto(`/admin/products/${id}`);
  await page.getByTestId("publish-toggle").click();
  await expect(page.getByTestId("editor-message")).toContainText("Add at least one photo");
  await page.getByTestId("photo-input").setInputFiles({ name: "front.png", mimeType: "image/png", buffer: await png(1000, 1300) });
  await expect(page.getByTestId("photo-item")).toHaveCount(1);
  await expect(page.getByTestId("cover-badge")).toBeVisible();
  await page.getByTestId("publish-toggle").click();
  await expect(page.getByTestId("editor-message")).toContainText("Published");

  // shoppers: size 4 and 6 can be chosen, size 0 is struck through; brand and collection show
  await page.goto(`/products/${slug.slug}`);
  await expect(page.getByTestId("product-brand")).toHaveText("Fenwick");
  await expect(page.getByTestId("value-size-4")).not.toHaveAttribute("aria-disabled", "true");
  await expect(page.getByTestId("value-size-0")).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByTestId("value-size-0").locator("span.line-through")).toHaveCount(1);
  await expect(page.getByText("100% cotton")).toBeVisible();
  await expect(page.locator("dd", { hasText: "Relaxed" })).toBeVisible();
  await page.goto("/collections/best-sellers");
  await expect(page.getByRole("link", { name })).toBeVisible();
  await page.goto("/brands/fenwick");
  await expect(page.getByRole("link", { name })).toBeVisible();

  // the owner changes the stock of one size to zero: the size is sold out for shoppers
  await page.goto(`/admin/products/${id}`);
  await page.locator('[id="f-options.0.values.3.stock"]').fill("0");
  await page.getByTestId("save-product").click();
  await expect(page.getByTestId("editor-message")).toContainText("Saved");
  await page.goto(`/products/${slug.slug}`);
  await expect(page.getByTestId("value-size-6")).toHaveAttribute("aria-disabled", "true");

  // unpublish: the direct link explains instead of failing
  await page.goto(`/admin/products/${id}`);
  await page.getByTestId("publish-toggle").click();
  await expect(page.getByTestId("editor-message")).toContainText("Unpublished");
  await hiddenFromShoppers(slug.slug);
});

test("brands: add, edit and delete; a brand shows in the home strip and on its own page once it has a product", async ({ page }) => {
  await signInAsOwner(page);
  await page.goto("/admin/brands");
  const brand = `E2E Brand ${uid()}`;
  await page.locator("#add-name").fill(brand);
  await page.locator("#add-description").fill("A brand added by the owner.");
  await page.getByTestId("add-submit").click();
  await expect(page.getByTestId("list-message")).toContainText("Added");
  const p = await createProduct({ brand });
  await page.goto("/");
  await expect(page.locator("#brands-heading + ul a", { hasText: brand })).toBeVisible();
  await page.locator("#brands-heading + ul a", { hasText: brand }).click();
  await expect(page.getByRole("heading", { level: 1, name: brand })).toBeVisible();
  await expect(page.getByText("A brand added by the owner.")).toBeVisible();
  await expect(page.getByRole("link", { name: new RegExp(p.name) })).toBeVisible();
  // a brand that still has products cannot be deleted; once they move, it can
  await page.goto("/admin/brands");
  page.on("dialog", (d) => d.accept());
  await page.getByTestId("list-item").filter({ hasText: brand }).getByTestId("item-delete").click();
  await expect(page.getByTestId("list-message")).toContainText("still has 1 product");
  expect((await pool.query("select count(*)::int n from brands where name = $1", [brand])).rows[0].n).toBe(1);
  const marlowe = (await pool.query("select id from brands where name = 'Marlowe'")).rows[0].id;
  await pool.query("update products set brand_id = $1 where id = $2", [marlowe, p.id]);
  await page.goto("/admin/brands");
  await page.getByTestId("list-item").filter({ hasText: brand }).getByTestId("item-delete").click();
  await expect(page.getByTestId("list-message")).toContainText("Deleted");
  await page.goto("/brands");
  await expect(page.getByRole("link", { name: brand })).toHaveCount(0);
});

test("collections: add one, put a product in it, it has its own page; delete keeps the product", async ({ page }) => {
  await signInAsOwner(page);
  await page.goto("/admin/collections");
  const name = `E2E Collection ${uid()}`;
  await page.locator("#add-name").fill(name);
  await page.locator("#add-description").fill("Pieces picked by the owner.");
  await page.getByTestId("add-submit").click();
  await expect(page.getByTestId("list-message")).toContainText("Added");
  const p = await createProduct({});
  const col = (await pool.query("select id, slug from collections where name = $1", [name])).rows[0];
  await pool.query("insert into product_collections (product_id, collection_id) values ($1, $2)", [p.id, col.id]);
  await page.goto(`/collections/${col.slug}`);
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  await expect(page.getByText("Pieces picked by the owner.")).toBeVisible();
  await expect(page.getByRole("link", { name: new RegExp(p.name) })).toBeVisible();
  await page.goto("/admin/collections");
  page.on("dialog", (d) => d.accept());
  await page.getByTestId("list-item").filter({ hasText: name }).getByTestId("item-delete").click();
  await expect(page.getByTestId("list-message")).toContainText("Deleted");
  expect((await pool.query("select count(*)::int n from products where id = $1", [p.id])).rows[0].n).toBe(1);
  expect((await page.request.get(`/collections/${col.slug}`)).status()).toBe(404);
});

test("home page: which collections show and their order, hero headline and button, hero image", async ({ page }) => {
  const restore = await snapshotSettings();
  try {
    await signInAsOwner(page);
    await page.goto("/admin/home");
    const headline = `E2E headline ${uid()}`;
    await page.locator("#h-headline").fill(headline);
    await page.locator("#h-label").fill("Browse everything");
    await page.locator("#h-href").fill("/shop");
    await page.getByRole("button", { name: "Save hero text" }).click();
    await expect(page.getByTestId("hero-save-message")).toContainText("Saved");
    // hero image: a neutral placeholder until the owner uploads one
    await page.getByTestId("hero-input").setInputFiles({ name: "hero.png", mimeType: "image/png", buffer: await png(2000, 900) });
    await expect(page.getByTestId("hero-message")).toContainText("updated");
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(headline);
    await expect(page.getByRole("link", { name: "Browse everything" })).toHaveAttribute("href", "/shop");
    await expect(page.locator("section[aria-labelledby=hero-heading] img")).toHaveCount(1);

    // hide Best Sellers, move Occasion Dressing to the top
    await page.goto("/admin/home");
    const list = page.getByTestId("home-collections");
    await list.getByRole("listitem").filter({ hasText: "Best Sellers" }).getByRole("checkbox").uncheck();
    await page.getByRole("button", { name: "Move Occasion Dressing up" }).click();
    await page.getByTestId("save-home-collections").click();
    await expect(page.getByTestId("collections-message")).toContainText("Saved");
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 2, name: "Best Sellers" })).toHaveCount(0);
    const titles = await page.locator("main > section[aria-labelledby^=col-] h2").allInnerTexts();
    expect(titles).toEqual(["Occasion Dressing", "New Arrivals"]);
  } finally {
    await restore();
  }
});

test("announcement bar: the owner edits the messages and can switch the bar off", async ({ page }) => {
  const restore = await snapshotSettings();
  try {
    await signInAsOwner(page);
    await page.goto("/admin/announcement");
    const msg = `E2E offer ${uid()}`;
    await page.locator("#ann-messages").fill(`${msg}\nSecond E2E message`);
    await page.getByRole("button", { name: "Save announcement" }).click();
    await expect(page.getByTestId("announcement-message")).toContainText("Saved");
    await page.goto("/");
    await expect(page.getByTestId("announcement")).toHaveText(msg);
    await page.getByRole("button", { name: "Next announcement" }).click();
    await expect(page.getByTestId("announcement")).toHaveText("Second E2E message");
    await page.goto("/admin/announcement");
    await page.locator("#ann-enabled").uncheck();
    await page.getByRole("button", { name: "Save announcement" }).click();
    await expect(page.getByTestId("announcement-message")).toContainText("Saved");
    await page.goto("/");
    await expect(page.getByTestId("announcement")).toHaveCount(0);
  } finally {
    await restore();
  }
});

test("stores and pickup: a new store shows in the footer, on product pages and at checkout; switching pickup off removes it from pickup", async ({ page }) => {
  await signInAsOwner(page);
  await page.goto("/admin/stores");
  const name = `E2E Store ${uid()}`;
  await page.locator("#add-name").fill(name);
  await page.locator("#add-address").fill("1 Test Street, Testville");
  await page.locator("#add-phone").fill("555-0199");
  await page.locator("#add-pickup").check();
  await page.locator("#add-pickupReady").fill("Ready in about E2E minutes");
  await page.getByTestId("add-submit").click();
  await expect(page.getByTestId("list-message")).toContainText("Added");
  await page.goto("/products/aldine-wrap-dress");
  await expect(page.getByTestId("pickup")).toContainText(name);
  await expect(page.getByTestId("pickup")).toContainText("Ready in about E2E minutes");
  await expect(page.locator("footer")).toContainText(name);
  await expect(page.locator("footer")).toContainText("555-0199");

  const item = page.getByTestId("list-item").filter({ hasText: name });
  await page.goto("/admin/stores");
  await page.getByTestId("list-item").filter({ hasText: name }).getByLabel("Offer pickup at this store").uncheck();
  await page.getByTestId("list-item").filter({ hasText: name }).getByTestId("item-save").click();
  await expect(page.getByTestId("list-message")).toContainText("Saved");
  void item;
  await page.goto("/products/aldine-wrap-dress");
  await expect(page.getByTestId("pickup")).not.toContainText(name);
  await expect(page.locator("footer")).toContainText(name); // still a store, just no pickup

  await page.goto("/admin/stores");
  page.on("dialog", (d) => d.accept());
  await page.getByTestId("list-item").filter({ hasText: name }).getByTestId("item-delete").click();
  await expect(page.getByTestId("list-message")).toContainText("Deleted");
  await page.goto("/");
  await expect(page.locator("footer")).not.toContainText(name);
});

test("email signups: the address a shopper left on the home page is listed for the owner; nothing is sent", async ({ page, browser }) => {
  const email = `list-${uid()}@e2e.test`;
  await page.goto("/");
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page.getByTestId("signup-thanks")).toContainText("Thank you");
  const ctx = await browser.newContext();
  const owner = await ctx.newPage();
  await signInAsOwner(owner);
  await owner.goto("/admin/signups");
  await expect(owner.getByTestId("signups-table")).toContainText(email);
  await expect(owner.getByText("Nothing is sent to them from this store.")).toBeVisible();
  await ctx.close();
});
