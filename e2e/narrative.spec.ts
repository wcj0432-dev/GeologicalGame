import { test, expect } from "@playwright/test";
test("第一关叙事闭环、跳过、数据对比与一次性剧情存档", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  const guide = page.getByRole("region", { name: "女神叙事与研究助手" });
  await expect(guide.locator(".dialogue-text")).toContainText("创造岩石");
  await guide.getByRole("button", { name: "继续对话" }).click();
  await guide.getByRole("button", { name: "继续对话" }).click();
  await guide.getByRole("button", { name: "地下，给晶体更多时间" }).click();
  await expect(guide.locator(".dialogue-text")).toContainText("慢");
  await guide.getByRole("button", { name: "跳过剧情" }).click();
  await page.reload();
  await expect(guide.locator(".dialogue-text")).not.toContainText("欢迎来到");
  await page.getByRole("combobox", { name: "时间推进倍率" }).selectOption("4");
  await page.getByRole("button", { name: "快速 · 近地表" }).click();
  await page.getByRole("button", { name: "开始自动冷却" }).click();
  await expect(page.locator(".temperature")).toContainText("650", {
    timeout: 15000,
  });
  await expect(guide.locator(".dialogue-text")).toContainText("A房到达650");
  await guide.getByRole("button", { name: "跳过剧情" }).click();
  await page.getByRole("button", { name: "实验室 B" }).click();
  await page.getByRole("button", { name: "缓慢 · 地下" }).click();
  await page.getByRole("button", { name: "开始自动冷却" }).click();
  await expect(page.getByText("研究目标达成")).toBeVisible({ timeout: 15000 });
  await expect(guide.locator(".dialogue-text")).toContainText("成分一样");
  await expect(
    page.getByRole("heading", { name: "女神并列展开两条路径" }),
  ).toBeVisible();
  await guide.getByRole("button", { name: "跳过剧情" }).click();
  await page.reload();
  await expect(guide.locator(".dialogue-text")).not.toContainText("成分一样");
  await guide.getByRole("button", { name: "对话历史" }).click();
  await expect(
    guide.getByText("第一幕终 · 星球也从过程开始", { exact: false }),
  ).toBeVisible();
  await page
    .locator("nav")
    .getByRole("button", { name: /自由实验室/ })
    .click();
  await expect(guide.locator(".dialogue-actions")).toBeEmpty();
  await guide.getByRole("button", { name: "暂停并观察矿物" }).click();
  await expect(page.locator(".science-evidence")).toContainText("0.000 kg");
  await guide.getByRole("button", { name: "原理解释" }).click();
  await expect(guide.locator(".dialogue-text")).toContainText("教学代理");
  expect(errors).toEqual([]);
});
test("检查目标后的重复提示、安静模式和显式讲解", async ({ page }) => {
  await page.goto("/");
  const guide = page.getByRole("region", { name: "女神叙事与研究助手" });
  await guide.getByRole("button", { name: "安静模式", exact: true }).click();
  await expect(
    guide.getByRole("button", { name: "开启自动对话" }),
  ).toBeVisible();
  for (let i = 0; i < 3; i++)
    await guide.getByRole("button", { name: "检查研究目标" }).click();
  await expect(guide.locator(".dialogue-text")).toContainText("第3次");
  await guide.getByRole("button", { name: "跳过剧情" }).click();
  await guide.getByRole("button", { name: "原理解释" }).click();
  await expect(guide.locator(".dialogue-text")).toContainText("原理说明");
});
