import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import path from "node:path";
import sharp from "sharp";
import { test, expect, pool, cleanup, createProduct, preloadCart, fillCheckout, orderCount, signInAsOwner, uid, OWNER, freshAddress } from "./helpers";

test.afterAll(async () => {
  await cleanup();
});

const ROOT = process.cwd();
const TSX = path.join(ROOT, "node_modules", "tsx", "dist", "cli.mjs");
const NEXT = path.join(ROOT, "node_modules", "next", "dist", "bin", "next");

function runTsx(args: string[], env: Record<string, string | undefined> = {}) {
  return spawnSync(process.execPath, [TSX, ...args], { cwd: ROOT, env: { ...process.env, ...env }, encoding: "utf8", timeout: 120_000 });
}

/** Starts a second copy of the built store with different environment settings. */
function startServer(port: number, env: Record<string, string | undefined>) {
  let out = "";
  const proc: ChildProcess = spawn(process.execPath, [NEXT, "start", "-p", String(port)], {
    cwd: ROOT,
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  proc.stdout?.on("data", (d) => (out += d));
  proc.stderr?.on("data", (d) => (out += d));
  return { proc, output: () => out, stop: () => proc.kill("SIGKILL") };
}

async function waitFor(fn: () => Promise<boolean> | boolean, ms: number) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await fn()) return true;
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

async function pngBuffer(width: number, height: number) {
  return sharp({ create: { width, height, channels: 3, background: { r: 120, g: 90, b: 100 } } })
    .png()
    .toBuffer();
}

test("E-029 duplicate slug: message at the slug field names the clash and suggests another; typed values kept", async ({ page }) => {
  const existing = await createProduct({});
  await signInAsOwner(page);
  await page.goto("/admin/products/new");
  const name = `E2E Clash ${uid()}`;
  await page.locator("#f-name").fill(name);
  await page.locator("#f-slug").fill(existing.slug);
  await page.locator("#f-categoryId").selectOption({ label: "Dresses" });
  await page.locator("#f-price").fill("100.00");
  await page.locator("#f-stock").fill("2");
  await page.getByTestId("save-product").click();
  const err = page.getByTestId("error-slug");
  await expect(err).toContainText("already used");
  await expect(err).toContainText(existing.name);
  await expect(err).toContainText(`${existing.slug}-2`);
  await expect(page.locator("#f-name")).toHaveValue(name);
  await expect(page.locator("#f-slug")).toHaveValue(existing.slug);
  await expect(page.locator("#f-slug")).toBeFocused();
  expect(page.url()).toContain("/admin/products/new");
  expect((await pool.query("select count(*)::int n from products where name = $1", [name])).rows[0].n).toBe(0);
  // the suggested address works
  await page.locator("#f-slug").fill(`${existing.slug}-2`);
  await page.getByTestId("save-product").click();
  await page.waitForURL(/\/admin\/products\/\d+/);
});

test("E-030 wrong type or too large: the file is refused with a message, the other file is kept", async ({ page }) => {
  const p = await createProduct({});
  await signInAsOwner(page);
  await page.goto(`/admin/products/${p.id}`);
  await page.getByTestId("photo-input").setInputFiles([
    { name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("not a photo") },
    { name: "huge.jpg", mimeType: "image/jpeg", buffer: Buffer.alloc(5 * 1024 * 1024 + 4096, 1) },
    { name: "good.png", mimeType: "image/png", buffer: await pngBuffer(1000, 1200) },
  ]);
  await expect(page.getByTestId("photo-item")).toHaveCount(1);
  const failed = page.getByTestId("upload-failed");
  await expect(failed).toHaveCount(2);
  await expect(failed.nth(0)).toContainText("JPEG, PNG and WebP");
  await expect(failed.nth(1)).toContainText("5 MB");
  expect((await pool.query("select count(*)::int n from product_images where product_id = $1", [p.id])).rows[0].n).toBe(1);
});

test("E-036 a very large photo is resized for shoppers, the original is kept, and the owner is told", async ({ page, request }) => {
  const p = await createProduct({});
  await signInAsOwner(page);
  await page.goto(`/admin/products/${p.id}`);
  await page.getByTestId("photo-input").setInputFiles({ name: "wide.png", mimeType: "image/png", buffer: await pngBuffer(3200, 2400) });
  await expect(page.getByTestId("photo-item")).toHaveCount(1);
  await expect(page.getByTestId("photo-notes")).toContainText("resized for the web");
  const row = (await pool.query("select url, original_url, width from product_images where product_id = $1", [p.id])).rows[0];
  expect(row.width).toBe(3200);
  const web = await request.get(row.url);
  expect(web.status()).toBe(200);
  expect((await sharp(await web.body()).metadata()).width).toBeLessThanOrEqual(1600);
  const original = await request.get(row.original_url);
  expect(original.status()).toBe(200);
  expect((await sharp(await original.body()).metadata()).width).toBe(3200);
});

test("E-031 a deployed store without object storage refuses to start and never writes to its own disk", async () => {
  // a) startup check
  const s = startServer(3102, { DEPLOYED: "1", BLOB_READ_WRITE_TOKEN: "", VERCEL: "" });
  try {
    const refused = await waitFor(async () => {
      if (s.proc.exitCode !== null) return true;
      try {
        const res = await fetch("http://localhost:3102/shop");
        return res.status >= 500;
      } catch {
        return false;
      }
    }, 40_000);
    expect(refused, s.output()).toBe(true);
    expect(s.output()).toContain("Photo storage is not set up");
  } finally {
    s.stop();
  }
  // b) the adapter and the owner message
  const r = runTsx(
    [
      "-e",
      `import { getStorage, storageStatus } from "./src/lib/storage";
       let threw = "";
       try { getStorage(); } catch (e) { threw = (e as Error).message; }
       console.log(JSON.stringify({ threw, status: storageStatus() }));`,
    ],
    { DEPLOYED: "1", BLOB_READ_WRITE_TOKEN: "", VERCEL: "" },
  );
  expect(r.status, r.stderr).toBe(0);
  const out = JSON.parse(r.stdout.trim().split("\n").pop()!);
  expect(out.threw).toContain("Photo storage is not set up");
  expect(out.threw).toContain("Vercel Blob");
  expect(out.status.ok).toBe(false);
  expect(out.status.message).toContain("BLOB_READ_WRITE_TOKEN");
});

test("E-032 deleting a category that still has products is blocked and says how many must move", async ({ page }) => {
  const catName = `E2E Cat ${uid()}`;
  await pool.query("insert into categories (name, slug, position) values ($1, $2, 99)", [catName, `e2e-cat-${uid()}`]);
  const p = await createProduct({ category: catName });
  await signInAsOwner(page);
  await page.goto("/admin/categories");
  page.on("dialog", (d) => d.accept());
  const item = page.getByTestId("list-item").filter({ hasText: catName });
  await item.getByTestId("item-delete").click();
  await expect(page.getByTestId("list-message")).toContainText("still has 1 product");
  expect((await pool.query("select count(*)::int n from categories where name = $1", [catName])).rows[0].n).toBe(1);
  // once the product has moved, the delete goes through
  const dresses = (await pool.query("select id from categories where name = 'Dresses'")).rows[0].id;
  await pool.query("update products set category_id = $1 where id = $2", [dresses, p.id]);
  await page.goto("/admin/categories");
  await page.getByTestId("list-item").filter({ hasText: catName }).getByTestId("item-delete").click();
  await expect(page.getByTestId("list-message")).toContainText("Deleted");
  expect((await pool.query("select count(*)::int n from categories where name = $1", [catName])).rows[0].n).toBe(0);
});

test("E-034 owner changes a price while the item is in a cart: cart shows the new price with a notice, snapshot kept on the order", async ({ page, context, browser }) => {
  const p = await createProduct({ priceCents: 12000 });
  await preloadCart(context, [{ product: p }]);
  await page.goto("/cart");
  await expect(page.getByTestId("unit-price")).toHaveText("$120.00");

  const ownerCtx = await browser.newContext();
  const ownerPage = await ownerCtx.newPage();
  await signInAsOwner(ownerPage);
  await ownerPage.goto(`/admin/products/${p.id}`);
  await ownerPage.locator("#f-price").fill("150.00");
  await ownerPage.getByTestId("save-product").click();
  await expect(ownerPage.getByTestId("editor-message")).toContainText("Saved");
  await ownerCtx.close();

  await page.goto("/cart");
  await expect(page.getByTestId("price-changed-notice")).toContainText("$120.00 to $150.00");
  await expect(page.getByTestId("unit-price")).toHaveText("$150.00");
  await page.getByTestId("checkout-link").click();
  await fillCheckout(page);
  await page.getByTestId("place-order").click();
  await page.waitForURL(/\/order\/AV-/);
  const item = (await pool.query("select unit_price_cents from order_items oi join orders o on o.id = oi.order_id where o.customer_email = 'ada@e2e.test' and oi.product_id = $1", [p.id])).rows[0];
  expect(item.unit_price_cents).toBe(15000);
});

test("E-035 five wrong passwords pause sign-in for 15 minutes, even for the right password", async ({ page }) => {
  const address = freshAddress();
  await page.context().setExtraHTTPHeaders({ "x-forwarded-for": address });
  try {
    for (let i = 0; i < 5; i++) {
      await page.goto("/admin/login");
      await page.getByLabel("Email").fill(OWNER.email);
      await page.getByLabel("Password").fill(`wrong-password-${i}`);
      await page.getByRole("button", { name: "Sign in" }).click();
      await expect(page.getByTestId("login-error")).toBeVisible();
      if (i < 4) await expect(page.getByTestId("login-error")).toContainText("isn't right");
    }
    await expect(page.getByTestId("login-error")).toContainText("paused for 15 more minutes");
    await page.getByLabel("Password").fill(OWNER.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByTestId("login-error")).toContainText("paused");
    expect(page.url()).toContain("/admin/login");
    // another address is not affected
    await page.context().setExtraHTTPHeaders({ "x-forwarded-for": freshAddress() });
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(OWNER.email);
    await page.getByLabel("Password").fill(OWNER.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/admin/products");
  } finally {
    await pool.query("delete from login_attempts where address = $1", [address]);
  }
});

test("E-019 a failure while placing the order: plain message, no half order, and the owner sees it on the status page", async ({ page, context, browser }) => {
  const name = `E2E Fail ${uid()}`;
  const p = await createProduct({ name, stock: 3 });
  await pool.query(`
    create or replace function e2e_fail_order_item() returns trigger as $$
    begin raise exception 'simulated database failure'; end; $$ language plpgsql;
    drop trigger if exists e2e_fail_order_item on order_items;
    create trigger e2e_fail_order_item before insert on order_items
      for each row when (new.product_name like 'E2E Fail%') execute function e2e_fail_order_item();`);
  try {
    await preloadCart(context, [{ product: p }]);
    await page.goto("/checkout");
    await fillCheckout(page);
    const before = await orderCount();
    await page.getByTestId("place-order").click();
    await expect(page.getByTestId("checkout-banner")).toContainText("Something went wrong placing your demo order. Nothing was charged. Please try again.");
    expect(await orderCount()).toBe(before);
    expect((await pool.query("select stock from products where id = $1", [p.id])).rows[0].stock).toBe(3);
    // the shopper's cart is still there
    await page.goto("/cart");
    await expect(page.getByTestId("cart-line")).toHaveCount(1);
  } finally {
    await pool.query("drop trigger if exists e2e_fail_order_item on order_items; drop function if exists e2e_fail_order_item();");
  }
  const ownerCtx = await browser.newContext();
  const ownerPage = await ownerCtx.newPage();
  await signInAsOwner(ownerPage);
  await ownerPage.goto("/admin/status");
  await expect(ownerPage.getByTestId("events")).toContainText("checkout failed");
  await expect(ownerPage.getByTestId("events")).toContainText("Nothing was charged");
  await ownerCtx.close();
});

test("E-025 database unreachable: 'The shop is having a moment' with Try again and a saved-cart reminder; owner status reports it", async ({ page }) => {
  const bad = "postgres://nobody:nothing@127.0.0.1:1/none";
  const s = startServer(3101, { DATABASE_URL: bad });
  try {
    const up = await waitFor(async () => {
      try {
        const res = await fetch("http://localhost:3101/shop");
        return res.status > 0;
      } catch {
        return false;
      }
    }, 40_000);
    expect(up, s.output()).toBe(true);
    await page.goto("http://localhost:3101/shop");
    await expect(page.getByRole("heading", { name: "The shop is having a moment" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    await expect(page.getByText("Your cart is saved")).toBeVisible();
    await expect(page.locator("body")).not.toContainText("ECONNREFUSED");
    await expect(page.locator("body")).not.toContainText("at Object");
  } finally {
    s.stop();
  }
  // the status check the owner can open reports it in plain words instead of failing
  const r = runTsx(
    ["-e", `import { getStoreStatus } from "./src/lib/status"; getStoreStatus().then((s) => { console.log(JSON.stringify(s.database)); process.exit(0); });`],
    { DATABASE_URL: bad },
  );
  expect(r.status, r.stderr).toBe(0);
  const db = JSON.parse(r.stdout.trim().split("\n").pop()!);
  expect(db.ok).toBe(false);
  expect(db.message).toContain("The database can't be reached");
  expect(db.message).toContain("Check that the database is running");
});

test("E-024 the seed script refuses to wipe a store that already has products unless confirmed", async () => {
  const before = (await pool.query("select count(*)::int n from products where slug not like 'e2e-%'")).rows[0].n;
  expect(before).toBeGreaterThan(0);
  const r = runTsx(["scripts/seed.ts"]);
  expect(r.status).toBe(1);
  expect(r.stderr).toContain("Refusing to seed");
  expect(r.stderr).toContain("--confirm");
  const after = (await pool.query("select count(*)::int n from products where slug not like 'e2e-%'")).rows[0].n;
  expect(after).toBe(before);
});
