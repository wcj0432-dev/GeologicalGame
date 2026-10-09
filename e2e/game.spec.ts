import { test, expect, type Page } from "@playwright/test";
async function target(page: Page, t: number) {
  await page.getByRole("slider", { name: "目标温度" }).evaluate((el, value) => {
    const input = el as HTMLInputElement;
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, String(value));
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, t);
  await page.getByRole("button", { name: "冷却至目标温度" }).click();
}
async function remove(page: Page, name: string) {
  await page.getByRole("combobox", { name: "分离矿物" }).selectOption(name);
  await page.getByRole("slider", { name: "分离比例" }).evaluate((el) => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(el, "100");
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.getByRole("button", { name: "分离已形成晶体" }).click();
}
test("四关真实交互通关、记录比较、重载与重置", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "快速 · 近地表" }).click();
  await page.getByRole("button", { name: "开始自动冷却" }).click();
  await expect(page.locator(".temperature")).toContainText("650", {
    timeout: 20000,
  });
  await page.getByRole("button", { name: "记录岩石样品" }).click();
  await page.getByRole("button", { name: "实验室 B" }).click();
  await page.getByRole("button", { name: "缓慢 · 地下" }).click();
  await page.getByRole("button", { name: "开始自动冷却" }).click();
  await expect(page.locator(".temperature")).toContainText("650", {
    timeout: 20000,
  });
  await expect(page.getByText("研究目标达成")).toBeVisible();
  await page.getByRole("button", { name: "记录岩石样品" }).click();
  await page.getByRole("checkbox").nth(0).check();
  await page.getByRole("checkbox").nth(1).check();
  await expect(
    page.getByRole("columnheader", { name: "对比 / wt.%" }),
  ).toBeVisible();
  await page
    .locator("nav")
    .getByRole("button", { name: /谁先结晶/ })
    .click();
  await target(page, 1000);
  await expect(page.getByText("研究目标达成")).toBeVisible();
  await page
    .locator("nav")
    .getByRole("button", { name: /把晶体捞出来/ })
    .click();
  await target(page, 1100);
  await remove(page, "olivine");
  await remove(page, "pyroxene");
  await target(page, 1000);
  await page.getByRole("button", { name: "实验室 B" }).click();
  await target(page, 1000);
  await expect(page.getByText("研究目标达成")).toBeVisible();
  await page
    .locator("nav")
    .getByRole("button", { name: /一份岩浆，两份宝藏/ })
    .click();
  await target(page, 1150);
  await remove(page, "olivine");
  await target(page, 1050);
  await expect(page.getByText("研究目标达成")).toBeVisible();
  await page.getByRole("button", { name: "收集堆晶记录" }).click();
  await expect(page.locator(".records")).toContainText("堆晶产物");
  await page.reload();
  await expect(page.locator(".temperature")).toContainText("1050");
  await page.getByRole("button", { name: "重置当前实验室" }).click();
  await expect(page.locator(".temperature")).toContainText("1300");
  expect(errors).toEqual([]);
});
