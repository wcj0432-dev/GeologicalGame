import { test, expect, type Page } from "@playwright/test";
async function slide(page: Page, name: string, value: number) {
  await page
    .getByRole("slider", { name, exact: true })
    .evaluate((el, value) => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!.call(el, String(value));
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }, value);
}
async function cool(page: Page, t: number) {
  await slide(page, "目标温度", t);
  await page
    .getByRole("button", { name: "冷却至目标温度", exact: true })
    .click();
}
test("第五关：通过真实操作提交两组证据，分支并重载", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page
    .locator("nav")
    .getByRole("button", { name: /未知样品/ })
    .click();
  await page
    .getByRole("button", { name: "快速 · 近地表", exact: true })
    .click();
  await cool(page, 650);
  await page.getByRole("button", { name: "记录岩石样品" }).click();
  await page.getByRole("button", { name: "实验室 B", exact: true }).click();
  await page.getByRole("button", { name: "缓慢 · 地下", exact: true }).click();
  await cool(page, 650);
  await page.getByRole("button", { name: "记录岩石样品" }).click();
  await page.getByRole("button", { name: "重置当前实验室" }).click();
  await cool(page, 1000);
  await page.getByRole("button", { name: "记录残余熔体", exact: true }).click();
  await page.getByRole("button", { name: "实验室 A", exact: true }).click();
  await page.getByRole("button", { name: "重置当前实验室" }).click();
  await cool(page, 1100);
  await slide(page, "分离比例", 100);
  for (const m of ["olivine", "pyroxene"]) {
    await page
      .getByRole("combobox", { name: "分离矿物", exact: true })
      .selectOption(m);
    await page.getByRole("button", { name: "分离已形成晶体" }).click();
  }
  await cool(page, 1000);
  await page.getByRole("button", { name: "记录残余熔体", exact: true }).click();
  await page.getByRole("button", { name: "研究板", exact: true }).click();
  for (const [name, index] of [
    ["结构证词 · 样品一", 1],
    ["结构证词 · 样品二", 2],
    ["分离证词 · 保留晶体", 3],
    ["分离证词 · 移走晶体", 4],
    ["与未知报告相容的液相", 4],
  ] as const) {
    await page
      .getByRole("combobox", { name, exact: true })
      .selectOption({ index });
  }
  await expect(
    page.getByRole("heading", { name: "研究目标达成", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".evidence-verdict .verified")).toHaveCount(4);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "研究目标达成", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "样品记录与对比", exact: true })
    .click();
  await page
    .getByRole("button", { name: "从此记录分成两房", exact: true })
    .nth(2)
    .click();
  await expect(page.locator(".temperature")).toContainText("1000");
  await page.reload();
  await expect(page.locator(".temperature")).toContainText("1000");
  expect(errors).toEqual([]);
});
test("MELTS有效节点、策略比较、非法包保留现有档案；立绘可查看", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/");
  await page.getByRole("button", { name: "查看立绘", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "女神立绘" })).toBeVisible();
  await page.getByRole("button", { name: "关闭立绘" }).click();
  const controls = await page
    .getByRole("button", { name: "开始自动冷却" })
    .boundingBox();
  expect(controls!.y + controls!.height).toBeLessThan(768);
  const sample = await page
    .getByRole("button", { name: "记录岩石样品" })
    .boundingBox();
  expect(sample!.y + sample!.height).toBeLessThan(768);
  await page
    .getByRole("button", { name: "MELTS 研究档案", exact: true })
    .click();
  await slide(page, "MELTS计算节点", 25);
  await expect(page.locator(".science-panel")).toContainText("1110°C");
  await expect(
    page.getByRole("button", { name: "下一计算节点 −5°C" }),
  ).toBeDisabled();
  const kept = await page.locator(".science-panel").textContent();
  await page
    .getByRole("button", { name: "每步分离全部固相", exact: true })
    .click();
  await slide(page, "MELTS计算节点", 25);
  expect(await page.locator(".science-panel").textContent()).not.toEqual(kept);
  await page.locator(".science-panel input[type=file]").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"schemaVersion":1,"status":"partial"}'),
  });
  await expect(page.locator(".science-panel [role=status]")).toContainText(
    "拒绝导入",
  );
  await expect(page.locator(".science-panel")).toContainText("1110°C");
});
