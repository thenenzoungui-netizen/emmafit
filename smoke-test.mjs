/* Smoke test hors navigateur (jsdom) : vérifie les parcours clés */
import fs from "fs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { JSDOM } = require("/home/user/.tools/node_modules/jsdom");

const html = fs.readFileSync("index.html", "utf8").replace(/<script[\s\S]*?<\/script>/g, "");
const dom = new JSDOM(html, { url: "http://localhost/", pretendToBeVisual: true, runScripts: "outside-only" });
const w = dom.window, doc = w.document;

const errs = [];
w.addEventListener("error", (e) => errs.push("window error: " + e.message));
const origErr = console.error;
console.error = (...a) => { const m = a.join(" "); if (!/Not implemented/.test(m)) errs.push(m); };

function run(file) { w.eval(fs.readFileSync(file, "utf8")); }
function click(el) { el.dispatchEvent(new w.MouseEvent("click", { bubbles: true })); }
function q(sel) { return doc.querySelector(sel); }
function qa(sel) { return [...doc.querySelectorAll(sel)]; }
function assert(cond, msg) { if (!cond) { errs.push("ÉCHEC: " + msg); } else { console.log("  ✓ " + msg); } }

w.eval("window.confirm = () => true; window.alert = () => {};");

run("assets/foods.js");
run("assets/app.js");

console.log("\n1. Onboarding");
assert(q("#ob-prenom"), "écran d'accueil de bienvenue affiché");
q("#ob-prenom").value = "Emma";
q("#ob-age").value = "28";
q("#ob-taille").value = "168";
q("#ob-poids").value = "74";
q("#ob-cible").value = "66";
q("#ob-poids").dispatchEvent(new w.Event("input", { bubbles: true }));
const preview = q("#ob-kcal").textContent.trim();
assert(/\d+/.test(preview), "objectif calculé en direct : " + preview);
click(q('[data-act="start"]'));
assert(q(".title").textContent.includes("Emma"), "accueil personnalisé");
assert(q(".ring"), "anneau de progression présent");
assert(qa(".meal").length === 4, "4 repas affichés");

console.log("\n2. Ajout d'un aliment");
click(q('[data-act="openAdd"]'));
assert(q(".sheet"), "feuille d'ajout ouverte");
const inp = q("#food-q");
inp.value = "tajine";
inp.dispatchEvent(new w.Event("input", { bubbles: true }));
const rows = qa(".food-row");
assert(rows.length > 0, rows.length + " résultats pour « tajine »");
click(rows[0]);
assert(q(".pick-total"), "écran de quantité affiché : " + q(".pick-total").textContent.trim());
click(q('[data-act="confirmAdd"]'));
let st = JSON.parse(w.localStorage.getItem("emmafit.v1"));
assert(st.meals.length === 1, "repas enregistré dans le stockage");
assert(st.streak.days === 1, "série démarrée (1 jour)");

console.log("\n3. Eau + navigation");
click(qa(".drop")[2]);
st = JSON.parse(w.localStorage.getItem("emmafit.v1"));
assert(st.water[0].verres === 3, "3 verres d'eau enregistrés");
click(qa('[data-act="tab"]').find((t) => t.dataset.view === "progress"));
assert(q(".big-num"), "écran Progrès rendu");
q("#kg-in").value = "73.4";
click(q('[data-act="saveWeight"]'));
st = JSON.parse(w.localStorage.getItem("emmafit.v1"));
assert(st.weights.some((x) => x.kg === 73.4), "pesée enregistrée");
assert(q("#chart-box").innerHTML.length > 40, "bloc courbe rendu (" + (q("svg.chart") ? "SVG" : "message d'attente") + ")");

console.log("\n4. Réglages");
click(qa('[data-act="tab"]').find((t) => t.dataset.view === "settings"));
assert(q("#st-kcal"), "réglages rendus (valeur objectif : " + q("#st-kcal").value + ")");
click(q('[data-act="toggleSimple"]'));
st = JSON.parse(w.localStorage.getItem("emmafit.v1"));
assert(st.settings.modeSimple === true, "mode simple activé");
click(qa('[data-act="tab"]').find((t) => t.dataset.view === "home"));
assert(q(".ring .big").textContent.includes("/4"), "anneau en mode simple → " + q(".ring .big").textContent.trim());

console.log("\n5. Persistance");
const dom2html = doc.documentElement.outerHTML;
assert(st.profile.prenom === "Emma", "profil persisté");

console.log("\n----------------------------------------");
if (errs.length) { console.log("PROBLÈMES :"); errs.forEach((e) => console.log(" - " + e)); process.exit(1); }
console.log("TOUT EST VERT ✅");

console.log("fin du test");
process.exit(errs.length ? 1 : 0);
