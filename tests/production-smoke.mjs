import { chromium } from "playwright";

const PRODUCTION_URL = "https://play.tp.games";
const REGISTRY_ASSET_PATH = "/published-assets/punch-up-party/0.1.6/";

async function waitFor(check, label, timeoutMs = 60_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${label}.`);
}

function surfaceFrame(page, surface) {
  return page.frames().find((frame) => frame.url().includes(`${REGISTRY_ASSET_PATH}${surface}.html`));
}

const browser = await chromium.launch({ headless: true });
const errors = [];
const contexts = [];

try {
  const hostContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  contexts.push(hostContext);
  const host = await hostContext.newPage();
  host.on("pageerror", (error) => errors.push(`host: ${error.message}`));
  await host.goto(PRODUCTION_URL, { waitUntil: "networkidle", timeout: 60_000 });
  const inviteUrl = await host.locator('a[href*="/controller?"]').getAttribute("href");
  if (!inviteUrl) throw new Error("Production host did not expose a controller invite.");
  const roomCode = new URL(inviteUrl).pathname.split("/")[2];

  const controllerPages = [];
  for (const name of ["Avery", "Blake", "Casey"]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    contexts.push(context);
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(`${name}: ${error.message}`));
    await page.goto(inviteUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
    const dialog = page.getByRole("dialog", { name: "Enter name" });
    await dialog.getByRole("textbox", { name: "Screen name" }).fill(name);
    await dialog.getByRole("button", { name: "Join room" }).click();
    controllerPages.push(page);
  }

  const organizer = controllerPages[0];
  await organizer.getByRole("searchbox", { name: "Search games" }).fill("Punch Up");
  await organizer.getByRole("button", { name: "Open Punch Up! details" }).click();
  await organizer.getByRole("button", { name: "Play Punch Up!" }).click();

  await waitFor(() => Boolean(surfaceFrame(host, "host")), "the production host surface");
  await Promise.all(controllerPages.map((page, index) =>
    waitFor(() => Boolean(surfaceFrame(page, "controller")), `production controller ${index + 1}`)
  ));

  const hostGame = surfaceFrame(host, "host");
  if (!hostGame) throw new Error("Production host surface disappeared.");
  const passiveSelector = "button, input, textarea, select, a[href], [tabindex]:not([tabindex='-1'])";
  if (await hostGame.locator(passiveSelector).count()) {
    throw new Error("Production host surface contains an interactive or focusable element.");
  }

  await Promise.all(controllerPages.map((page, index) => waitFor(async () => {
    const frame = surfaceFrame(page, "controller");
    return frame ? await frame.locator("textarea").count() === 2 : false;
  }, `writing assignments for controller ${index + 1}`, 30_000)));

  for (const [playerIndex, page] of controllerPages.entries()) {
    const frame = surfaceFrame(page, "controller");
    if (!frame) throw new Error(`Controller ${playerIndex + 1} surface disappeared.`);
    const answers = frame.locator("textarea");
    for (let answerIndex = 0; answerIndex < 2; answerIndex += 1) {
      await answers.nth(answerIndex).fill([
        "The Wi-Fi password is also a cry for help.",
        "Please return the moon by Tuesday.",
        "Trash panda, rich mindset."
      ][playerIndex] + ` Production ${answerIndex + 1}`);
    }
    await frame.getByRole("button", { name: "Submit punchlines" }).click();
    try {
      await waitFor(async () => {
        const title = (await frame.locator("h1").textContent())?.trim();
        return title === "Your pages are in." || await frame.locator("form[data-writing-form]").count() === 0;
      }, `canonical submission confirmation for controller ${playerIndex + 1}`, 20_000);
    } catch (error) {
      await page.screenshot({ path: `output/production-submit-failure-${playerIndex + 1}.png`, fullPage: true });
      console.error(JSON.stringify({
        controller: playerIndex + 1,
        outerText: (await page.locator("body").innerText()).slice(0, 2_000),
        surfaceText: (await frame.locator("body").innerText()).slice(0, 2_000),
        surfaceHtml: (await frame.locator("body").innerHTML()).slice(0, 5_000),
        errors
      }, null, 2));
      throw error;
    }
  }

  let capturedResult = false;
  for (let matchupIndex = 0; matchupIndex < 3; matchupIndex += 1) {
    await waitFor(async () => (await hostGame.locator("h1").textContent())?.trim() === "Which line stays?", `matchup ${matchupIndex + 1} voting`, 30_000);
    let voted = false;
    for (const page of controllerPages) {
      const frame = surfaceFrame(page, "controller");
      const option = frame?.locator("button.vote-option").first();
      if (option && await option.isVisible()) {
        await option.click();
        voted = true;
        break;
      }
    }
    if (!voted) throw new Error(`No eligible controller could vote in matchup ${matchupIndex + 1}.`);
    await waitFor(async () => {
      const title = (await hostGame.locator("h1").textContent())?.trim();
      return title === "That line stays." || title === "The room called it a tie.";
    }, `matchup ${matchupIndex + 1} result`);
    if (!capturedResult) {
      await host.locator("iframe").screenshot({ path: "docs/screenshots/production-round-result.png" });
      capturedResult = true;
    }
  }

  await waitFor(async () => (await hostGame.locator("h1").textContent())?.trim() === "New page. Bigger points.", "the production round-one break", 30_000);
  await host.locator("iframe").screenshot({ path: "docs/screenshots/production-round-break.png" });
  if (errors.length) throw new Error(`Production page errors: ${errors.join(" | ")}`);

  console.log(JSON.stringify({
    ok: true,
    roomCode,
    gameId: "punch-up-party",
    version: "0.1.6",
    controllers: 3,
    completedRound: 1,
    passiveHost: true,
    pageErrors: 0,
    hostAssetUrl: hostGame.url()
  }, null, 2));
} finally {
  for (const context of contexts) await context.close();
  await browser.close();
}
