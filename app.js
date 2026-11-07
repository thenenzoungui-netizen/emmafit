/* ============================================================
   EmmaFit — application (vanilla JS, hors-ligne, zéro dépendance)
   ============================================================ */
(function () {
  "use strict";

  /* ---------------- constantes ---------------- */
  var KEY = "emmafit.v1";
  var MOMENTS = [
    { id: "petitdej", nom: "Petit-déjeuner", ico: "☕️", short: "Petit-déj" },
    { id: "dejeuner", nom: "Déjeuner", ico: "🍽️", short: "Déjeuner" },
    { id: "diner", nom: "Dîner", ico: "🌙", short: "Dîner" },
    { id: "collation", nom: "Collations", ico: "🍎", short: "Collation" }
  ];
  var ACTIVITES = {
    faible: { nom: "Assise la plupart du temps", d: "peu de marche", f: 1.2 },
    leger: { nom: "Légèrement active", d: "quelques marches par jour", f: 1.375 },
    modere: { nom: "Modérément active", d: "sport 3–4× / semaine", f: 1.55 },
    actif: { nom: "Très active", d: "sport 5× ou plus / semaine", f: 1.725 }
  };
  var MACONS = "Africa/Casablanca";

  /* ---------------- utilitaires ---------------- */
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function dateKey(d) { d = d || new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function todayKey() { return dateKey(new Date()); }
  function addDays(key, n) {
    var p = key.split("-");
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    d.setDate(d.getDate() + n);
    return dateKey(d);
  }
  function fromKey(key) { var p = key.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function r0(n) { return Math.round(n || 0); }
  function r1(n) { return Math.round((n || 0) * 10) / 10; }
  function fr(n) { return String(n === null || n === undefined ? "—" : n).replace(".", ","); }
  function one(n) { return (Math.round((n || 0) * 10) / 10).toFixed(1).replace(".", ","); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function dayLabel(key) {
    var t = todayKey();
    if (key === t) return "Aujourd'hui";
    if (key === addDays(t, -1)) return "Hier";
    var d = fromKey(key);
    return d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
  }
  function shortDate(key) {
    var d = fromKey(key);
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
  }

  /* ---------------- état ---------------- */
  function defaults() {
    return {
      version: 1,
      profile: {
        prenom: "", sexe: "f", age: 30, taille: 165, poids: 70, cible: 65,
        activite: "leger", objKcal: 0, prot: 0, gluc: 0, lip: 0,
        onboarding: false
      },
      customFoods: [],
      meals: [],
      weights: [],
      water: [],
      favs: [],
      streak: { last: null, days: 0 },
      settings: { theme: "auto", modeSimple: false, lastExport: null },
      meta: { creeLe: new Date().toISOString() }
    };
  }

  function load() {
    var base = defaults();
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return base;
      var s = JSON.parse(raw);
      base.profile = Object.assign(base.profile, s.profile || {});
      base.settings = Object.assign(base.settings, s.settings || {});
      base.streak = Object.assign(base.streak, s.streak || {});
      ["customFoods", "meals", "weights", "water", "favs"].forEach(function (k) {
        if (Array.isArray(s[k])) base[k] = s[k];
      });
      return base;
    } catch (e) { return base; }
  }
  var S = load();
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); }
    catch (e) { toast("Stockage plein — pense à exporter ta sauvegarde"); }
  }

  /* ---------------- aliments ---------------- */
  function allFoods() { return (window.FOODS || []).concat(S.customFoods || []); }
  function foodById(id) {
    var f = allFoods().filter(function (x) { return x.id === id; });
    return f.length ? f[0] : null;
  }
  function defaultPortion(f) { return (f.portions && f.portions[0]) ? f.portions[0][1] : 100; }

  /* ---------------- calculs ---------------- */
  function computeTargets(p) {
    var w = +p.poids || 70, h = +p.taille || 165, a = +p.age || 30;
    var mb = 10 * w + 6.25 * h - 5 * a + (p.sexe === "f" ? -161 : 5);
    var f = (ACTIVITES[p.activite] || ACTIVITES.leger).f;
    var dej = mb * f;
    var obj = Math.round((dej - 400) / 25) * 25;
    var garde = Math.max(obj, 1200);
    var prot = Math.round(1.6 * w);
    var lip = Math.round(0.9 * w);
    var gluc = Math.max(0, Math.round((garde - prot * 4 - lip * 9) / 4));
    return { mb: Math.round(mb), dej: Math.round(dej), obj: garde, prot: prot, gluc: gluc, lip: lip, plancher: obj < 1200 };
  }
  function targetKcal() { return S.profile.objKcal || computeTargets(S.profile).obj; }
  function targetProt() { return S.profile.prot || computeTargets(S.profile).prot; }

  function mealsOn(date) { return S.meals.filter(function (m) { return m.date === date; }); }
  function totalsFor(date) {
    var t = { k: 0, p: 0, g: 0, l: 0 };
    mealsOn(date).forEach(function (m) {
      (m.items || []).forEach(function (it) {
        t.k += it.k || 0; t.p += it.p || 0; t.g += it.g || 0; t.l += it.l || 0;
      });
    });
    return { k: r0(t.k), p: r1(t.p), g: r1(t.g), l: r1(t.l) };
  }
  function itemsFor(date, moment) {
    var out = [];
    S.meals.forEach(function (m) {
      if (m.date !== date || m.moment !== moment) return;
      (m.items || []).forEach(function (it, i) { out.push({ it: it, mid: m.id, idx: i }); });
    });
    return out;
  }
  function waterFor(date) {
    var w = S.water.filter(function (x) { return x.date === date; })[0];
    return w ? w.verres : 0;
  }
  function setWater(date, n) {
    var w = S.water.filter(function (x) { return x.date === date; })[0];
    if (!w) { w = { date: date, verres: 0 }; S.water.push(w); }
    w.verres = Math.max(0, Math.min(12, n));
    save();
  }
  function daysNoted(list) {
    var c = 0;
    list.forEach(function (k) { if (mealsOn(k).length) c++; });
    return c;
  }
  function lastDays(n, from) {
    var out = [], base = from || todayKey();
    for (var i = n - 1; i >= 0; i--) out.push(addDays(base, -i));
    return out;
  }

  function touchStreak(date) {
    if (date !== todayKey()) return;
    var st = S.streak;
    if (st.last === date) return;
    if (st.last === addDays(date, -1)) st.days = (st.days || 0) + 1;
    else st.days = 1;
    st.last = date;
    save();
  }
  function streakNow() {
    var st = S.streak;
    if (!st.last) return 0;
    if (st.last === todayKey() || st.last === addDays(todayKey(), -1)) return st.days || 0;
    return 0;
  }

  /* ---------------- thème ---------------- */
  function applyTheme() {
    var t = S.settings.theme;
    if (t === "auto") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", t);
    var light = document.querySelector('meta[name="theme-color"]');
    if (light) light.setAttribute("content", t === "dark" ? "#1c1917" : "#fbf7f2");
  }

  /* ---------------- UI générique ---------------- */
  var app = document.getElementById("app");
  var tabbar = document.getElementById("tabbar");
  var sheetRoot = document.getElementById("sheet-root");
  var toastEl = document.getElementById("toast");
  var toastTimer = null;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove("on"); }, 2400);
  }

  var view = "home";

  function render() {
    applyTheme();
    if (!S.profile.onboarding) {
      app.innerHTML = viewOnboarding();
      tabbar.classList.add("hidden");
      bindOnboarding();
      return;
    }
    if (view === "home") app.innerHTML = viewHome();
    else if (view === "progress") app.innerHTML = viewProgress();
    else app.innerHTML = viewSettings();
    renderTabbar();
    tabbar.classList.remove("hidden");
  }

  function renderTabbar() {
    var tabs = [
      { id: "home", nom: "Aujourd'hui", path: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V20h13V9.5"/>' },
      { id: "progress", nom: "Progrès", path: '<path d="M4 19V5"/><path d="M4 19h16"/><path d="M8 15l3.5-4 3 2.5L20 7"/>' },
      { id: "settings", nom: "Réglages", path: '<circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 7 19.4a1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 2.6 14H2.5a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 7a1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 2.6V2.5a2 2 0 1 1 4 0v.1A1.7 1.7 0 0 0 17 4.6a1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.7 1.7 0 0 0 21.4 10v.1a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.9 1z"/>' }
    ];
    tabbar.innerHTML = '<div class="inner">' + tabs.map(function (t) {
      return '<button class="tab' + (view === t.id ? " on" : "") + '" data-act="tab" data-view="' + t.id + '">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">' + t.path + '</svg>' +
        '<span>' + t.nom + '</span></button>';
    }).join("") + '</div>';
  }

  /* ============================================================
     ONBOARDING
     ============================================================ */
  function viewOnboarding() {
    var p = S.profile;
    var t = computeTargets(p);
    var rate = (400 * 7 / 7700).toFixed(1);
    var weeks = p.cible && p.poids > p.cible ? Math.round((p.poids - p.cible) / (0.005 * p.poids)) : null;
    return '' +
      '<div class="top"><div><p class="hello">Bienvenue</p><h1 class="title">EmmaFit</h1></div></div>' +
      '<p class="sub" style="margin-bottom:18px">Quelques infos pour calculer ton objectif. Tout est modifiable plus tard, rien n\'est partagé.</p>' +

      '<div class="card">' +
      '<div class="field"><label for="ob-prenom">Ton prénom</label>' +
      '<input class="input" id="ob-prenom" type="text" autocomplete="given-name" placeholder="Ex. Emma" value="' + esc(p.prenom) + '"></div>' +

      '<div class="field"><label>Sexe (pour le calcul de dépense)</label>' +
      '<div class="seg" id="ob-sexe">' +
      '<button type="button" data-v="f" class="' + (p.sexe === "f" ? "on" : "") + '">Femme</button>' +
      '<button type="button" data-v="h" class="' + (p.sexe === "h" ? "on" : "") + '">Homme</button>' +
      '</div></div>' +

      '<div class="row2">' +
      '<div class="field"><label for="ob-age">Âge</label><input class="input" id="ob-age" type="number" inputmode="numeric" min="14" max="90" value="' + p.age + '"></div>' +
      '<div class="field"><label for="ob-taille">Taille (cm)</label><input class="input" id="ob-taille" type="number" inputmode="numeric" min="130" max="210" value="' + p.taille + '"></div>' +
      '</div>' +

      '<div class="row2">' +
      '<div class="field"><label for="ob-poids">Poids actuel (kg)</label><input class="input" id="ob-poids" type="number" inputmode="decimal" step="0.1" min="35" max="200" value="' + p.poids + '"></div>' +
      '<div class="field"><label for="ob-cible">Poids visé (kg)</label><input class="input" id="ob-cible" type="number" inputmode="decimal" step="0.1" min="35" max="200" value="' + p.cible + '"></div>' +
      '</div>' +

      '<div class="field"><label>Niveau d\'activité au quotidien</label><div class="choices" id="ob-act">' +
      Object.keys(ACTIVITES).map(function (k) {
        var a = ACTIVITES[k];
        return '<button type="button" class="choice ' + (p.activite === k ? "on" : "") + '" data-v="' + k + '">' +
          '<span><span class="t">' + a.nom + '</span><br><span class="d">' + a.d + '</span></span></button>';
      }).join("") + '</div></div>' +
      '</div>' +

      '<div class="obj-preview" id="ob-preview">' +
      '<p class="sub" style="margin-bottom:4px">Ton objectif quotidien estimé</p>' +
      '<p class="kcal" id="ob-kcal">' + t.obj + ' <span>kcal / jour</span></p>' +
      '<p class="sub" id="ob-sub">soit environ ' + rate + ' kg par semaine, sans te mettre à la diète' +
      (weeks ? ' · cap sur ton poids visé dans ~' + weeks + ' semaines' : '') + '</p>' +
      '</div>' +

      '<button class="btn" data-act="start">Commencer</button>' +
      '<p class="disclaimer">EmmaFit est un carnet de suivi, pas un avis médical. Un déficit trop fort n\'est jamais conseillé : en cas de doute, parles-en à un professionnel de santé.</p>';
  }

  function bindOnboarding() {
    var seg = document.getElementById("ob-sexe");
    if (seg) seg.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-v]"); if (!b) return;
      S.profile.sexe = b.dataset.v;
      Array.prototype.forEach.call(seg.children, function (c) { c.classList.toggle("on", c === b); });
      updatePreview();
    });
    var act = document.getElementById("ob-act");
    if (act) act.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-v]"); if (!b) return;
      S.profile.activite = b.dataset.v;
      Array.prototype.forEach.call(act.children, function (c) { c.classList.toggle("on", c === b); });
      updatePreview();
    });
    ["ob-age", "ob-taille", "ob-poids", "ob-cible"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener("input", updatePreview);
    });
  }

  function readOnboarding() {
    var g = function (id, d) { var el = document.getElementById(id); return el ? el.value : d; };
    S.profile.prenom = (g("ob-prenom", "") || "").trim();
    S.profile.age = +g("ob-age", 30) || 30;
    S.profile.taille = +g("ob-taille", 165) || 165;
    S.profile.poids = +g("ob-poids", 70) || 70;
    S.profile.cible = +g("ob-cible", 65) || 65;
  }

  function updatePreview() {
    readOnboarding();
    var t = computeTargets(S.profile);
    var el = document.getElementById("ob-kcal");
    var sub = document.getElementById("ob-sub");
    if (!el) return;
    el.innerHTML = t.obj + ' <span>kcal / jour</span>';
    var weeks = S.profile.cible && S.profile.poids > S.profile.cible
      ? Math.round((S.profile.poids - S.profile.cible) / (0.005 * S.profile.poids)) : null;
    sub.textContent = "soit environ 0,4 kg par semaine, sans te mettre à la diète" +
      (weeks ? " · cap sur ton poids visé dans ~" + weeks + " semaines" : "");
  }

  function startApp() {
    readOnboarding();
    if (!S.profile.prenom) S.profile.prenom = "Emma";
    var t = computeTargets(S.profile);
    S.profile.objKcal = t.obj;
    S.profile.prot = t.prot;
    S.profile.gluc = t.gluc;
    S.profile.lip = t.lip;
    S.profile.onboarding = true;
    if (!S.weights.length) S.weights.push({ date: todayKey(), kg: +S.profile.poids });
    save();
    view = "home";
    render();
    toast("Bienvenue " + S.profile.prenom + " 🌸");
  }

  /* ============================================================
     ÉCRAN AUJOURD'HUI
     ============================================================ */
  function dayMessage(rest, obj, tot) {
    if (tot.k === 0) return { ico: "🌱", txt: "Rien de noté pour l'instant — un petit tap et c'est parti.", warm: false };
    if (rest < 0) return { ico: "🤍", txt: "Journée un peu plus généreuse — demain est un nouveau départ.", warm: true };
    if (rest < obj * 0.22) return { ico: "✨", txt: "Tu approches de ton objectif, en douceur.", warm: false };
    return { ico: "🌿", txt: "Il te reste de la marge, pas besoin de te priver.", warm: false };
  }

  function viewHome() {
    var d = todayKey();
    var tot = totalsFor(d);
    var obj = targetKcal();
    var pro = targetProt();
    var rest = obj - tot.k;
    var pct = Math.max(0, Math.min(1, tot.k / obj));
    var C = 2 * Math.PI * 56;
    var st = streakNow();
    var p = S.profile;
    var msg = dayMessage(rest, obj, tot);
    var simple = !!S.settings.modeSimple;
    var notedMeals = MOMENTS.filter(function (m) { return itemsFor(d, m.id).length > 0; }).length;

    var ringCenter = simple
      ? '<span class="big">' + notedMeals + '/4</span><span class="lbl">repas notés</span>'
      : '<span class="big">' + (rest >= 0 ? rest : "0") + '</span><span class="lbl">' + (rest >= 0 ? "kcal restantes" : "objectif atteint") + '</span>';

    var protoPct = Math.min(1, tot.p / Math.max(1, pro));

    var h = '' +
      '<div class="top">' +
      '<div><p class="hello">' + dayLabel(d) + ' · ' + fromKey(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long" }) + '</p>' +
      '<h1 class="title">Bonjour ' + esc(p.prenom) + '</h1></div>' +
      (st > 0 ? '<div class="chip" style="pointer-events:none">🔥 ' + st + ' j</div>' : '') +
      '</div>' +

      '<div class="card">' +
      '<div class="ring-wrap">' +
      '<div class="ring"><svg width="132" height="132" viewBox="0 0 132 132" aria-hidden="true">' +
      '<circle cx="66" cy="66" r="56" fill="none" stroke="var(--line)" stroke-width="11"/>' +
      '<circle cx="66" cy="66" r="56" fill="none" stroke="var(--accent)" stroke-width="11" stroke-linecap="round" ' +
      'stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' + (C * (1 - pct)).toFixed(1) + '"/>' +
      '</svg><div class="center">' + ringCenter + '</div></div>' +
      '<div class="ring-stats">' +
      '<div class="stat-line"><span>Consommé</span><b>' + (simple ? "—" : tot.k + " kcal") + '</b></div>' +
      '<div class="stat-line"><span>Objectif</span><b>' + (simple ? "—" : obj + " kcal") + '</b></div>' +
      '<div class="macro"><div class="track"><div class="fill" style="width:' + (protoPct * 100).toFixed(0) + '%"></div></div>' +
      '<div class="mini"><span>Protéines</span><span>' + fr(tot.p) + ' / ' + pro + ' g</span></div></div>' +
      '</div></div></div>' +

      '<div class="note-bar' + (msg.warm ? " warm" : "") + '"><span class="ico">' + msg.ico + '</span><span>' + msg.txt + '</span></div>';

    h += '<div class="card" style="padding:14px 18px 6px">' +
      '<div class="card-t"><h3>Mes repas</h3>' +
        '<button class="more" data-act="openAdd" data-moment="' + guessMoment() + '">' + notedMeals + '/4 · ajouter +</button></div>';
    MOMENTS.forEach(function (m) {
      var items = itemsFor(d, m.id);
      var k = items.reduce(function (a, x) { return a + (x.it.k || 0); }, 0);
      var detail = items.length
        ? items.map(function (x) { return esc(x.it.nom); }).join(" · ")
        : "Rien pour l'instant";
      h += '<div class="meal">' +
        '<div class="meal-ico">' + m.ico + '</div>' +
        '<div class="meal-body"><div class="meal-name"><span>' + m.nom + '</span>' +
        '<span class="kcal">' + (items.length ? (simple ? "noté ✓" : r0(k) + " kcal") : "") + '</span></div>' +
        '<div class="meal-items">' + detail +
        (items.length ? ' <button class="link-mini" data-act="clearMeal" data-moment="' + m.id + '" aria-label="Retirer ce repas">✕</button>' : '') +
        '</div>' +
        '</div>' +
        '<button class="meal-add" data-act="openAdd" data-moment="' + m.id + '" aria-label="Ajouter à ' + m.nom + '">+</button>' +
        '</div>';
    });
    h += '</div>';

    var verres = waterFor(d);
    h += '<div class="card"><div class="card-t"><h3>Eau</h3><span class="more">' + r1(verres * 0.2) + ' L / 1,6 L</span></div>' +
      '<div class="drops">' + Array.from({ length: 8 }).map(function (_, i) {
        return '<button class="drop' + (i < verres ? " on" : "") + '" data-act="water" data-i="' + i + '" aria-label="verre ' + (i + 1) + '">' +
          '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M12 2.3c3.4 4 6 7.4 6 10.2a6 6 0 0 1-12 0c0-2.8 2.6-6.2 6-10.2z"/></svg></button>';
      }).join("") + '</div></div>';

    h += '<div class="card" style="padding:14px 18px"><div class="share-row">' +
      '<div class="lb">Partager ma journée<small>Envoyer le récap sur WhatsApp</small></div>' +
      '<button class="btn small soft" data-act="shareDay">Envoyer →</button></div></div>';

    return h;
  }

  function guessMoment() {
    var h = new Date().getHours();
    if (h < 11) return "petitdej";
    if (h < 16) return "dejeuner";
    if (h < 22) return "diner";
    return "collation";
  }

  /* ============================================================
     FEUILLE « AJOUTER UN REPAS »
     ============================================================ */
  var sheet = null;

  function openAdd(moment) {
    toastEl.classList.remove("on");
    sheet = { moment: moment || guessMoment(), tab: "search", q: "", pick: null, qty: 1, pIdx: 0 };
    renderSheet(true);
  }

  function closeSheet() {
    var bg = document.querySelector(".sheet-bg");
    var sh = document.querySelector(".sheet");
    if (bg) bg.classList.remove("on");
    if (sh) sh.classList.remove("on");
    setTimeout(function () { sheetRoot.innerHTML = ""; }, 260);
    sheet = null;
  }

  function renderSheet(withAnim) {
    if (!sheet) return;
    sheetRoot.innerHTML = '<div class="sheet-bg' + (withAnim ? "" : " on") + '"></div>' +
      '<div class="sheet' + (withAnim ? "" : " on") + '"><div class="sheet-inner" id="sheet-inner"></div></div>';
    renderSheetInner();
    if (withAnim) {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          var bg = document.querySelector(".sheet-bg"), sh = document.querySelector(".sheet");
          if (bg) bg.classList.add("on");
          if (sh) sh.classList.add("on");
        });
      });
    }
  }

  function renderSheetInner() {
    var inner = document.getElementById("sheet-inner");
    if (!inner) return;
    var mom = MOMENTS.filter(function (m) { return m.id === sheet.moment; })[0] || MOMENTS[0];

    if (sheet.pick) { inner.innerHTML = sheetDetailHTML(mom); bindSheetDetail(); return; }

    inner.innerHTML = '' +
      '<div class="sheet-head"><div class="grab"></div>' +
      '<div class="ht"><h3>Ajouter au ' + mom.short.toLowerCase() + '</h3><button class="x" data-act="closeSheet">✕</button></div>' +
      '<div class="chips">' + MOMENTS.map(function (m) {
        return '<button class="chip' + (m.id === sheet.moment ? " on" : "") + '" data-act="sheetMoment" data-moment="' + m.id + '">' + m.ico + ' ' + m.short + '</button>';
      }).join("") + '</div>' +
      '<div class="chips">' + [["search", "🔍 Rechercher"], ["recent", "🕐 Récents"], ["favs", "⭐ Favoris"], ["quick", "⚡ Saisie rapide"]]
        .map(function (t) {
          return '<button class="chip' + (sheet.tab === t[0] ? " on" : "") + '" data-act="sheetTab" data-tab="' + t[0] + '">' + t[1] + '</button>';
        }).join("") + '</div>' +
      (sheet.tab === "search" ? '<input class="input" id="food-q" type="search" placeholder="Chercher un aliment…" autocomplete="off" value="' + esc(sheet.q) + '">' : "") +
      '</div>' +
      '<div class="sheet-body"><div id="food-list"></div></div>';

    renderFoodList();

    var inp = document.getElementById("food-q");
    if (inp) {
      inp.addEventListener("input", function () { sheet.q = inp.value; renderFoodList(); });
    }
  }

  function norm(s) {
    return (s || "").toString().toLowerCase()
      .normalize ? (s || "").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : (s || "").toString().toLowerCase();
  }

  function recentFoods() {
    var seen = {}, out = [];
    for (var i = S.meals.length - 1; i >= 0 && out.length < 12; i--) {
      (S.meals[i].items || []).forEach(function (it) {
        if (it.fid && !seen[it.fid]) {
          seen[it.fid] = 1;
          var f = foodById(it.fid);
          if (f) out.push(f);
        }
      });
    }
    return out;
  }

  function renderFoodList() {
    var list = document.getElementById("food-list");
    if (!list) return;
    var html = "";

    if (sheet.tab === "quick") {
      html = '<div class="field" style="margin-top:6px"><label>Nom du repas</label>' +
        '<input class="input" id="q-nom" type="text" placeholder="Ex. déjeuner au restaurant"></div>' +
        '<div class="field"><label>Calories estimées</label>' +
        '<input class="input" id="q-kcal" type="number" inputmode="numeric" placeholder="Ex. 600"></div>' +
        '<button class="btn" data-act="saveQuick">Enregistrer</button>' +
        '<p class="empty" style="padding-top:16px">Une estimation vaut toujours mieux qu\'un oubli.</p>';
      list.innerHTML = html;
      return;
    }

    if (sheet.tab === "recent") {
      var rec = recentFoods();
      var hier = itemsFor(addDays(todayKey(), -1), sheet.moment);
      html += hier.length
        ? '<button class="btn soft" style="margin:8px 0 4px" data-act="copyYesterday">↺ Remettre le ' + (MOMENTS.filter(function (m) { return m.id === sheet.moment; })[0].short.toLowerCase()) + ' d\'hier (' + hier.length + ' aliment' + (hier.length > 1 ? "s" : "") + ')</button>'
        : "";
      html += rec.length
        ? rec.map(function (f) { return foodRow(f); }).join("")
        : '<p class="empty">Tes aliments récents apparaîtront ici.</p>';
      list.innerHTML = html;
      return;
    }

    if (sheet.tab === "favs") {
      var favs = S.favs.map(foodById).filter(Boolean);
      list.innerHTML = favs.length
        ? favs.map(function (f) { return foodRow(f); }).join("")
        : '<p class="empty">Ajoute une étoile ⭐ à un aliment pour le retrouver ici en un tap.</p>';
      return;
    }

    var q = norm(sheet.q).trim();
    var foods = allFoods();
    if (q) {
      foods = foods.filter(function (f) { return norm(f.n).indexOf(q) >= 0 || norm(f.c).indexOf(q) >= 0; });
    }
    if (!q) {
      var groups = {};
      foods.slice(0, 200).forEach(function (f) { (groups[f.c] = groups[f.c] || []).push(f); });
      html = Object.keys(groups).map(function (c) {
        return '<p class="sub" style="margin:14px 0 2px;font-weight:650;color:var(--ink)">' + esc(c) + '</p>' +
          groups[c].slice(0, 12).map(foodRow).join("");
      }).join("");
    } else {
      html = foods.length ? foods.slice(0, 60).map(foodRow).join("") : '<p class="empty">Aucun aliment trouvé.<br>Utilise « Saisie rapide » pour l\'ajouter quand même.</p>';
    }
    list.innerHTML = html;
  }

  function foodRow(f) {
    var g = defaultPortion(f);
    return '<button class="food-row" data-act="pickFood" data-fid="' + f.id + '">' +
      '<span class="nm">' + esc(f.n) + '<small>' + esc((f.portions && f.portions[0] ? f.portions[0][0] : "100 g")) + ' · ' + esc(f.c) + '</small></span>' +
      '<span class="kc">' + r0(f.k * g / 100) + ' kcal</span></button>';
  }

  function sheetDetailHTML(mom) {
    var f = sheet.pick;
    var po = f.portions && f.portions.length ? f.portions : [["100 g", 100]];
    var p = po[Math.min(sheet.pIdx, po.length - 1)];
    var grams = p[1] * sheet.qty;
    var k = f.k * grams / 100, pr = f.p * grams / 100, gc = f.g * grams / 100, li = f.l * grams / 100;
    var isFav = S.favs.indexOf(f.id) >= 0;
    return '' +
      '<div class="sheet-head"><div class="grab"></div>' +
      '<div class="ht"><h3 style="font-size:17px">' + esc(f.n) + '</h3><button class="x" data-act="closeSheet">✕</button></div>' +
      '<p class="sub">' + esc(f.c) + ' · ' + r0(f.k) + ' kcal / 100 g</p>' +
      '</div>' +
      '<div class="sheet-body">' +
      '<p class="sub" style="margin:14px 0 6px">Quelle quantité ?</p>' +
      '<div class="chips">' + po.map(function (pt, i) {
        return '<button class="chip' + (i === sheet.pIdx ? " on" : "") + '" data-act="portion" data-i="' + i + '">' + esc(pt[0]) + '</button>';
      }).join("") + '</div>' +
      '<div class="stepper"><button data-act="qty" data-d="-0.5">−</button>' +
      '<div class="val">' + sheet.qty + ' ×</div>' +
      '<button data-act="qty" data-d="0.5">+</button></div>' +
      '<div class="pick-total">' + r0(k) + ' <span>kcal</span></div>' +
      '<p class="sub" style="text-align:center;margin-bottom:16px">' + r0(grams) + ' g · P ' + fr(r1(pr)) + ' · G ' + fr(r1(gc)) + ' · L ' + fr(r1(li)) + '</p>' +
      '<button class="btn" data-act="confirmAdd">Ajouter au ' + mom.short.toLowerCase() + '</button>' +
      '<div class="row2" style="margin-top:10px">' +
      '<button class="btn ghost small" style="width:100%" data-act="toggleFav" data-fid="' + f.id + '">' + (isFav ? "★ Retirer des favoris" : "☆ Favori") + '</button>' +
      '<button class="btn ghost small" style="width:100%" data-act="backList">← Retour</button>' +
      '</div></div>';
  }

  function bindSheetDetail() { /* tout passe par la délégation */ }

  function confirmAdd() {
    var f = sheet.pick;
    var po = f.portions && f.portions.length ? f.portions : [["100 g", 100]];
    var p = po[Math.min(sheet.pIdx, po.length - 1)];
    var grams = p[1] * sheet.qty;
    var item = {
      fid: f.id, nom: f.n,
      portion: sheet.qty + " × " + p[0],
      grammes: r0(grams),
      k: r1(f.k * grams / 100), p: r1(f.p * grams / 100),
      g: r1(f.g * grams / 100), l: r1(f.l * grams / 100)
    };
    addItem(sheet.moment, item);
  }

  function addItem(moment, item) {
    var d = todayKey();
    S.meals.push({ id: uid(), date: d, moment: moment, items: [item], ts: Date.now() });
    touchStreak(d);
    save();
    var tot = totalsFor(d), rest = targetKcal() - tot.k;
    render();
    if (rest > 0) toast("Noté ! Il te reste ~" + rest + " kcal");
    else toast("Noté. Journée un peu plus généreuse 🌱");
    if (sheet) { sheet.pick = null; sheet.qty = 1; sheet.pIdx = 0; renderSheetInner(); }
  }

  /* ============================================================
     PROGRÈS
     ============================================================ */
  function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function monthLabel(m) {
    var d = fromKey(m + "-01");
    return capitalize(d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }));
  }
  function monthGroups() {
    var w = weightsSorted(), g = {};
    w.forEach(function (x) {
      var m = x.date.slice(0, 7);
      (g[m] = g[m] || []).push(x);
    });
    return Object.keys(g).sort().reverse().map(function (m) {
      var arr = g[m], sum = 0;
      arr.forEach(function (x) { sum += +x.kg; });
      return {
        month: m, n: arr.length,
        first: +arr[0].kg, last: +arr[arr.length - 1].kg,
        avg: r1(sum / arr.length),
        items: arr.slice().reverse()
      };
    });
  }

  function weightsSorted() {
    return S.weights.slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; });
  }
  function trendInfo() {
    var w = weightsSorted();
    if (!w.length) return { val: null, mode: "none", n: 0 };
    var lim = addDays(todayKey(), -6);
    var rec = w.filter(function (x) { return x.date >= lim; });
    if (rec.length >= 2) {
      var sum = 0; rec.forEach(function (x) { sum += +x.kg; });
      return { val: sum / rec.length, mode: "avg", n: rec.length };
    }
    return { val: +w[w.length - 1].kg, mode: "last", n: 1 };
  }
  function trend7() { var t = trendInfo(); return t.val; }
  function chartSVG(rangeDays) {
    var w = weightsSorted().filter(function (x) { return x.date >= addDays(todayKey(), -rangeDays); });
    if (w.length === 0) return '<p class="empty">Aucune pesée enregistrée sur cette période.<br><span class="muted">Essaie une période plus longue (90 jours ou 1 an).</span></p>';
    if (w.length === 1) return '<p class="empty">Encore une pesée ou deux et la courbe apparaîtra 🌱<br><span class="muted">Dernière pesée : ' + fr(w[0].kg) + ' kg</span></p>';
    var W = 320, H = 150, pl = 34, pr = 8, pt = 12, pb = 22;
    var kgs = w.map(function (x) { return +x.kg; });
    var min = Math.min.apply(null, kgs), max = Math.max.apply(null, kgs);
    if (S.profile.cible) { min = Math.min(min, S.profile.cible); max = Math.max(max, S.profile.cible); }
    if (max - min < 1) { max += 0.5; min -= 0.5; }
    min = Math.floor((min - 0.3) * 2) / 2; max = Math.ceil((max + 0.3) * 2) / 2;
    var t0 = fromKey(w[0].date).getTime(), t1 = fromKey(w[w.length - 1].date).getTime();
    if (t1 === t0) { t1 = t0 + 86400000; }
    function X(key) { return pl + ((fromKey(key).getTime() - t0) / (t1 - t0)) * (W - pl - pr); }
    function Y(kg) { return pt + ((max - kg) / (max - min)) * (H - pt - pb); }

    var s = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Évolution du poids">';
    [0, 0.5, 1].forEach(function (f) {
      var kg = min + f * (max - min), y = Y(kg);
      s += '<line x1="' + pl + '" y1="' + y + '" x2="' + (W - pr) + '" y2="' + y + '" stroke="var(--line)" stroke-width="1"/>';
      s += '<text x="' + (pl - 6) + '" y="' + (y + 3.5) + '" font-size="9" fill="var(--ink-soft)" text-anchor="end">' + (Math.round(kg * 10) / 10) + '</text>';
    });
    if (S.profile.cible && S.profile.cible >= min && S.profile.cible <= max) {
      var yc = Y(S.profile.cible);
      s += '<line x1="' + pl + '" y1="' + yc + '" x2="' + (W - pr) + '" y2="' + yc + '" stroke="var(--sage)" stroke-width="1.2" stroke-dasharray="4 3"/>';
      s += '<text x="' + (W - pr) + '" y="' + (yc - 4) + '" font-size="9" fill="var(--sage)" text-anchor="end">objectif</text>';
    }
    var pts = w.map(function (x) { return [X(x.date), Y(+x.kg)]; });
    s += '<polyline points="' + pts.map(function (p) { return p[0].toFixed(1) + "," + p[1].toFixed(1); }).join(" ") + '" fill="none" stroke="var(--accent)" stroke-opacity=".28" stroke-width="1.6"/>';
    pts.forEach(function (p) { s += '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="2.6" fill="var(--accent)" fill-opacity=".45"/>'; });
    var ma = w.map(function (x, i) {
      var sl = w.slice(Math.max(0, i - 6), i + 1);
      var sum = 0; sl.forEach(function (z) { sum += +z.kg; });
      return [X(x.date), Y(sum / sl.length)];
    });
    s += '<polyline points="' + ma.map(function (p) { return p[0].toFixed(1) + "," + p[1].toFixed(1); }).join(" ") + '" fill="none" stroke="var(--sage)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>';
    s += '<text x="' + pl + '" y="' + (H - 6) + '" font-size="9" fill="var(--ink-soft)">' + shortDate(w[0].date) + '</text>';
    s += '<text x="' + (W - pr) + '" y="' + (H - 6) + '" font-size="9" fill="var(--ink-soft)" text-anchor="end">' + shortDate(w[w.length - 1].date) + '</text>';
    s += '</svg>';
    return s;
  }

  function viewProgress() {
    var w = weightsSorted();
    var cur = w.length ? +w[w.length - 1].kg : +S.profile.poids;
    var tr = trend7();
    var start = w.length ? +w[0].kg : +S.profile.poids;
    var lost = r1(start - cur);
    var rest = S.profile.cible ? r1(cur - S.profile.cible) : null;
    var p = S.profile;

    var rate = "—";
    if (w.length >= 2) {
      var old = w[0], recent = w[w.length - 1];
      var days = Math.max(1, (fromKey(recent.date) - fromKey(old.date)) / 86400000);
      var perWeek = (old.kg - recent.kg) / days * 7;
      rate = (perWeek > 0 ? "−" : "+") + fr(Math.abs(r1(perWeek))) + " kg / sem.";
    }

    var d7 = lastDays(7), d30 = lastDays(30);
    var n7 = daysNoted(d7), n30 = daysNoted(d30);

    var h = '<div class="top"><div><p class="hello">Ta progression</p><h1 class="title">Progrès</h1></div></div>';

    var ti = trendInfo();
    h += '<div class="card"><p class="sub">' + (ti.mode === "avg" ? "Tendance (moyenne 7 jours)" : "Dernière pesée") + '</p>' +
      '<p class="big-num">' + (tr ? fr(r1(tr)) : "—") + ' <span style="font-size:15px;font-weight:500;color:var(--ink-soft)">kg</span></p>' +
      '<div class="stat-grid">' +
      '<div><p class="sub">Depuis le départ</p><p class="sv">' + (lost > 0 ? "−" + fr(Math.abs(lost)) + " kg" : (lost < 0 ? "+" + fr(Math.abs(lost)) + " kg" : "—")) + '</p></div>' +
      '<div><p class="sub">Reste pour l\'objectif</p><p class="sv">' + (rest !== null ? (rest > 0 ? fr(r1(rest)) + " kg" : "atteint ✨") : "—") + '</p></div>' +
      '<div><p class="sub">Rythme</p><p class="sv">' + rate + '</p></div>' +
      '<div><p class="sub">Pesées</p><p class="sv">' + w.length + '</p></div>' +
      '</div>' +
      '<p class="disclaimer" style="text-align:left;padding:8px 0 0">La tendance lisse les variations normales de la journée (eau, sel, cycle). C\'est elle qui compte, pas le chiffre du matin.</p>' +
      '</div>';

    h += '<div class="card"><div class="card-t"><h3>Noter une pesée</h3></div>' +
      '<div class="row2"><div class="field" style="margin:0"><label for="kg-in">Poids (kg)</label>' +
      '<input class="input" id="kg-in" type="number" inputmode="decimal" step="0.1" placeholder="Ex. ' + fr(cur) + '"></div>' +
      '<div class="field" style="margin:0"><label for="kg-date">Date</label>' +
      '<input class="input" id="kg-date" type="date" value="' + todayKey() + '" max="' + todayKey() + '"></div></div>' +
      '<button class="btn" style="margin-top:12px" data-act="saveWeight">Enregistrer</button>' +
      '<p class="disclaimer" style="text-align:left;padding-top:10px">Une fois par jour, par semaine ou par mois — comme tu préfères. Choisis une date passée pour compléter l\'historique : réenregistrer une date remplace la pesée du jour.</p></div>';

    var months = monthGroups();
    if (months.length) {
      h += '<div class="card"><div class="card-t"><h3>Par mois</h3><span class="more">' + months.length + ' mois suivis</span></div>';
      months.slice(0, 8).forEach(function (mo, i) {
        var prev = months[i + 1];
        var delta = prev ? r1(mo.avg - prev.avg) : null;
        var cls = delta === null ? "flat" : (delta < 0 ? "down" : (delta > 0 ? "up" : "flat"));
        var txt = delta === null ? "—" : (delta === 0 ? "=" : (delta < 0 ? "−" : "+") + one(Math.abs(delta)) + " kg");
        h += '<div class="month-row">' +
          '<div class="mleft"><p class="mv">' + monthLabel(mo.month) + '</p>' +
          '<p class="sub">' + mo.n + ' pesée' + (mo.n > 1 ? "s" : "") + ' · moy. ' + one(mo.avg) + ' kg</p></div>' +
          '<div class="mdelta ' + cls + '">' + txt + '</div></div>';
      });
      h += '<p class="disclaimer" style="text-align:left;padding-top:8px">La colonne de droite compare la <b>moyenne du mois</b> à celle du mois précédent : c\'est le chiffre le plus fiable pour voir une vraie évolution.</p></div>';
    }

    var defRange = 30;
    [30, 90, 365].some(function (rg) {
      var cnt = w.filter(function (x) { return x.date >= addDays(todayKey(), -rg); }).length;
      if (cnt >= 2) { defRange = rg; return true; }
      return false;
    });
    var rangeLabel = defRange === 30 ? "30 jours" : defRange === 90 ? "90 jours" : "1 an";
    h += '<div class="card"><div class="card-t"><h3>Courbe</h3><span class="more" id="range-t">' + rangeLabel + '</span></div>' +
      '<div class="chips">' + [[30, "30 jours"], [90, "90 jours"], [365, "1 an"]].map(function (o) {
        return '<button class="chip' + (o[0] === defRange ? " on" : "") + '" data-act="range" data-d="' + o[0] + '">' + o[1] + '</button>';
      }).join("") + '</div>' +
      '<div id="chart-box">' + chartSVG(defRange) + '</div></div>';

    h += '<div class="card"><div class="card-t"><h3>Régularité</h3><span class="more">' + n7 + '/7 · ' + n30 + '/30</span></div>' +
      '<div class="bars">' + d7.map(function (k) {
        var has = mealsOn(k).length > 0;
        return '<div class="bar' + (has ? " on" : "") + '"></div>';
      }).join("") + '</div>' +
      '<div class="legend">' + d7.map(function (k) { return '<span>' + fromKey(k).toLocaleDateString("fr-FR", { weekday: "narrow" }) + '</span>'; }).join("") + '</div>' +
      '<p class="sub" style="margin-top:10px">' + (n7 >= 5 ? "Belle régularité — c'est exactement ça qui fait la différence." : "Chaque jour noté compte. On vise 5 jours sur 7, sans pression.") + '</p></div>';

    h += '<div class="card"><div class="card-t"><h3>Toutes mes pesées</h3><span class="more">' + w.length + ' au total</span></div>';
    if (!w.length) {
      h += '<p class="empty">Aucune pesée enregistrée pour l\'instant.</p>';
    } else {
      months.forEach(function (mo) {
        h += '<p class="mgroup">' + monthLabel(mo.month) + '</p>';
        mo.items.forEach(function (x) {
          h += '<div class="hist"><span class="d">' + fromKey(x.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }) + '</span>' +
            '<span class="wval">' + fr(x.kg) + ' kg' +
            '<button class="link-mini" data-act="delWeight" data-date="' + x.date + '" aria-label="Supprimer la pesée du ' + x.date + '">✕</button></span></div>';
        });
      });
    }
    h += '</div>';

    h += '<div class="card"><div class="card-t"><h3>Bilan de la semaine</h3></div>' + weeklyRecap() + '</div>';

    h += '<div class="card"><div class="card-t"><h3>Derniers jours</h3></div>' +
      lastDays(7).slice().reverse().map(function (k) {
        var t = totalsFor(k);
        var wt = S.weights.filter(function (x) { return x.date === k; })[0];
        return '<div class="hist"><span class="d">' + dayLabel(k) + '</span>' +
          '<span>' + (t.k ? r0(t.k) + ' kcal' : '<span class="muted">non noté</span>') +
          (wt ? ' · ' + fr(wt.kg) + ' kg' : '') + '</span></div>';
      }).join("") + '</div>';

    return h;
  }

  function weeklyRecap() {
    var days = lastDays(7);
    var noted = days.filter(function (k) { return mealsOn(k).length > 0; });
    if (!noted.length) return '<p class="sub">Rien à résumer pour l\'instant — la semaine commence quand tu veux.</p>';
    var kTotal = 0, pTotal = 0;
    noted.forEach(function (k) { var t = totalsFor(k); kTotal += t.k; pTotal += t.p; });
    var avgK = r0(kTotal / noted.length), avgP = r0(pTotal / noted.length);
    var obj = targetKcal();
    var w = weightsSorted();
    var delta = null;
    if (w.length >= 2) {
      var a = w[0], b = w[w.length - 1];
      delta = r1(a.kg - b.kg);
    }
    var lines = [];
    lines.push("📅 <b>" + noted.length + " jour" + (noted.length > 1 ? "s" : "") + " sur 7</b> notés.");
    lines.push("🍽️ Moyenne : <b>" + avgK + " kcal</b> (objectif " + obj + ") · " + avgP + " g de protéines.");
    if (delta !== null) {
      lines.push(delta > 0 ? "⚖️ <b>−" + fr(Math.abs(delta)) + " kg</b> depuis ta première pesée." : "⚖️ Poids stable — c'est déjà une réussite en maintien.");
    }
    lines.push(avgK <= obj + 100 ? "🌿 Semaine cohérente avec ton objectif. Continue comme ça." : "🌱 Semaine généreuse — rien de grave, on repart en douceur.");
    return '<div style="display:grid;gap:8px;font-size:13.5px">' + lines.map(function (l) { return '<p>' + l + '</p>'; }).join("") + '</div>';
  }

  /* ============================================================
     RÉGLAGES
     ============================================================ */
  function viewSettings() {
    var p = S.profile;
    var t = computeTargets(p);
    var standalone = window.navigator.standalone === true || (window.matchMedia ? window.matchMedia("(display-mode: standalone)").matches : false);
    var isiOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

    var h = '<div class="top"><div><p class="hello">Tout est modifiable</p><h1 class="title">Réglages</h1></div></div>';

    h += '<div class="card"><div class="card-t"><h3>Mon profil</h3></div>' +
      '<div class="field"><label for="st-prenom">Prénom</label><input class="input" id="st-prenom" value="' + esc(p.prenom) + '"></div>' +
      '<div class="row2"><div class="field"><label for="st-poids">Poids (kg)</label><input class="input" id="st-poids" type="number" inputmode="decimal" step="0.1" value="' + p.poids + '"></div>' +
      '<div class="field"><label for="st-cible">Objectif (kg)</label><input class="input" id="st-cible" type="number" inputmode="decimal" step="0.1" value="' + p.cible + '"></div></div>' +
      '<div class="field"><label for="st-act">Activité</label><select class="input" id="st-act">' +
      Object.keys(ACTIVITES).map(function (k) {
        return '<option value="' + k + '"' + (p.activite === k ? " selected" : "") + '>' + ACTIVITES[k].nom + '</option>';
      }).join("") + '</select></div>' +
      '<button class="btn ghost" data-act="saveProfile">Enregistrer</button></div>';

    h += '<div class="card"><div class="card-t"><h3>Objectif quotidien</h3><button class="more" data-act="recalc">recalculer</button></div>' +
      '<div class="row2"><div class="field"><label for="st-kcal">Calories</label><input class="input" id="st-kcal" type="number" inputmode="numeric" step="25" value="' + (p.objKcal || t.obj) + '"></div>' +
      '<div class="field"><label for="st-prot">Protéines (g)</label><input class="input" id="st-prot" type="number" inputmode="numeric" value="' + (p.prot || t.prot) + '"></div></div>' +
      '<div class="row2"><div class="field"><label for="st-gluc">Glucides (g)</label><input class="input" id="st-gluc" type="number" inputmode="numeric" value="' + (p.gluc || t.gluc) + '"></div>' +
      '<div class="field"><label for="st-lip">Lipides (g)</label><input class="input" id="st-lip" type="number" inputmode="numeric" value="' + (p.lip || t.lip) + '"></div></div>' +
      '<button class="btn ghost" data-act="saveTargets">Enregistrer</button>' +
      '<p class="disclaimer" style="text-align:left;padding-top:10px">Estimation automatique : ' + t.obj + ' kcal (métabolisme ' + t.mb + ' kcal de base + activité). Jamais moins de 1 200 kcal.</p></div>';

    h += '<div class="card"><div class="card-t"><h3>Affichage</h3></div>' +
      '<div class="field"><label>Thème</label><div class="seg" id="st-theme">' +
      [["auto", "Auto"], ["light", "Clair"], ["dark", "Sombre"]].map(function (o) {
        return '<button data-v="' + o[0] + '" class="' + (S.settings.theme === o[0] ? "on" : "") + '">' + o[1] + '</button>';
      }).join("") + '</div></div>' +
      '<div class="switch-row"><div class="lb">Mode simple<small>Masque les calories, affiche seulement les repas notés</small></div>' +
      '<button class="sw' + (S.settings.modeSimple ? " on" : "") + '" data-act="toggleSimple" aria-label="Mode simple"></button></div></div>';

    h += '<div class="card"><div class="card-t"><h3>Rappels</h3></div>' +
      '<div class="switch-row"><div class="lb">Rappel quotidien iPhone<small>Chaque jour à 20 h : « noter mes repas »</small></div>' +
      '<button class="btn small ghost" data-act="ics">.ics</button></div>' +
      '<div class="switch-row"><div class="lb">Rappel pesée mensuelle<small>Le 1<sup>er</sup> de chaque mois à 8 h</small></div>' +
      '<button class="btn small ghost" data-act="icsMonth">.ics</button></div>' +
      '<div class="switch-row"><div class="lb">Rappels WhatsApp<small>À configurer une fois — voir README</small></div>' +
      '<button class="btn small soft" data-act="waInfo">Voir</button></div>' +
      (standalone ? "" : '<p class="sub" style="margin-top:10px">' + (isiOS ? "Astuce : dans Safari, touche <b>Partager</b> → <b>Sur l'écran d'accueil</b> pour avoir EmmaFit comme une vraie app." : "Installe EmmaFit comme application depuis le menu du navigateur.") + '</p>') +
      '</div>';

    h += '<div class="card"><div class="card-t"><h3>Ma sauvegarde</h3></div>' +
      '<p class="sub" style="margin-bottom:10px">Les données restent sur cet iPhone. Exporte régulièrement un fichier de secours.' +
      (S.settings.lastExport ? " Dernier export : " + dayLabel(dateKey(new Date(S.settings.lastExport))).toLowerCase() + "." : "") + '</p>' +
      '<div class="row2"><button class="btn soft" style="width:100%" data-act="export">Exporter</button>' +
      '<button class="btn ghost" style="width:100%" data-act="import">Importer</button></div>' +
      '<input type="file" id="file-in" accept="application/json,.json" class="hidden">' +
      '<button class="btn danger" style="margin-top:10px" data-act="reset">Tout recommencer</button></div>';

    h += '<p class="disclaimer">EmmaFit v1.0 · données 100 % locales · pas de compte, pas de pistage.<br>' +
      'Cet outil ne remplace pas un professionnel de santé.</p>';

    return h;
  }

  /* ============================================================
     ACTIONS
     ============================================================ */
  function saveWeight() {
    var el = document.getElementById("kg-in");
    var dEl = document.getElementById("kg-date");
    var kg = parseFloat(((el && el.value) || "").replace(",", "."));
    var date = (dEl && dEl.value) || todayKey();
    if (date > todayKey()) date = todayKey();
    if (!kg || kg < 25 || kg > 250) { toast("Indique un poids valide"); return; }
    var ex = S.weights.filter(function (x) { return x.date === date; })[0];
    var existed = !!ex;
    if (ex) ex.kg = kg; else S.weights.push({ date: date, kg: kg });
    S.weights.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    S.profile.poids = +weightsSorted()[weightsSorted().length - 1].kg;
    save(); render();
    toast(existed ? "Pesée du " + shortDate(date) + " mise à jour ✓" : "Pesée enregistrée ⚖️");
  }

  function shareDay() {
    var d = todayKey();
    var tot = totalsFor(d);
    var obj = targetKcal();
    var lines = ["*EmmaFit* — " + fromKey(d).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })];
    MOMENTS.forEach(function (m) {
      var items = itemsFor(d, m.id);
      if (!items.length) return;
      var k = items.reduce(function (a, x) { return a + (x.it.k || 0); }, 0);
      lines.push(m.ico + " " + m.nom + " : " + items.map(function (x) { return x.it.nom; }).join(", ") + " (" + r0(k) + " kcal)");
    });
    lines.push("");
    lines.push("Total : " + tot.k + " / " + obj + " kcal");
    lines.push("Eau : " + fr(r1(waterFor(d) * 0.2)) + " L");
    var st = streakNow();
    if (st > 0) lines.push("Série : " + st + " jours 🔥");
    var txt = lines.join("\n");
    if (navigator.share) {
      navigator.share({ title: "EmmaFit", text: txt }).catch(function () { });
    } else {
      window.open("https://wa.me/?text=" + encodeURIComponent(txt), "_blank");
    }
  }

  function exportJSON() {
    var data = JSON.stringify(S, null, 2);
    var blob = new Blob([data], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "emmafit-sauvegarde-" + todayKey() + ".json";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    S.settings.lastExport = Date.now(); save();
    toast("Sauvegarde exportée");
  }

  function importJSON(file) {
    var fr = new FileReader();
    fr.onload = function () {
      try {
        var data = JSON.parse(fr.result);
        if (!data || typeof data !== "object" || !data.profile) throw 0;
        if (!confirm("Remplacer les données actuelles par cette sauvegarde ?")) return;
        localStorage.setItem(KEY, JSON.stringify(data));
        S = load(); render();
        toast("Sauvegarde restaurée ✓");
      } catch (e) { toast("Fichier illisible"); }
    };
    fr.readAsText(file);
  }

  function downloadICS(kind) {
    var monthly = kind === "month";
    var d = new Date();
    if (monthly) { d = new Date(d.getFullYear(), d.getMonth() + 1, 1); }
    else { d.setDate(d.getDate() + 1); }
    var stamp = dateKey(d).replace(/-/g, "") + (monthly ? "T080000" : "T200000");
    var summary = monthly ? "EmmaFit — pesée du mois" : "EmmaFit — noter mes repas";
    var desc = monthly ? "Note ton poids dans EmmaFit (une fois par mois suffit)." : "Un petit point sur la journée. 30 secondes suffisent.";
    var rrule = monthly ? "RRULE:FREQ=MONTHLY" : "RRULE:FREQ=DAILY";
    var ics = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//EmmaFit//Rappel//FR", "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT",
      "UID:emmafit-rappel-" + Date.now() + "@emmafit",
      "DTSTAMP:" + new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z",
      "DTSTART:" + stamp,
      "DTEND:" + dateKey(d).replace(/-/g, "") + (monthly ? "T081500" : "T201500"),
      rrule,
      "SUMMARY:" + summary,
      "DESCRIPTION:" + desc,
      "BEGIN:VALARM", "TRIGGER:PT0M", "ACTION:DISPLAY", "DESCRIPTION:" + summary, "END:VALARM",
      "END:VEVENT", "END:VCALENDAR"
    ].join("\r\n");
    var blob = new Blob([ics], { type: "text/calendar" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = monthly ? "emmafit-rappel-pesee-mensuelle.ics" : "emmafit-rappel.ics";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    toast(monthly ? "Rappel mensuel téléchargé 🗓️" : "Rappel téléchargé — ouvre-le pour l'ajouter au Calendrier");
  }

  function resetAll() {
    if (!confirm("Effacer toutes tes données EmmaFit ?")) return;
    if (!confirm("Vraiment ? Cette action est définitive (pense à exporter avant).")) return;
    localStorage.removeItem(KEY);
    S = load(); view = "home"; render();
    toast("Tout est réinitialisé");
  }

  /* ---------------- délégation d'événements ---------------- */
  document.addEventListener("click", function (e) {
    var el = e.target.closest("[data-act]");
    if (!el) {
      if (e.target.classList && e.target.classList.contains("sheet-bg")) closeSheet();
      return;
    }
    var act = el.dataset.act;

    switch (act) {
      case "tab":
        view = el.dataset.view; render(); window.scrollTo(0, 0);
        break;

      case "start":
        startApp();
        break;

      case "openAdd":
        openAdd(el.dataset.moment);
        break;

      case "closeSheet":
        closeSheet();
        break;

      case "sheetMoment":
        sheet.moment = el.dataset.moment; renderSheetInner();
        break;

      case "sheetTab":
        sheet.tab = el.dataset.tab; renderSheetInner();
        if (sheet.tab === "search") {
          var q = document.getElementById("food-q");
          if (q) { q.focus(); }
        }
        break;

      case "pickFood":
        var f = foodById(el.dataset.fid);
        if (f) { sheet.pick = f; sheet.pIdx = 0; sheet.qty = 1; renderSheetInner(); }
        break;

      case "portion":
        sheet.pIdx = +el.dataset.i; renderSheetInner();
        break;

      case "qty":
        sheet.qty = Math.max(0.5, Math.min(20, sheet.qty + parseFloat(el.dataset.d)));
        renderSheetInner();
        break;

      case "backList":
        sheet.pick = null; renderSheetInner();
        break;

      case "toggleFav":
        var fid = el.dataset.fid;
        var i = S.favs.indexOf(fid);
        if (i >= 0) S.favs.splice(i, 1); else S.favs.push(fid);
        save(); renderSheetInner();
        break;

      case "confirmAdd":
        confirmAdd();
        break;

      case "saveQuick":
        var nom = (document.getElementById("q-nom") || {}).value || "";
        var kc = parseFloat((document.getElementById("q-kcal") || {}).value || "0");
        if (!nom.trim()) { toast("Donne un nom au repas"); return; }
        addItem(sheet.moment, { fid: null, nom: nom.trim(), portion: "estimation", grammes: null, k: kc || 0, p: 0, g: 0, l: 0 });
        break;

      case "copyYesterday":
        var hier = itemsFor(addDays(todayKey(), -1), sheet.moment);
        var d0 = todayKey();
        hier.forEach(function (x) {
          S.meals.push({ id: uid(), date: d0, moment: sheet.moment, items: [x.it], ts: Date.now() });
        });
        touchStreak(d0); save(); render(); closeSheet();
        toast(hier.length + " aliment(s) recopié(s) — pense à ajuster");
        break;

      case "water":
        var dd = todayKey();
        var idx = +el.dataset.i;
        var cur = waterFor(dd);
        setWater(dd, cur === idx + 1 ? idx : idx + 1);
        render();
        break;

      case "clearMeal":
        var mm = el.dataset.moment;
        if (!confirm("Retirer tous les aliments de ce repas ?")) return;
        S.meals = S.meals.filter(function (m) { return !(m.date === todayKey() && m.moment === mm); });
        save(); render(); toast("Repas retiré");
        break;

      case "shareDay":
        shareDay();
        break;

      case "saveWeight":
        saveWeight();
        break;

      case "delWeight":
        var wd = el.dataset.date;
        if (!confirm("Supprimer la pesée du " + shortDate(wd) + " ?")) return;
        S.weights = S.weights.filter(function (x) { return x.date !== wd; });
        save(); render(); toast("Pesée supprimée");
        break;

      case "icsMonth":
        downloadICS("month");
        break;

      case "range":
        var r = el.dataset.d;
        var box = document.getElementById("chart-box");
        if (box) box.innerHTML = chartSVG(+r);
        Array.prototype.forEach.call(el.parentNode.children, function (c) { c.classList.toggle("on", c === el); });
        var lab = document.getElementById("range-t");
        if (lab) lab.textContent = r === "30" ? "30 jours" : r === "90" ? "90 jours" : "1 an";
        break;

      case "saveProfile":
        S.profile.prenom = (document.getElementById("st-prenom").value || "").trim() || S.profile.prenom;
        S.profile.poids = parseFloat(document.getElementById("st-poids").value) || S.profile.poids;
        S.profile.cible = parseFloat(document.getElementById("st-cible").value) || S.profile.cible;
        S.profile.activite = document.getElementById("st-act").value;
        save(); render(); toast("Profil mis à jour");
        break;

      case "saveTargets":
        S.profile.objKcal = Math.max(1200, parseFloat(document.getElementById("st-kcal").value) || targetKcal());
        S.profile.prot = parseFloat(document.getElementById("st-prot").value) || targetProt();
        S.profile.gluc = parseFloat(document.getElementById("st-gluc").value) || 0;
        S.profile.lip = parseFloat(document.getElementById("st-lip").value) || 0;
        save(); render(); toast("Objectif enregistré");
        break;

      case "toggleSimple":
        S.settings.modeSimple = !S.settings.modeSimple; save(); render();
        break;

      case "export":
        exportJSON();
        break;

      case "import":
        var fin = document.getElementById("file-in");
        if (fin) fin.click();
        break;

      case "reset":
        resetAll();
        break;

      case "ics":
        downloadICS();
        break;

      case "waInfo":
        alert("Rappels WhatsApp automatiques :\n\n1. Ils passent par l'API WhatsApp Business (Twilio ou Meta) — c'est la seule façon d'envoyer un message à un numéro sans qu'une app soit ouverte.\n2. La configuration est dans le README du projet (GitHub Actions + secrets).\n\nEn attendant, le bouton « Envoyer sur WhatsApp » de l'écran Aujourd'hui permet de partager ta journée en un tap.");
        break;

      case "recalc":
        var t2 = computeTargets(S.profile);
        S.profile.objKcal = t2.obj; S.profile.prot = t2.prot; S.profile.gluc = t2.gluc; S.profile.lip = t2.lip;
        save(); render(); toast("Objectif recalculé : " + t2.obj + " kcal");
        break;
    }
  });

  document.addEventListener("click", function (e) {
    var seg = e.target.closest("#st-theme button");
    if (seg) {
      S.settings.theme = seg.dataset.v; save(); applyTheme();
      Array.prototype.forEach.call(seg.parentNode.children, function (c) { c.classList.toggle("on", c === seg); });
      return;
    }
  });

  document.addEventListener("change", function (e) {
    if (e.target && e.target.id === "file-in" && e.target.files && e.target.files[0]) {
      importJSON(e.target.files[0]);
      e.target.value = "";
    }
  });

  /* ---------------- démarrage ---------------- */
  render();
  setInterval(function () {
    // changement de jour à minuit : on rafraîchit l'écran d'accueil
    if (view === "home" && app.dataset.day !== todayKey()) {
      app.dataset.day = todayKey();
      render();
    }
  }, 60000);
  app.dataset.day = todayKey();
})();
