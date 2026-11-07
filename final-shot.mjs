import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium, devices } = require("/home/user/.tools/node_modules/playwright");
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices["iPhone 13"], locale: "fr-FR", timezoneId: "Africa/Casablanca" });
const page = await ctx.newPage();
await page.goto("http://localhost:8080/", { waitUntil: "networkidle" });
await page.fill("#ob-prenom", "Emma");
await page.click('[data-act="start"]');
await page.evaluate(() => {
  const S = JSON.parse(localStorage.getItem("emmafit.v1"));
  const mk = (y, m, d) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  S.weights = [
    { date: mk(2026, 9, 3), kg: 76.8 }, { date: mk(2026, 9, 10), kg: 76.2 }, { date: mk(2026, 9, 18), kg: 76.6 }, { date: mk(2026, 9, 27), kg: 75.9 },
    { date: mk(2026, 10, 4), kg: 75.4 }, { date: mk(2026, 10, 11), kg: 75.0 }, { date: mk(2026, 10, 19), kg: 75.3 }, { date: mk(2026, 10, 28), kg: 74.6 },
    { date: mk(2026, 11, 2), kg: 74.2 }, { date: mk(2026, 11, 7), kg: 73.9 }
  ];
  S.profile.poids = 73.9;
  const t = new Date();
  S.streak = { last: "2026-11-07", days: 9 };
  localStorage.setItem("emmafit.v1", JSON.stringify(S));
});
await page.reload({ waitUntil: "networkidle" });
await page.click('[data-act="tab"][data-view="progress"]');
await page.waitForTimeout(500);
await page.evaluate(() => window.scrollTo(0, 0));
await page.screenshot({ path: "/home/user/shots/final-poids-haut.png" });
await page.locator(".month-row").first().scrollIntoViewIfNeeded();
await page.waitForTimeout(300);
await page.screenshot({ path: "/home/user/shots/final-poids-mois.png" });
await page.screenshot({ path: "/home/user/shots/final-progress-full.png", fullPage: true });
await browser.close();
