import { test, expect, pool, cleanup, createProduct, preloadCart, fillCheckout, orderCount, uid, type TestProduct } from "./helpers";
import type { APIRequestContext } from "@playwright/test";

test.afterAll(async () => {
  await cleanup();
});

function payload(p: TestProduct, token: string, over: Record<string, unknown> = {}) {
  return {
    token,
    fulfilment: "ship",
    storeId: null,
    customer: { name: "Grace Hopper", email: "grace@e2e.test", address1: "1 Navy Way", address2: "", city: "Los Gatos", state: "CA", postalCode: "95030", country: "United States" },
    lines: [{ productId: p.id, slug: p.slug, optionValueIds: [], personalization: "", quantity: 1, seenUnitPriceCents: p.priceCents }],
    ...over,
  };
}
const tok = () => `tok-${uid()}-${uid()}-xx`;
async function post(request: APIRequestContext, body: unknown) {
  const res = await request.post("/api/checkout", { data: body });
  return { status: res.status(), json: await res.json() };
}

test("E-001 missing required option blocked, message names it, focus moves, other choices kept", async ({ page }) => {
  await page.goto("/products/aldine-wrap-dress");
  await page.getByTestId("value-color-Ivory").click();
  await page.getByTestId("add-to-cart").click();
  const err = page.getByTestId("option-error");
  await expect(err).toContainText("Please choose a size before adding to your cart");
  await expect(page.getByTestId("value-size-0")).toBeFocused();
  await expect(page.getByTestId("value-color-Ivory")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("cart-count")).toHaveText("0");
  await expect(page.getByTestId("added-confirmation")).toHaveCount(0);
});

test("E-002 sold-out size is struck through, labelled, cannot be chosen; other choices kept", async ({ page }) => {
  const p = await createProduct({ colors: ["Ink", "Ivory"], sizes: { "4": 0, "6": 3 } });
  await page.goto(`/products/${p.slug}`);
  const sold = page.getByTestId("value-size-4");
  await expect(sold).toHaveAttribute("aria-disabled", "true");
  await expect(sold).toContainText("Sold out");
  await expect(sold.locator("span.line-through")).toHaveCount(1);
  await page.getByTestId("value-color-Ivory").click();
  await sold.click({ force: true }); // aria-disabled: Playwright waits for "enabled", a shopper can still click it
  await expect(page.getByTestId("option-error")).toContainText("sold out");
  await expect(sold).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("value-color-Ivory")).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("add-to-cart").click();
  await expect(page.getByTestId("cart-count")).toHaveText("0");
  // a valid size still works afterwards with the same colour
  await page.getByTestId("value-size-6").click();
  await page.getByTestId("add-to-cart").click();
  await expect(page.getByTestId("added-confirmation")).toContainText("Color Ivory");
});

test("E-003 invalid personalization blocked; middle dot rejected; maxLength enforced; live count", async ({ page }) => {
  const p = await createProduct({ personalizable: true, personalizationMaxLength: 6 });
  await page.goto(`/products/${p.slug}`);
  const field = page.getByLabel(/Monogram/);
  await field.fill("Jo@");
  await expect(page.getByTestId("personalization-error")).toContainText("letters, numbers, spaces");
  await page.getByTestId("add-to-cart").click();
  await expect(page.getByTestId("cart-count")).toHaveText("0");
  await field.fill("A·B");
  await expect(page.getByTestId("personalization-error")).toBeVisible();
  await field.fill("abcdefghij");
  await expect(field).toHaveValue("abcdef");
  await expect(page.getByTestId("personalization-count")).toHaveText("6/6");
  await expect(page.getByTestId("personalization-error")).toHaveCount(0);
  // the server enforces the same rule
  const res = await page.request.post("/api/cart/price", {
    data: { lines: [{ productId: p.id, slug: p.slug, optionValueIds: [], personalization: "waytoolongtext", quantity: 1, seenUnitPriceCents: 0 }] },
  });
  expect((await res.json()).lines[0].issue.code).toBe("invalid");
});

test("E-004 spaces-only personalization is not stored; final-sale note only on personalizable products", async ({ page }) => {
  const p = await createProduct({ personalizable: true });
  await page.goto(`/products/${p.slug}`);
  await expect(page.getByTestId("final-sale-note")).toContainText("final sale");
  await page.getByLabel(/Monogram/).fill("    ");
  await page.getByTestId("add-to-cart").click();
  await expect(page.getByTestId("added-confirmation")).toBeVisible();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("av_cart_v1")!));
  expect(stored.lines[0].personalization).toBe("");
  await page.goto("/cart");
  await expect(page.getByTestId("line-personalization")).toHaveCount(0);
  const plain = await createProduct({});
  await page.goto(`/products/${plain.slug}`);
  await expect(page.getByTestId("final-sale-note")).toHaveCount(0);
});

test("E-005 unknown product → real 404 with a path back to the shop", async ({ page }) => {
  const res = await page.goto("/products/does-not-exist-" + uid());
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "We couldn't find that product" })).toBeVisible();
  await page.getByRole("link", { name: "Back to the shop" }).click();
  await expect(page).toHaveURL(/\/shop$/);
});

test("E-006 unavailable product explains itself and has no add-to-cart button", async ({ page }) => {
  const draft = await createProduct({ status: "draft" });
  const res = await page.goto(`/products/${draft.slug}`);
  expect(res?.status()).toBe(404);
  await expect(page.getByTestId("product-not-found")).toContainText("isn't available right now");
  await expect(page.getByTestId("add-to-cart")).toHaveCount(0);
  const sold = await createProduct({ stock: 0 });
  await page.goto(`/products/${sold.slug}`);
  await expect(page.getByTestId("availability")).toHaveText("Sold out");
  await expect(page.getByTestId("add-to-cart")).toBeDisabled();
});

test("E-007 maximum of 10 per line: capped, explained, no false confirmation", async ({ page }) => {
  const p = await createProduct({ stock: 50 });
  await page.goto(`/products/${p.slug}`);
  await page.getByLabel("Quantity").selectOption("10");
  await page.getByTestId("add-to-cart").click();
  await expect(page.getByTestId("added-confirmation")).toBeVisible();
  await page.getByLabel("Quantity").selectOption("1");
  await page.getByTestId("add-to-cart").click();
  await expect(page.getByTestId("form-error")).toContainText("already have 10");
  await expect(page.getByTestId("added-confirmation")).toHaveCount(0);
  await page.goto("/cart");
  await expect(page.getByTestId("qty-value")).toHaveText("10");
  await expect(page.getByTestId("qty-increase")).toBeDisabled();
  await expect(page.getByTestId("max-note")).toContainText("Maximum of 10");
});

test("E-008 identical items combine; different options or personalization stay separate lines", async ({ page }) => {
  const p = await createProduct({ sizes: { "4": 5, "6": 5 }, personalizable: true });
  await page.goto(`/products/${p.slug}`);
  const add = async () => {
    await page.getByTestId("add-to-cart").click();
    await expect(page.getByTestId("added-confirmation")).toBeVisible();
  };
  await page.getByTestId("value-size-4").click();
  await add();
  await add();
  await page.getByTestId("value-size-6").click();
  await add();
  await page.getByTestId("value-size-4").click();
  await page.getByLabel(/Monogram/).fill("AB");
  await add();
  await page.goto("/cart");
  await expect(page.getByTestId("cart-line")).toHaveCount(3);
  const qtys = await page.getByTestId("qty-value").allInnerTexts();
  expect(qtys.sort()).toEqual(["1", "1", "2"]);
  await expect(page.getByTestId("line-personalization")).toHaveCount(1);
});

test("E-009 decrease disabled at 1; quantity change updates line total and subtotal", async ({ page, context }) => {
  const p = await createProduct({ priceCents: 10000 });
  await preloadCart(context, [{ product: p }]);
  await page.goto("/cart");
  await expect(page.getByTestId("qty-decrease")).toBeDisabled();
  await page.getByTestId("qty-increase").click();
  await expect(page.getByTestId("qty-value")).toHaveText("2");
  await expect(page.getByTestId("line-total")).toHaveText("$200.00");
  await expect(page.getByTestId("subtotal")).toHaveText("$200.00");
  await expect(page.getByTestId("cart-count")).toHaveText("2");
  await page.getByTestId("remove-line").click();
  await expect(page.getByTestId("empty-cart")).toBeVisible();
});

test("E-010 cart works for this visit when storage is blocked, with a notice and no crash", async ({ page, context }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await context.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new DOMException("blocked", "SecurityError");
      },
    });
  });
  const p = await createProduct({});
  await page.goto(`/products/${p.slug}`);
  await page.getByTestId("add-to-cart").click();
  await expect(page.getByTestId("cart-count")).toHaveText("1");
  await expect(page.getByTestId("storage-notice")).toContainText("won't be saved if you close this tab");
  await page.getByRole("link", { name: "View cart" }).first().click();
  await expect(page.getByTestId("cart-line")).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("E-011 other tab's cart count updates without reload", async ({ context }) => {
  const p = await createProduct({});
  const a = await context.newPage();
  const b = await context.newPage();
  await b.goto("/shop");
  await expect(b.getByTestId("cart-count")).toHaveText("0");
  await a.goto(`/products/${p.slug}`);
  await a.getByTestId("add-to-cart").click();
  await expect(a.getByTestId("added-confirmation")).toBeVisible();
  await expect(b.getByTestId("cart-count")).toHaveText("1");
});

test("E-012 cart page refreshes prices on load and tells the shopper", async ({ page, context }) => {
  const p = await createProduct({ priceCents: 12000 });
  await preloadCart(context, [{ product: p, seenPriceCents: 9000 }]);
  await page.goto("/cart");
  await expect(page.getByTestId("price-changed-notice")).toContainText("$90.00 to $120.00");
  await expect(page.getByTestId("unit-price")).toHaveText("$120.00");
  await expect(page.getByTestId("subtotal")).toHaveText("$120.00");
});

test("E-013 shipping appears when an order drops under the free-shipping amount, and cart and checkout agree", async ({ page, context }) => {
  const p = await createProduct({ priceCents: 30000 });
  await preloadCart(context, [{ product: p, quantity: 2 }]);
  await page.goto("/cart");
  await expect(page.getByTestId("subtotal")).toHaveText("$600.00");
  await expect(page.getByTestId("shipping")).toHaveText("Free");
  await page.getByTestId("qty-decrease").click();
  await expect(page.getByTestId("subtotal")).toHaveText("$300.00");
  await expect(page.getByTestId("shipping")).toHaveText("$15.00");
  const cartTotal = await page.getByTestId("total").innerText();
  await page.getByTestId("checkout-link").click();
  await expect(page.getByTestId("shipping")).toHaveText("$15.00");
  await expect(page.getByTestId("total")).toHaveText(cartTotal);
  await expect(page.getByTestId("subtotal")).toHaveText("$300.00");
  await page.getByLabel("Pick up in store").check();
  await expect(page.getByTestId("shipping")).toHaveText("Free");
});

test("E-014 checkout unavailable with an empty cart", async ({ page }) => {
  await page.goto("/checkout");
  await expect(page.getByRole("heading", { name: "There's nothing to check out yet" })).toBeVisible();
  await expect(page.getByTestId("place-order")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Go to the shop" })).toBeVisible();
});

test("E-015 validation: summary links to fields, message under each field, typed values kept; no card fields", async ({ page, context }) => {
  const p = await createProduct({});
  await preloadCart(context, [{ product: p }]);
  await page.goto("/checkout");
  await page.getByTestId("place-order").click();
  const summary = page.getByTestId("error-summary");
  await expect(summary).toBeVisible();
  await expect(page.getByTestId("error-name")).toContainText("Enter your full name");
  await expect(page.getByTestId("error-address1")).toBeVisible();
  await summary.getByRole("link", { name: /full name/i }).click();
  await expect(page.getByLabel("Full name")).toBeFocused();
  await page.getByLabel("Full name").fill("Ada Lovelace");
  await page.getByLabel("Email").fill("not-an-email");
  await page.getByLabel("City").fill("Los Gatos");
  await page.getByTestId("place-order").click();
  await expect(page.getByTestId("error-email")).toContainText("valid email");
  await expect(page.getByLabel("Full name")).toHaveValue("Ada Lovelace");
  await expect(page.getByLabel("City")).toHaveValue("Los Gatos");
  await page.getByLabel("ZIP / postal code").fill("ABC");
  await page.getByTestId("place-order").click();
  await expect(page.getByTestId("error-postalCode")).toContainText("5 digits");
  // no payment fields
  await expect(page.locator("input[autocomplete^='cc-'], input[name*='card' i]")).toHaveCount(0);
});

test("E-016 item becomes unavailable before ordering: item named, Remove offered, no order created", async ({ page, context, request }) => {
  const p = await createProduct({});
  await preloadCart(context, [{ product: p }]);
  await page.goto("/checkout");
  await expect(page.getByTestId("summary-line")).toHaveCount(1);
  await pool.query("update products set status = 'draft' where id = $1", [p.id]);
  const before = await orderCount();
  // the server re-checks every line, even when the page has stale data
  const direct = await post(request, payload(p, tok()));
  expect(direct.status).toBe(409);
  expect(direct.json.kind).toBe("issues");
  await fillCheckout(page);
  await page.getByTestId("place-order").click();
  await expect(page.getByTestId("checkout-line-issue")).toContainText(p.name);
  expect(await orderCount()).toBe(before);
  await page.getByTestId("issue-remove").click();
  await expect(page.getByRole("heading", { name: "There's nothing to check out yet" })).toBeVisible();
});

test("E-017 price changed between cart and order: summary updates, asked to place again, no order at the old price", async ({ page, context }) => {
  const p = await createProduct({ priceCents: 12000 });
  await preloadCart(context, [{ product: p }]);
  await page.goto("/checkout");
  await expect(page.getByTestId("subtotal")).toHaveText("$120.00");
  await fillCheckout(page);
  await pool.query("update products set price_cents = 15000 where id = $1", [p.id]);
  const before = await orderCount();
  await page.getByTestId("place-order").click();
  await expect(page.getByTestId("checkout-banner")).toContainText("price changed");
  await expect(page.getByTestId("subtotal")).toHaveText("$150.00");
  expect(await orderCount()).toBe(before);
  await page.getByTestId("place-order").click();
  await page.waitForURL(/\/order\/AV-/);
  expect(await orderCount()).toBe(before + 1);
  await expect(page.getByTestId("subtotal")).toHaveText("$150.00");
});

test("E-018 same one-time token submitted twice at once gives one order, one confirmation", async ({ request }) => {
  const p = await createProduct({ stock: 5 });
  const token = tok();
  const before = await orderCount();
  const [a, b] = await Promise.all([post(request, payload(p, token)), post(request, payload(p, token))]);
  expect(a.json.ok).toBe(true);
  expect(b.json.ok).toBe(true);
  expect(a.json.reference).toBe(b.json.reference);
  const c = await post(request, payload(p, token));
  expect(c.json.reference).toBe(a.json.reference);
  expect(await orderCount()).toBe(before + 1);
  const stock = (await pool.query("select stock from products where id = $1", [p.id])).rows[0].stock;
  expect(stock).toBe(4); // decremented once, not three times
});

test("E-020 refreshing the confirmation shows the same order and creates nothing; cart is cleared", async ({ page, context }) => {
  const p = await createProduct({});
  await preloadCart(context, [{ product: p }]);
  await page.goto("/checkout");
  await fillCheckout(page);
  await page.getByTestId("place-order").click();
  await page.waitForURL(/\/order\/AV-/);
  const ref = await page.getByTestId("order-reference").innerText();
  const n = await orderCount();
  await page.reload();
  await expect(page.getByTestId("order-reference")).toHaveText(ref);
  await page.reload();
  expect(await orderCount()).toBe(n);
  await expect(page.getByTestId("cart-count")).toHaveText("0");
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("av_cart_v1")!));
  expect(stored.lines).toEqual([]);
});

test("E-021 unknown order reference → 404 with format and a path back to the shop", async ({ page }) => {
  const res = await page.goto("/order/AV-ZZZZZZ");
  expect(res?.status()).toBe(404);
  const nf = page.getByTestId("order-not-found");
  await expect(nf).toContainText("We couldn't find that order");
  await expect(nf).toContainText("AV-");
  await nf.getByRole("link", { name: "Back to the shop" }).click();
  await expect(page).toHaveURL(/\/shop$/);
});

test("E-022 editing, repricing or deleting a product later never changes a past order", async ({ page, request }) => {
  const p = await createProduct({ priceCents: 20000, colors: ["Ink"] });
  const lines = [{ productId: p.id, slug: p.slug, optionValueIds: [p.valueIds.Color.Ink], personalization: "", quantity: 2, seenUnitPriceCents: 20000 }];
  const res = await post(request, payload(p, tok(), { lines }));
  expect(res.json.ok).toBe(true);
  await pool.query("update products set price_cents = 99900, name = 'Renamed' where id = $1", [p.id]);
  await page.goto(`/order/${res.json.reference}`);
  await expect(page.getByTestId("order-item")).toContainText(p.name);
  await expect(page.getByTestId("order-item")).toContainText("$200.00 each");
  await expect(page.getByTestId("order-item")).toContainText("Color: Ink");
  await expect(page.getByTestId("subtotal")).toHaveText("$400.00");
  await pool.query("delete from products where id = $1", [p.id]);
  await page.reload();
  await expect(page.getByTestId("order-item")).toContainText(p.name);
  await expect(page.getByTestId("subtotal")).toHaveText("$400.00");
});

test("E-023 two shoppers buying the last piece at once: exactly one succeeds, the other is told", async ({ request }) => {
  const p = await createProduct({ stock: 1 });
  const [a, b] = await Promise.all([post(request, payload(p, tok())), post(request, payload(p, tok()))]);
  const oks = [a, b].filter((r) => r.json.ok);
  const lost = [a, b].filter((r) => !r.json.ok);
  expect(oks).toHaveLength(1);
  expect(lost).toHaveLength(1);
  expect(lost[0].status).toBe(409);
  expect(lost[0].json.kind).toBe("issues");
  expect(lost[0].json.message).toMatch(/sold out|left/i);
  const row = (await pool.query("select stock from products where id = $1", [p.id])).rows[0];
  expect(row.stock).toBe(0);
  const n = (await pool.query("select count(*)::int n from order_items where product_id = $1", [p.id])).rows[0].n;
  expect(n).toBe(1);
});

test("E-023b per-size stock: buying a size decrements only that size", async ({ request }) => {
  const p = await createProduct({ sizes: { "4": 2, "6": 3 } });
  const line = { productId: p.id, slug: p.slug, optionValueIds: [p.valueIds.Size["4"]], personalization: "", quantity: 2, seenUnitPriceCents: p.priceCents };
  const res = await post(request, payload(p, tok(), { lines: [line] }));
  expect(res.json.ok).toBe(true);
  const rows = (await pool.query("select value, stock from product_option_values where option_id = (select id from product_options where product_id = $1)", [p.id])).rows;
  expect(Object.fromEntries(rows.map((r: { value: string; stock: number }) => [r.value, r.stock]))).toEqual({ "4": 0, "6": 3 });
  expect((await pool.query("select stock from products where id = $1", [p.id])).rows[0].stock).toBe(3);
  const again = await post(request, payload(p, tok(), { lines: [line] }));
  expect(again.status).toBe(409);
});

test("E-033 owner sells out an item that is in a cart: checkout names it and offers to remove it", async ({ page, context }) => {
  const p = await createProduct({});
  await preloadCart(context, [{ product: p }]);
  await page.goto("/checkout");
  await expect(page.getByTestId("summary-line")).toHaveCount(1);
  await pool.query("update products set stock = 0 where id = $1", [p.id]);
  await page.reload();
  await expect(page.getByTestId("checkout-line-issue")).toContainText(`${p.name} is sold out`);
  const before = await orderCount();
  await fillCheckout(page);
  await page.getByTestId("place-order").click();
  await expect(page.getByTestId("checkout-banner")).toContainText("Nothing was ordered");
  expect(await orderCount()).toBe(before);
  await expect(page.getByRole("button", { name: new RegExp(`Remove ${p.name}`) })).toBeVisible();
});

test("E-026 / E-027 confirmation says nothing will ship and no email is sent (no order tools or email in this version)", async ({ page, context }) => {
  const p = await createProduct({});
  await preloadCart(context, [{ product: p }]);
  await page.goto("/checkout");
  await fillCheckout(page);
  await page.getByTestId("place-order").click();
  await page.waitForURL(/\/order\/AV-/);
  await expect(page.getByTestId("demo-order-notice")).toContainText("nothing will be shipped");
  await expect(page.getByTestId("demo-order-notice")).toContainText("no");
  await expect(page.getByTestId("demo-order-notice")).toContainText("email");
});

test("E-028 returns page tells shoppers how to cancel or get a refund (email the studio)", async ({ page }) => {
  await page.goto("/returns");
  await expect(page.getByRole("link", { name: "Contact the studio" }).first()).toBeVisible();
  await expect(page.getByTestId("policy-demo-notice")).toContainText("No real returns or refunds are processed");
});
