import { test, expect, fillCheckout, orderCount, pool, cleanup } from "./helpers";

test.afterAll(async () => {
  await cleanup();
  await pool.end();
});

test("discover-and-purchase journey: home → catalog → product → cart → checkout → confirmation", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.getByRole("link", { name: "Shop new arrivals" }).click();
  await expect(page.getByTestId("product-card").first()).toBeVisible();

  // open the Aldine Wrap Dress
  await page.goto("/shop");
  await page.getByRole("link", { name: /Aldine Wrap Dress/ }).click();
  await expect(page.getByTestId("product-name")).toHaveText("Aldine Wrap Dress");
  await page.getByTestId("value-size-4").click();
  await page.getByTestId("add-to-cart").click();
  await expect(page.getByTestId("added-confirmation")).toBeVisible();
  await expect(page.getByTestId("cart-count")).toHaveText("1");

  await page.getByRole("link", { name: "View cart" }).first().click();
  await expect(page.getByTestId("cart-line")).toHaveCount(1);
  await expect(page.getByTestId("line-options")).toContainText("Size: 4");
  const subtotal = await page.getByTestId("subtotal").innerText();
  expect(subtotal).toBe("$385.00");

  await page.getByTestId("checkout-link").click();
  await expect(page.getByTestId("demo-notice")).toContainText("simulation");
  await fillCheckout(page);
  const before = await orderCount();
  await page.getByTestId("place-order").click();
  await page.waitForURL(/\/order\/AV-/);
  expect(await orderCount()).toBe(before + 1);
  await expect(page.getByTestId("order-reference")).toHaveText(/^AV-[A-Z0-9]{6}$/);
  await expect(page.getByTestId("demo-order-notice")).toBeVisible();
  await expect(page.getByTestId("order-item")).toContainText("Aldine Wrap Dress");
  await expect(page.getByTestId("order-item")).toContainText("Size: 4");
  await expect(page.getByTestId("total")).toHaveText("$433.69"); // 385 + 15 shipping + 8.75% tax (33.69)
  await expect(page.getByTestId("cart-count")).toHaveText("0");
});
