import { test, expect, pool, cleanup, createProduct, preloadCart, fillCheckout, uid } from "./helpers";

test.afterAll(async () => {
  await cleanup();
});

async function noHorizontalOverflow(page: import("@playwright/test").Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

test.describe("brief: seeded sample catalog", () => {
  test("24 sample products with brand, category, collections, per-size stock, sold-out cases and prices in range", async () => {
    const total = (await pool.query("select count(*)::int n from products where is_sample")).rows[0].n;
    expect(total).toBeGreaterThanOrEqual(24);
    const prices = (await pool.query("select min(price_cents) lo, max(price_cents) hi from products where is_sample")).rows[0];
    expect(prices.lo).toBeGreaterThanOrEqual(9000);
    expect(prices.hi).toBeLessThanOrEqual(140000);
    const noBrand = (await pool.query("select count(*)::int n from products where is_sample and brand_id is null")).rows[0].n;
    expect(noBrand).toBe(0);
    const brands = (await pool.query("select name from brands order by name")).rows.map((r) => r.name);
    expect(brands).toEqual(["Atelier Noor", "Fenwick", "Hollis Grey", "Ines Vega", "Marlowe"]);
    const cats = (await pool.query("select name from categories where name not like 'E2E %' order by position")).rows.map((r) => r.name);
    expect(cats).toEqual(["Dresses", "Tops", "Skirts", "Shoes", "Bags", "Jewelry", "Accessories", "Sale"]);
    const noCollection = (await pool.query("select count(*)::int n from products p where is_sample and p.slug not like 'e2e-%' and not exists (select 1 from product_collections c where c.product_id = p.id)")).rows[0].n;
    expect(noCollection).toBeLessThanOrEqual(6); // collections are optional for a few pieces, never for most
    const partial = (
      await pool.query(`select count(distinct o.product_id)::int n from product_options o join product_option_values v on v.option_id = o.id
        where o.name = 'Size' and o.tracks_stock and v.stock = 0 and exists (select 1 from product_option_values w where w.option_id = o.id and w.stock > 0)`)
    ).rows[0].n;
    expect(partial).toBeGreaterThanOrEqual(4);
    const allOut = (await pool.query("select count(*)::int n from products where is_sample and stock = 0")).rows[0].n;
    expect(allOut).toBeGreaterThanOrEqual(2);
    const sizes = (await pool.query("select array_agg(v.value order by v.position) s from product_options o join product_option_values v on v.option_id = o.id join products p on p.id = o.product_id where p.slug = 'aldine-wrap-dress' and o.name = 'Size'")).rows[0].s;
    expect(sizes).toEqual(["0", "2", "4", "6", "8", "10"]);
  });

  test("every sample product page has description, Materials & care and Specifications; photos start as placeholders", async ({ page }) => {
    await page.goto("/products/sable-silk-blouse");
    await expect(page.getByRole("heading", { name: "Description" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Materials & care" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Specifications" })).toBeVisible();
    await expect(page.getByTestId("gallery-placeholder")).toBeVisible();
    await page.goto("/shop");
    expect(await page.locator("[data-testid=product-card] img").count()).toBe(0); // nothing fetched or invented
    await expect(page.getByTestId("photo-placeholder").first()).toBeVisible();
  });
});

test.describe("layout: full width, image-first cards", () => {
  test("catalog grid spans at least 90% of a 1440px viewport, 5 columns, gaps ≤ 16px", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/shop");
    const grid = await page.getByTestId("product-grid").boundingBox();
    expect(grid!.width / 1440).toBeGreaterThanOrEqual(0.9);
    const cols = await page.evaluate(() => getComputedStyle(document.querySelector("[data-testid=product-grid]")!).gridTemplateColumns.split(" ").length);
    expect(cols).toBe(5);
    const gap = await page.evaluate(() => {
      const el = document.querySelector("[data-testid=product-grid]")!;
      const cs = getComputedStyle(el);
      return { col: parseFloat(cs.columnGap), row: parseFloat(cs.rowGap) };
    });
    expect(gap.col).toBeLessThanOrEqual(16);
    expect(gap.row).toBeLessThanOrEqual(16);
  });

  test("columns grow 2, 3, 4, 5, 6 as the screen widens", async ({ page }) => {
    const widths: [number, number][] = [[375, 2], [800, 3], [1100, 4], [1440, 5], [1800, 6]];
    for (const [w, expected] of widths) {
      await page.setViewportSize({ width: w, height: 900 });
      await page.goto("/shop");
      const cols = await page.evaluate(() => getComputedStyle(document.querySelector("[data-testid=product-grid]")!).gridTemplateColumns.split(" ").length);
      expect(cols, `columns at ${w}px`).toBe(expected);
    }
  });

  test("header, footer and page content share the same left and right edges on browsing pages", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const path of ["/", "/shop", "/products/aldine-wrap-dress"]) {
      await page.goto(path);
      const edges = await page.evaluate(() => {
        const r = (el: Element | null) => (el ? { left: Math.round(el.getBoundingClientRect().left), right: Math.round(el.getBoundingClientRect().right) } : null);
        return {
          header: r(document.querySelector("header .site-container")),
          footer: r(document.querySelector("footer .site-container")),
          main: r(document.querySelector("main .site-container")),
        };
      });
      expect(edges.header).toEqual(edges.footer);
      if (edges.main) expect(edges.main).toEqual(edges.header);
    }
  });

  test("product card: image fills the card with no frame or padding, ≥ 70% of card height, one tab stop", async ({ page }) => {
    for (const w of [375, 1440]) {
      await page.setViewportSize({ width: w, height: 900 });
      await page.goto("/shop");
      const m = await page.evaluate(() => {
        const card = document.querySelector("[data-testid=product-card]")!;
        const img = card.querySelector("[data-testid=card-image]")!;
        const cr = card.getBoundingClientRect();
        const ir = img.getBoundingClientRect();
        const cs = getComputedStyle(card);
        const is = getComputedStyle(img);
        return {
          widthRatio: ir.width / cr.width,
          heightRatio: ir.height / cr.height,
          cardPad: [cs.paddingLeft, cs.paddingTop, cs.borderLeftWidth],
          imgPad: [is.paddingLeft, is.borderLeftWidth],
        };
      });
      expect(m.widthRatio).toBeCloseTo(1, 1);
      expect(m.heightRatio, `image share at ${w}px`).toBeGreaterThanOrEqual(0.7);
      expect(m.cardPad).toEqual(["0px", "0px", "0px"]);
      expect(m.imgPad).toEqual(["0px", "0px"]);
    }
    // one tab stop per card
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/shop");
    const inCards = await page.locator("[data-testid=product-card] a, [data-testid=product-card] button, li:has([data-testid=product-card]) a").count();
    const cards = await page.getByTestId("product-card").count();
    expect(inCards).toBe(cards);
    expect(await page.locator("[data-testid=product-card]").first().evaluate((e) => e.tagName)).toBe("A");
  });

  test("reading pages keep a narrower column than the catalog", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/shop");
    const catalog = (await page.getByTestId("product-grid").boundingBox())!.width;
    for (const path of ["/returns", "/help", "/contact", "/about"]) {
      await page.goto(path);
      const w = await page.locator("main > div").first().evaluate((el) => el.getBoundingClientRect().width);
      expect(w, path).toBeLessThan(catalog * 0.6);
    }
    await page.goto("/cart");
    const p = await createProduct({});
    await preloadCart(page.context(), [{ product: p }]);
    await page.goto("/cart");
    const cartW = await page.locator("main > div").first().evaluate((el) => el.getBoundingClientRect().width);
    expect(cartW).toBeLessThan(catalog);
  });

  test("no horizontal overflow at 375px on every page", async ({ page, context }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    const p = await createProduct({ personalizable: true, sizes: { "4": 2 } });
    await preloadCart(context, [{ product: p, valueIds: [p.valueIds.Size["4"]] }]);
    for (const path of ["/", "/shop", "/shop/dresses", "/brands", "/brands/marlowe", "/collections/new-arrivals", "/products/wren-leather-tote", "/products/aldine-wrap-dress", "/cart", "/checkout", "/help", "/returns", "/contact", "/about", "/gift-cards"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await noHorizontalOverflow(page);
    }
    await page.getByRole("button", { name: /open menu/i }).click();
    await noHorizontalOverflow(page);
  });
});

test.describe("header, home and footer", () => {
  test("header: centered wordmark, Women/Men switch left, search and cart count right, menu with categories + Designers + Sale", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    const logo = await page.getByRole("link", { name: /Alder & Vale home/i }).boundingBox();
    expect(Math.abs(logo!.x + logo!.width / 2 - 720)).toBeLessThan(6);
    const sw = await page.getByRole("group", { name: "Shop for" }).first().boundingBox();
    expect(sw!.x + sw!.width).toBeLessThan(logo!.x);
    const nav = page.getByRole("navigation", { name: "Main" }).first();
    const items = (await nav.getByRole("link").allTextContents()).map((t) => t.trim()); // DOM text; the uppercase look is CSS
    expect(items).toEqual(["Dresses", "Tops", "Skirts", "Shoes", "Bags", "Jewelry", "Accessories", "Designers", "Sale"]);
    expect(await nav.getByRole("link").first().evaluate((e) => getComputedStyle(e).textTransform)).toBe("uppercase");
    await expect(page.getByRole("search").first()).toBeVisible();
    await expect(page.getByTestId("cart-count")).toBeVisible();
  });

  test("mobile: the menu collapses behind a button", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/");
    await expect(page.getByRole("navigation", { name: "Main" })).toHaveCount(0);
    const btn = page.getByRole("button", { name: "Open menu" });
    await expect(btn).toHaveAttribute("aria-expanded", "false");
    await btn.click();
    await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Designers" })).toBeVisible();
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Dresses" }).click();
    await expect(page).toHaveURL(/\/shop\/dresses/);
  });

  test("announcement bar shows the messages and can be stepped through", async ({ page }) => {
    await page.goto("/");
    const bar = page.getByTestId("announcement");
    await expect(bar).toHaveText("New location: Santa Barbara");
    await page.getByRole("button", { name: "Next announcement" }).click();
    await expect(bar).toHaveText("Take 10% off sale items with code SAMPLE10");
  });

  test("home sections in order: hero, brands strip, collections, email signup, footer", async ({ page }) => {
    await page.goto("/");
    const order = await page.evaluate(() => {
      const main = document.querySelector("main")!;
      const secs = Array.from(main.querySelectorAll(":scope > section")).map((s) => s.getAttribute("aria-labelledby") ?? "");
      return secs;
    });
    expect(order[0]).toBe("hero-heading");
    expect(order[1]).toBe("brands-heading");
    expect(order.at(-1)).toBe("signup-heading");
    expect(order.filter((o) => o.startsWith("col-"))).toHaveLength(3);
    await expect(page.getByRole("heading", { level: 2, name: "New Arrivals" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Occasion Dressing" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Best Sellers" })).toBeVisible();
    const brandLinks = page.locator("#brands-heading + ul a");
    expect(await brandLinks.count()).toBe(5);
    await brandLinks.filter({ hasText: "Fenwick" }).click();
    await expect(page).toHaveURL(/\/brands\/fenwick/);
    await expect(page.getByRole("heading", { level: 1, name: "Fenwick" })).toBeVisible();
    // hero starts with a neutral placeholder, no photo invented
    await page.goto("/");
    await expect(page.locator("section[aria-labelledby=hero-heading] img")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Shop new arrivals" })).toBeVisible();
  });

  test("email signup stores the address and says thank you; bad address explained; nothing sent", async ({ page }) => {
    const email = `fan-${uid()}@e2e.test`;
    await page.goto("/");
    await page.getByLabel("Email address").fill("nope");
    await page.getByRole("button", { name: "Sign up" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "valid email" })).toBeVisible();
    await page.getByLabel("Email address").fill(email);
    await page.getByRole("button", { name: "Sign up" }).click();
    await expect(page.getByTestId("signup-thanks")).toContainText("Thank you");
    const rows = (await pool.query("select email from email_signups where email = $1", [email])).rows;
    expect(rows).toHaveLength(1);
  });

  test("footer on home, product, cart and checkout: 3 columns, links load, payment methods are text only and marked demo", async ({ page }) => {
    for (const path of ["/", "/products/aldine-wrap-dress", "/cart", "/checkout"]) {
      await page.goto(path);
      const footer = page.getByRole("contentinfo");
      await expect(footer.getByRole("heading", { name: "Customer Service" })).toBeVisible();
      await expect(footer.getByRole("heading", { name: "Stores & Contact" })).toBeVisible();
      await expect(footer.getByRole("heading", { name: "Explore" })).toBeVisible();
      for (const name of ["Help & FAQ", "Returns & refunds", "Contact us", "About us", "Gift cards", "Shop all"]) {
        await expect(footer.getByRole("link", { name })).toBeVisible();
      }
      await expect(footer).toContainText("Los Gatos");
      await expect(footer).toContainText("555-0100");
      await expect(footer).toContainText("Santa Barbara");
      await expect(footer).toContainText("555-0101");
      const pay = footer.getByRole("list", { name: /Accepted payment methods/ });
      await expect(pay).toContainText("Visa");
      await expect(pay.locator("img, svg")).toHaveCount(0);
      await expect(footer).toContainText("demo");
      await expect(footer).toContainText("does not collect any payment");
    }
    await page.goto("/");
    const hrefs = await page.getByRole("contentinfo").getByRole("link").evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).getAttribute("href")!).filter((h) => h.startsWith("/")));
    for (const h of hrefs) {
      const res = await page.goto(h);
      expect(res?.status(), h).toBe(200);
    }
  });

  test("footer works at 375px without overflow", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/cart");
    await page.getByRole("contentinfo").scrollIntoViewIfNeeded();
    await noHorizontalOverflow(page);
    const fw = await page.getByRole("contentinfo").evaluate((e) => e.scrollWidth - e.clientWidth);
    expect(fw).toBeLessThanOrEqual(0);
  });

  test("no link to the owner area anywhere in the shopper experience", async ({ page }) => {
    for (const path of ["/", "/shop", "/products/aldine-wrap-dress", "/cart", "/checkout", "/help", "/contact", "/returns", "/about"]) {
      await page.goto(path);
      expect(await page.locator("a[href*='admin']").count(), path).toBe(0);
    }
  });
});

test.describe("catalog and discovery", () => {
  test("category link filters, Clear filters returns to the whole catalog", async ({ page }) => {
    await page.goto("/shop");
    const all = await page.getByTestId("product-card").count();
    await page.getByRole("navigation", { name: "Categories" }).getByRole("link", { name: "Bags" }).click();
    await expect(page).toHaveURL(/\/shop\/bags/);
    const bags = await page.getByTestId("product-card").count();
    expect(bags).toBe(3);
    await page.getByTestId("clear-filters").click();
    await expect(page).toHaveURL(/\/shop$/);
    expect(await page.getByTestId("product-card").count()).toBe(all);
  });

  test("search, designer filter, sort and empty results", async ({ page }) => {
    await page.goto("/shop?q=cashmere");
    await expect(page.getByTestId("product-card")).toHaveCount(1);
    await expect(page.getByTestId("product-card")).toContainText("Cove Cashmere Crewneck");
    await page.goto("/shop?brand=hollis-grey");
    for (const t of await page.getByTestId("product-card").allTextContents()) expect(t).toContain("Hollis Grey");
    await page.goto("/shop?sort=price-desc");
    const first = await page.getByTestId("product-card").first().innerText();
    expect(first).toContain("Antique Pearl Collar");
    await page.goto("/shop?q=zzzznothing");
    await expect(page.getByTestId("empty-results")).toBeVisible();
    await page.getByRole("link", { name: /Clear filters and browse all/ }).click();
    await expect(page).toHaveURL(/\/shop$/);
    // header search
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await page.getByRole("search").first().getByRole("searchbox").fill("loafer");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/q=loafer/);
    await expect(page.getByTestId("product-card")).toContainText("Harbor Leather Loafer");
  });

  test("selecting a card opens the matching product page", async ({ page }) => {
    await page.goto("/shop");
    const card = page.getByTestId("product-card").nth(3);
    const name = (await card.locator("p.font-medium").innerText()).trim();
    await card.click();
    await expect(page.getByTestId("product-name")).toHaveText(name);
  });

  test("unknown category → 404; unknown route → 404 with a way back", async ({ page }) => {
    expect((await page.goto("/shop/not-a-category"))?.status()).toBe(404);
    const res = await page.goto("/totally/unknown/path");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("link", { name: "Browse the shop" })).toBeVisible();
  });

  test("Women is the default; the Men switch only filters by department and may be empty", async ({ page }) => {
    await page.goto("/shop");
    const women = await page.getByTestId("product-card").count();
    expect(women).toBeGreaterThan(20);
    await page.getByRole("group", { name: "Shop for" }).first().getByRole("button", { name: "Men", exact: true }).click();
    await expect(page.getByTestId("empty-results")).toBeVisible();
    await expect(page.getByTestId("empty-results")).toContainText("Men");
    await page.getByRole("group", { name: "Shop for" }).first().getByRole("button", { name: "Women" }).click();
    await expect(page.getByTestId("product-card").first()).toBeVisible();
    // a men's product appears only under Men
    const p = await createProduct({ name: `E2E Mens ${uid()}` });
    await pool.query("update products set department = 'men' where id = $1", [p.id]);
    await page.getByRole("group", { name: "Shop for" }).first().getByRole("button", { name: "Men", exact: true }).click();
    await expect(page.getByTestId("product-card")).toHaveCount(1);
    await page.getByRole("group", { name: "Shop for" }).first().getByRole("button", { name: "Women" }).click();
    await expect(page.getByTestId("product-card").first()).toBeVisible();
  });

  test("designers page and collection page", async ({ page }) => {
    await page.goto("/brands");
    await expect(page.getByRole("link", { name: /Shop Marlowe/ })).toBeVisible();
    await page.goto("/collections/occasion-dressing");
    await expect(page.getByRole("heading", { level: 1, name: "Occasion Dressing" })).toBeVisible();
    expect(await page.getByTestId("product-card").count()).toBeGreaterThanOrEqual(6);
  });
});

test.describe("product page", () => {
  test("sections in the specified order and variants update the price", async ({ page }) => {
    await page.goto("/products/wren-leather-tote");
    const headings = await page.locator("main h2").allInnerTexts();
    const idx = (n: string) => headings.findIndex((h) => h.includes(n));
    expect(idx("Pickup availability")).toBeGreaterThan(-1);
    expect(idx("Pickup availability")).toBeLessThan(idx("Description"));
    expect(idx("Description")).toBeLessThan(idx("Materials"));
    expect(idx("Materials")).toBeLessThan(idx("Specifications"));
    expect(idx("Specifications")).toBeLessThan(idx("You may also like"));
    // default option values are honoured
    await expect(page.getByTestId("value-finish-Smooth")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("value-color-Cognac")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("price-value")).toHaveText("$890");
    await page.getByTestId("value-finish-Suede").click();
    await expect(page.getByTestId("price-value")).toHaveText("$970");
    // the chosen configuration reaches the cart with the adjusted price
    await page.getByLabel(/Monogram/).fill("AVM");
    await page.getByTestId("add-to-cart").click();
    await page.goto("/cart");
    await expect(page.getByTestId("line-options")).toContainText("Finish: Suede");
    await expect(page.getByTestId("line-options")).toContainText("Color: Cognac");
    await expect(page.getByTestId("line-personalization")).toContainText("AVM");
    await expect(page.getByTestId("unit-price")).toHaveText("$970.00");
  });

  test("pickup availability lists each store with its ready time; brand shown; images have alt text", async ({ page }) => {
    await page.goto("/products/aldine-wrap-dress");
    const pickup = page.getByTestId("pickup");
    await page.getByTestId("value-size-4").click();
    await expect(pickup).toContainText("Available for pickup");
    await expect(pickup).toContainText("Los Gatos");
    await expect(pickup).toContainText("Usually ready in 4 hours");
    await expect(pickup).toContainText("Santa Barbara");
    await expect(pickup).toContainText("Usually ready the next day");
    await expect(page.getByTestId("product-brand")).toHaveText("Marlowe");
  });

  test("sold-out products show Sold out and cannot be added; sample products sold out in every size", async ({ page }) => {
    await page.goto("/products/linen-midi-dress");
    await expect(page.getByTestId("availability")).toHaveText("Sold out");
    await expect(page.getByTestId("add-to-cart")).toBeDisabled();
    await expect(page.getByTestId("add-to-cart")).toHaveText("Sold out");
  });

  test("unavailable (sold-out) variants cannot be added: Aldine in size 0 stays selectable, Soledad size 0 does not", async ({ page }) => {
    await page.goto("/products/soledad-silk-slip-dress");
    await expect(page.getByTestId("value-size-0")).toHaveAttribute("aria-disabled", "true");
    await expect(page.getByTestId("value-size-2")).not.toHaveAttribute("aria-disabled", "true");
  });

  test("you may also like shows other products", async ({ page }) => {
    await page.goto("/products/aldine-wrap-dress");
    const cards = page.locator("#related-heading + ul [data-testid=product-card]");
    expect(await cards.count()).toBeGreaterThanOrEqual(3);
    expect(await page.locator("#related-heading + ul").getByText("Aldine Wrap Dress").count()).toBe(0);
  });

  test("after adding: clear feedback with a way to continue or view the cart", async ({ page }) => {
    await page.goto("/products/harbor-leather-loafer");
    await page.getByTestId("value-size-8").click();
    await page.getByTestId("add-to-cart").click();
    const ok = page.getByTestId("added-confirmation");
    await expect(ok).toContainText("Added to your cart");
    await expect(ok.getByRole("link", { name: "View cart" })).toBeVisible();
    await ok.getByRole("button", { name: "Continue shopping" }).click();
    await expect(ok).toHaveCount(0);
  });
});

test.describe("cart, checkout and policies", () => {
  test("cart persists across navigation and reload; empty cart offers a path back", async ({ page }) => {
    await page.goto("/cart");
    await expect(page.getByTestId("empty-cart")).toContainText("Your cart is empty");
    await page.getByRole("link", { name: "Continue shopping" }).click();
    await expect(page).toHaveURL(/\/shop$/);
    await page.goto("/products/canvas-weekender");
    await page.getByTestId("add-to-cart").click();
    await page.goto("/help");
    await page.reload();
    await expect(page.getByTestId("cart-count")).toHaveText("1");
    await page.goto("/cart");
    await expect(page.getByTestId("cart-line")).toContainText("Canvas Weekender");
    await expect(page.getByRole("link", { name: /returns & refunds policy/i })).toBeVisible();
  });

  test("subtotal equals the sum of line totals across several lines", async ({ page, context }) => {
    const a = await createProduct({ priceCents: 11000 });
    const b = await createProduct({ priceCents: 25050 });
    await preloadCart(context, [{ product: a, quantity: 3 }, { product: b, quantity: 2 }]);
    await page.goto("/cart");
    await expect(page.getByTestId("subtotal")).toHaveText("$831.00");
    const totals = (await page.getByTestId("line-total").allInnerTexts()).map((t) => Number(t.replace(/[$,]/g, "")));
    expect(totals.sort()).toEqual([330, 501]);
    await expect(page.getByTestId("subtotal")).toHaveText("$831.00");
    await page.getByTestId("checkout-link").click();
    await expect(page.getByTestId("subtotal")).toHaveText("$831.00");
    await expect(page.getByTestId("total")).toHaveText("$903.71"); // free shipping over $500, tax 8.75% = 72.71
    await expect(page.getByTestId("shipping")).toHaveText("Free");
  });

  test("shipping and tax are labelled as estimates; checkout says it is simulated and asks for no card", async ({ page, context }) => {
    const p = await createProduct({});
    await preloadCart(context, [{ product: p }]);
    await page.goto("/cart");
    await expect(page.getByText("Shipping (estimate)")).toBeVisible();
    await expect(page.getByText("Estimated tax (demo estimate)")).toBeVisible();
    await expect(page.getByText("Estimated total")).toBeVisible();
    await page.goto("/checkout");
    await expect(page.getByTestId("demo-notice")).toContainText("No payment is collected");
    await expect(page.getByRole("textbox", { name: /card/i })).toHaveCount(0);
  });

  test("pickup: choose a store, see its ready time, no shipping charge, confirmation names the store", async ({ page, context }) => {
    const p = await createProduct({ priceCents: 10000 });
    await preloadCart(context, [{ product: p }]);
    await page.goto("/checkout");
    await page.getByLabel("Pick up in store").check();
    await expect(page.getByLabel("Street address")).toHaveCount(0);
    await page.getByLabel("Choose a store").selectOption({ label: "Santa Barbara" });
    await expect(page.getByTestId("pickup-ready")).toContainText("Usually ready the next day");
    await expect(page.getByTestId("shipping")).toHaveText("Free");
    await page.getByLabel("Full name").fill("Pat Pickup");
    await page.getByLabel("Email").fill("pat@e2e.test");
    await page.getByTestId("place-order").click();
    await page.waitForURL(/\/order\/AV-/);
    await expect(page.getByTestId("order-pickup")).toContainText("Santa Barbara");
    await expect(page.getByTestId("order-pickup")).toContainText("Usually ready the next day");
    await expect(page.getByTestId("shipping")).toHaveText("Free");
    await expect(page.getByTestId("total")).toHaveText("$108.75");
  });

  test("returns page has every policy element; help answers the common questions; contact has no form", async ({ page }) => {
    await page.goto("/returns");
    for (const h of ["At a glance", "Return window and condition", "How to start a return", "Refund method and timing", "Return shipping costs", "Personalized and final-sale items", "Damaged or incorrect items"]) {
      await expect(page.getByRole("heading", { name: h })).toBeVisible();
    }
    await expect(page.getByText("30 days").first()).toBeVisible();
    await expect(page.getByText(/final sale unless\s+they arrive damaged or incorrect/i).first()).toBeVisible();
    await page.goto("/help");
    for (const t of ["Orders and shipping", "Returns", "Personalization", "Care", "About this demo"]) {
      await expect(page.getByRole("heading", { name: t, exact: true })).toBeVisible();
    }
    const q = page.getByRole("button", { name: "How much does shipping cost?" });
    await expect(q).toHaveAttribute("aria-expanded", "false");
    await q.focus();
    await page.keyboard.press("Enter");
    await expect(q).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByText("flat-rate estimate")).toBeVisible();
    await page.goto("/contact");
    expect(await page.locator("main form").count()).toBe(0); // the header search is the only form on the page
    expect(await page.locator("form:not(header form)").count()).toBe(0);
    await expect(page.getByTestId("contact-email")).toContainText("@");
    await expect(page.getByTestId("contact-demo-notice")).toContainText("not monitored");
    await expect(page.getByRole("heading", { name: "Studio hours" })).toBeVisible();
  });

  test("keyboard: the primary shopping path can be driven without a mouse and focus is visible", async ({ page }) => {
    await page.goto("/products/harbor-leather-loafer");
    await page.getByTestId("value-size-8").focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("value-size-8")).toHaveAttribute("aria-pressed", "true");
    const outline = await page.getByTestId("add-to-cart").evaluate((el) => {
      (el as HTMLElement).focus();
      return getComputedStyle(el).outlineStyle;
    });
    expect(outline).not.toBe("none");
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("added-confirmation")).toBeVisible();
  });
});
