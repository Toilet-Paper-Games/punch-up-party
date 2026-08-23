import { expect, test, type Locator } from "@playwright/test";

async function expectInside(child: Locator, container: Locator): Promise<void> {
  const [childBox, containerBox] = await Promise.all([child.boundingBox(), container.boundingBox()]);
  expect(childBox).not.toBeNull();
  expect(containerBox).not.toBeNull();
  if (!childBox || !containerBox) return;
  expect(childBox.x).toBeGreaterThanOrEqual(containerBox.x - 1);
  expect(childBox.y).toBeGreaterThanOrEqual(containerBox.y - 1);
  expect(childBox.x + childBox.width).toBeLessThanOrEqual(containerBox.x + containerBox.width + 1);
  expect(childBox.y + childBox.height).toBeLessThanOrEqual(containerBox.y + containerBox.height + 1);
}

test("all eight finale answers and legal long duel copy stay inside a 16:9 host", async ({ page }) => {
  await page.goto("/surfaces/scenarios.html");
  await page.getByLabel("State").selectOption("finale-voting-8");
  const root = page.locator("#scenario-root");
  const finaleAnswers = root.locator(".answer-slip");
  await expect(finaleAnswers).toHaveCount(8);
  for (let index = 0; index < 8; index += 1) await expectInside(finaleAnswers.nth(index), root);
  await expect(root.locator(".versus")).toHaveCount(0);
  const ordinaryFinaleFontSize = await finaleAnswers.first().locator("p").evaluate((node) => Number.parseFloat(getComputedStyle(node).fontSize));
  expect(ordinaryFinaleFontSize).toBeGreaterThanOrEqual(15);

  await page.getByLabel("State").selectOption("finale-voting-8-long");
  const longFinaleAnswers = root.locator(".answer-slip");
  await expect(longFinaleAnswers).toHaveCount(8);
  for (let index = 0; index < 8; index += 1) await expectInside(longFinaleAnswers.nth(index), root);

  await page.getByLabel("State").selectOption("finale-results-8");
  const finaleResults = root.locator(".answer-slip");
  await expect(finaleResults).toHaveCount(8);
  for (let index = 0; index < 8; index += 1) await expectInside(finaleResults.nth(index), root);

  await page.getByLabel("State").selectOption("long-voting");
  const longAnswers = root.locator(".answer-slip");
  await expect(longAnswers).toHaveCount(2);
  for (let index = 0; index < 2; index += 1) await expectInside(longAnswers.nth(index), root);
  await expectInside(root.locator(".billing-line"), root);
});

test("reconnect status is visible before the controller task", async ({ page }) => {
  await page.goto("/surfaces/scenarios.html");
  await page.getByLabel("Surface").selectOption("controller");
  await page.getByLabel("State").selectOption("reconnecting");
  const root = page.locator("#scenario-root");
  const status = root.getByRole("status");
  const heading = root.getByRole("heading", { level: 1 });
  await expect(status).toBeVisible();
  const [statusBox, headingBox, rootBox] = await Promise.all([status.boundingBox(), heading.boundingBox(), root.boundingBox()]);
  expect(statusBox && headingBox && rootBox).toBeTruthy();
  if (!statusBox || !headingBox || !rootBox) return;
  expect(statusBox.y).toBeLessThan(headingBox.y);
  expect(statusBox.y + statusBox.height).toBeLessThanOrEqual(rootBox.y + rootBox.height);
});

test("the controller deadline stays visible through the second prompt and submit target", async ({ page }) => {
  await page.goto("/surfaces/scenarios.html");
  await page.getByLabel("Surface").selectOption("controller");
  await page.getByLabel("State").selectOption("writing");
  const root = page.locator("#scenario-root");
  const secondAnswer = root.locator("textarea").nth(1);
  await secondAnswer.scrollIntoViewIfNeeded();
  await expectInside(root.locator(".timer"), root);
  const submit = root.getByRole("button", { name: "Submit punchlines" });
  await submit.scrollIntoViewIfNeeded();
  const submitBox = await submit.boundingBox();
  expect(submitBox?.height).toBeGreaterThanOrEqual(44);
  await expectInside(root.locator(".timer"), root);
  const horizontalOverflow = await root.evaluate((node) => node.scrollWidth - node.clientWidth);
  expect(horizontalOverflow).toBeLessThanOrEqual(1);
});
