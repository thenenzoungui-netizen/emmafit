import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium, devices } = require("/home/user/.tools/node_modules/playwright");
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices["iPhone 13"], locale: "fr-FR" });
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push("PAGEERROR " + e.message));
page.on("console", (m) => { if (m.type() === "error") errs.push("CONSOLE " + m.text()); });
page.on("dialog", (d) => d.accept());
const ok = (c, m) => { console.log((c ? "  ✓ " : "  ✗ ") + m); if (!c) errs.push("ÉCHEC " + m); };

await page.goto("http://localhost:8080/", { waitUntil: "networkidle" });
await page.fill("#ob-prenom", "Emma");
await page.fill("#ob-poids", "74");
await page.click('[data-act="start"]');
await page.click('[data-act="tab"][data-view="progress"]');
await page.waitForTimeout(300);

// pesées sur des dates passées, sur ~4 mois
const plan = [["2026-08-01", "76.4"], ["2026-09-01", "75.2"], ["2026-10-01", "74.1"], ["2026-11-01", "73.2"], ["2026-11-07", "72.4"]];
for (const [d, kg] of plan) {
  await page.fill("#kg-in", kg);
  await page.fill("#kg-date", d);
  await page.click('[data-act="saveWeight"]');
  await page.waitForTimeout(150);
}
ok(await page.locator(".month-row").count() === 4, "4 mois affichés dans « Par mois » (" + await page.locator(".month-row").count() + ")");
const deltas = await page.locator(".mdelta").allInnerTexts();
console.log("     variations :", deltas.join(" | "));
ok(deltas.some((t) => t.includes("−")), "au moins une variation négative affichée");

// réenregistrer une date existante = mise à jour, pas de doublon
await page.fill("#kg-in", "76.1");
await page.fill("#kg-date", "2026-08-01");
await page.click('[data-act="saveWeight"]');
await page.waitForTimeout(200);
const n = await page.evaluate(() => JSON.parse(localStorage.getItem("emmafit.v1")).weights.length);
ok(n === 5, "réenregistrer une date met à jour sans doublon (" + n + " pesées)");

// suppression
await page.locator('[data-act="delWeight"]').first().click();
await page.waitForTimeout(250);
const n2 = await page.evaluate(() => JSON.parse(localStorage.getItem("emmafit.v1")).weights.length);
ok(n2 === 4, "pesée supprimée (" + n2 + ")");

// rappel mensuel .ics
const dl = page.waitForEvent("download");
await page.click('[data-act="tab"][data-view="settings"]');
await page.waitForTimeout(200);
await page.click('[data-act="icsMonth"]');
ok((await (await dl).suggestedFilename()).includes("pesee-mensuelle"), "rappel pesée mensuelle téléchargé");

// captures
await page.click('[data-act="tab"][data-view="progress"]');
await page.waitForTimeout(400);
await page.screenshot({ path: "/home/user/shots/poids-full.png", fullPage: true });
await page.locator(".month-row").first().scrollIntoViewIfNeeded();
await page.waitForTimeout(200);
await page.screenshot({ path: "/home/user/shots/poids-mois.png" });

console.log("\n" + (errs.length ? "ERREURS :\n" + errs.join("\n") : "AUCUNE ERREUR ✅"));
await browser.close();
process.exit(errs.length ? 1 : 0);
