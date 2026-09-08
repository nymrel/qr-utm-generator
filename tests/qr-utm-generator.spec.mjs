import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const toolPath = "/tools/qr-utm-generator/";
const sentinel = "nymrel-local-only-8675309";

async function fillValidCampaign(page) {
  await page.locator("#destUrl").fill(`https://example.invalid/menu/${sentinel}`);
  await page.locator("#utmSource").fill("Front Desk");
  await page.locator("#utmMedium").fill("Print Card");
  await page.locator("#utmCampaign").fill(sentinel);
  await expect(page.locator("#qrStatus")).toHaveText("Live");
}

test.beforeEach(async ({ page }) => {
  await page.goto(toolPath, { waitUntil: "domcontentloaded" });
});

test("builds and opt-in persists a tagged campaign without transmitting it", async ({ page }) => {
  const leakedRequests = [];
  page.on("request", (request) => {
    const requestText = `${request.url()}\n${request.postData() ?? ""}`.toLowerCase();
    if (requestText.includes(sentinel)) {
      leakedRequests.push({ method: request.method(), url: request.url() });
    }
  });

  await fillValidCampaign(page);
  const tagged = new URL(await page.locator("#taggedUrlOut").textContent());
  expect(tagged.origin).toBe("https://example.invalid");
  expect(tagged.pathname).toBe(`/menu/${sentinel}`);
  expect(tagged.searchParams.get("utm_source")).toBe("front-desk");
  expect(tagged.searchParams.get("utm_medium")).toBe("print-card");
  expect(tagged.searchParams.get("utm_campaign")).toBe(sentinel);
  await expect(page.locator("#qrImg")).toHaveAttribute("src", /^data:image\//);
  expect(leakedRequests).toEqual([]);

  expect(await page.evaluate(() => localStorage.getItem("jbt.qr.log"))).toBeNull();
  await page.locator("#saveLogBtn").click();
  expect(await page.evaluate(() => localStorage.getItem("jbt.qr.log"))).toContain(sentinel);

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("#logTableBody")).toContainText(sentinel);
  await page.locator("#clearLogBtn").click();
  expect(await page.evaluate(() => localStorage.getItem("jbt.qr.log"))).toBe("[]");
  await expect(page.locator("#logTableBody")).toContainText("Nothing logged yet");
});

test("rejects non-http destinations without generating a code", async ({ page }) => {
  await page.locator("#destUrl").fill("javascript:alert(1)");
  await page.locator("#utmSource").fill("flyer");
  await page.locator("#utmMedium").fill("print");
  await page.locator("#utmCampaign").fill("unsafe-scheme");
  await expect(page.locator("#qrStatus")).toHaveText("Waiting for input");
  await expect(page.locator("#qrImg")).toBeHidden();
  await expect(page.locator("#taggedUrlOut")).toContainText("Fill in the destination URL");
});

test("downloads a real PNG for the generated code", async ({ page }) => {
  await fillValidCampaign(page);
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#downloadPngBtn").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.png$/);
  const bytes = await readFile(await download.path());
  expect([...bytes.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
});

test("has no serious accessibility violations after generating a code", async ({ page }) => {
  await fillValidCampaign(page);
  const results = await new AxeBuilder({ page }).analyze();
  const blocking = results.violations.filter((violation) =>
    ["serious", "critical"].includes(violation.impact ?? ""),
  );
  expect(blocking).toEqual([]);
});

test("keeps the generated tool operable without horizontal overflow", async ({ page }) => {
  await fillValidCampaign(page);
  const hasOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(hasOverflow).toBe(false);
});
