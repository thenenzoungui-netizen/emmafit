import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium, devices } = require("/home/user/.tools/node_modules/playwright");
const BASE = "http://localhost:8080/";
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices["iPhone 13"], locale: "fr-FR", acceptDownloads: true });
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push("PAGEERROR " + e.message));
page.on("console", (m) => { if (m.type() === "error") errs.push("CONSOLE " + m.text()); });
page.on("dialog", (d) => d.accept());
const ok = (c, m) => { console.log((c ? "  ✓ " : "  ✗ ") + m); if (!c) errs.push("ÉCHEC " + m); };

await page.goto(BASE, { waitUntil: "networkidle" });
await page.fill("#ob-prenom", "Emma");
await page.click('[data-act="start"]');
await page.waitForTimeout(200);

console.log("A. Saisie rapide");
await page.click('[data-act="openAdd"]');
await page.waitForTimeout(300);
await page.click('[data-act="sheetMoment"][data-moment="dejeuner"]');
await page.click('[data-act="sheetTab"][data-tab="quick"]');
await page.waitForTimeout(200);
await page.fill("#q-nom", "Déjeuner au restaurant");
await page.fill("#q-kcal", "650");
await page.click('[data-act="saveQuick"]');
await page.waitForTimeout(300);
ok(/restaurant/i.test((await page.locator(".meal-items").allInnerTexts()).join(" ")), "repas libre enregistré");

console.log("B. Favoris");
await page.click('[data-act="sheetTab"][data-tab="search"]');
await page.fill("#food-q", "amandes");
await page.waitForTimeout(200);
await page.locator(".food-row").first().click();
await page.waitForTimeout(200);
await page.click('[data-act="toggleFav"]');
await page.waitForTimeout(200);
ok((await page.locator('[data-act="toggleFav"]').innerText()).includes("Retirer"), "aliment ajouté aux favoris");
await page.click('[data-act="confirmAdd"]');
await page.waitForTimeout(250);
await page.click('[data-act="sheetTab"][data-tab="favs"]');
await page.waitForTimeout(200);
ok(await page.locator(".food-row").count() === 1, "onglet Favoris alimenté");
await page.click('[data-act="sheetTab"][data-tab="recent"]');
await page.waitForTimeout(200);
ok((await page.locator('[data-act="copyYesterday"]').count()) === 0, "pas de « hier » sans données (normal)");
await page.click('[data-act="closeSheet"]');
await page.waitForTimeout(350);

console.log("C. Suppression");
await page.click('[data-act="clearMeal"][data-moment="dejeuner"]');
await page.waitForTimeout(250);
ok((await page.locator(".meal-items").nth(1).innerText()).includes("Rien"), "repas retiré");

console.log("D. Progrès + pesées multiples");
await page.click('[data-act="tab"][data-view="progress"]');
await page.waitForTimeout(250);
for (const kg of ["73.8", "73.5", "73.6"]) {
  await page.fill("#kg-in", kg);
  await page.click('[data-act="saveWeight"]');
  await page.waitForTimeout(150);
  await page.evaluate(() => {
    const S = JSON.parse(localStorage.getItem("emmafit.v1"));
    S.weights.forEach((w) => {
      const d = new Date(); d.setDate(d.getDate() - 7);
      w.date = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    });
    localStorage.setItem("emmafit.v1", JSON.stringify(S));
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.click('[data-act="tab"][data-view="progress"]');
  await page.waitForTimeout(200);
}
ok(await page.locator("svg.chart").count() > 0, "courbe affichée après plusieurs pesées");
await page.click('[data-act="range"][data-d="90"]');
await page.waitForTimeout(200);
ok((await page.locator("#range-t").innerText()) === "90 jours", "changement de période");

console.log("E. Réglages / export / thème");
await page.click('[data-act="tab"][data-view="settings"]');
await page.waitForTimeout(200);
const dl = page.waitForEvent("download");
await page.click('[data-act="export"]');
const file = await dl;
ok((await file.suggestedFilename()).startsWith("emmafit-sauvegarde"), "export JSON téléchargé");
const dl2 = page.waitForEvent("download");
await page.click('[data-act="ics"]');
ok((await (await dl2).suggestedFilename()) === "emmafit-rappel.ics", "rappel .ics téléchargé");
await page.click('#st-theme button[data-v="dark"]');
await page.waitForTimeout(200);
ok((await page.evaluate(() => document.documentElement.getAttribute("data-theme"))) === "dark", "thème sombre appliqué");
await page.click('[data-act="recalc"]');
await page.waitForTimeout(200);
ok((await page.inputValue("#st-kcal")) !== "", "objectif recalculé");

console.log("\n" + (errs.length ? "ERREURS :\n" + errs.join("\n") : "AUCUNE ERREUR ✅"));
await browser.close();
process.exit(errs.length ? 1 : 0);
