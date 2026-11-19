import { expect, test } from "@playwright/test";

const toolPath = "/tools/qr-utm-generator/";
const result = "A café result\n<script>this is text, not markup</script>";

test("keeps a denied clipboard result selectable and restores the starting control", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: () => Promise.reject(new Error("permission denied")) } });
    document.execCommand = () => false;
  });
  await page.goto(toolPath);
  const start = page.getByRole("button", { name: "Try an example", exact: true }).first();
  await start.focus();
  const copied = await page.evaluate((text) => window.JB.copy(text, "Copied result"), result);
  expect(copied).toBe(false);
  const dialog = page.getByRole("dialog", { name: "Copy your result manually" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("textbox")).toHaveValue(result);
  await expect(dialog.getByRole("textbox")).toBeFocused();
  await expect(page.getByRole("status").last()).toContainText("Automatic copy failed");
  expect(await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(start).toBeFocused();
});

test("reports a confirmed clipboard write without a recovery dialog", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (text) => { window.copiedText = text; } } });
  });
  await page.goto(toolPath);
  expect(await page.evaluate((text) => window.JB.copy(text, "Copied result"), result)).toBe(true);
  expect(await page.evaluate(() => window.copiedText)).toBe(result);
  await expect(page.getByRole("status").last()).toHaveText("Copied result");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
