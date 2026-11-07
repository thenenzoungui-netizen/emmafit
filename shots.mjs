import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium, devices } = require("/home/user/.tools/node_modules/playwright");
import http from "http";
import fs from "fs";
import path from "path";

const root = process.cwd();
const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".png": "image/png", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p === "/") p = "/index.html";
  const f = path.join(root, p);
  if (!fs.existsSync(f)) { res.writeHead(404); res.end("nope"); return; }
  res.writeHead(200, { "content-type": types[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(4173, "0.0.0.0", r));

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices["iPhone 13"], locale: "fr-FR" });
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push("PAGE ERROR: " + e.message));
page.on("console", (m) => { if (m.type() === "error") errs.push("CONSOLE: " + m.text()); });

await page.goto("http://localhost:4173/", { waitUntil: "networkidle" });
fs.mkdirSync("/home/user/shots", { recursive: true });
await page.screenshot({ path: "/home/user/shots/01-onboarding.png", fullPage: true });

// onboarding
await page.fill("#ob-prenom", "Emma");
await page.fill("#ob-age", "28");
await page.fill("#ob-taille", "168");
await page.fill("#ob-poids", "74");
await page.fill("#ob-cible", "66");
await page.click('[data-act="start"]');
await page.waitForTimeout(300);
await page.screenshot({ path: "/home/user/shots/02-home-vide.png", fullPage: true });

// ajouter un aliment
await page.click('[data-act="openAdd"]');
await page.waitForTimeout(350);
await page.screenshot({ path: "/home/user/shots/03-sheet.png" });
await page.fill("#food-q", "tajine");
await page.waitForTimeout(150);
await page.screenshot({ path: "/home/user/shots/04-recherche.png" });
await page.locator(".food-row").first().click();
await page.waitForTimeout(250);
await page.screenshot({ path: "/home/user/shots/05-portion.png" });
await page.click('[data-act="confirmAdd"]');
await page.waitForTimeout(300);
// ajouter un 2e aliment
await page.fill("#food-q", "pain");
await page.waitForTimeout(150);
await page.locator(".food-row").first().click();
await page.waitForTimeout(200);
await page.click('[data-act="confirmAdd"]');
await page.waitForTimeout(200);
await page.click('[data-act="closeSheet"]');
await page.waitForTimeout(400);
await page.click('[data-act="openAdd"]');
await page.waitForTimeout(300);
await page.click('[data-act="closeSheet"]');
await page.waitForTimeout(400);
await page.screenshot({ path: "/home/user/shots/06-home-rempli.png", fullPage: true });

// progrès avec pesées
await page.click('[data-act="tab"][data-view="progress"]');
await page.waitForTimeout(300);
await page.screenshot({ path: "/home/user/shots/07-progres-vide.png", fullPage: true });
// injecter un historique
await page.evaluate(() => {
  const S = JSON.parse(localStorage.getItem("emmafit.v1"));
  const base = new Date(); const kgs = [74, 74.3, 73.9, 73.6, 73.8, 73.3, 73.1, 73.4, 72.9, 72.7, 72.8, 72.4];
  kgs.forEach((kg, i) => {
    const d = new Date(base); d.setDate(d.getDate() - (kgs.length - 1 - i) * 3);
    const k = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    S.weights.push({ date: k, kg });
    S.meals.push({ id: "x" + i, date: k, moment: "dejeuner", items: [{ fid: "poulet-filet", nom: "Poulet", k: 380, p: 37, g: 0, l: 4, portion: "1 filet" }] });
  });
  localStorage.setItem("emmafit.v1", JSON.stringify(S));
});
await page.reload({ waitUntil: "networkidle" });
await page.click('[data-act="tab"][data-view="progress"]');
await page.waitForTimeout(300);
await page.screenshot({ path: "/home/user/shots/08-progres.png", fullPage: true });

await page.click('[data-act="tab"][data-view="home"]');
await page.waitForTimeout(200);
await page.screenshot({ path: "/home/user/shots/09-home-final.png", fullPage: true });

await page.click('[data-act="tab"][data-view="settings"]');
await page.waitForTimeout(200);
await page.screenshot({ path: "/home/user/shots/10-reglages.png", fullPage: true });

// mode sombre
await page.evaluate(() => { document.documentElement.setAttribute("data-theme", "dark"); });
await page.waitForTimeout(200);
await page.screenshot({ path: "/home/user/shots/11-sombre.png", fullPage: true });

const offline = await page.evaluate(async () => {
  const reg = await navigator.serviceWorker.ready;
  return !!reg.active;
});
console.log("Service worker actif :", offline);
console.log(errs.length ? "ERREURS:\n" + errs.join("\n") : "Aucune erreur console ✅");
await browser.close();
server.close();
