# 🌸 EmmaFit

> Le carnet alimentaire d'Emma — rapide, doux, hors-ligne, installé sur son iPhone comme une vraie app.

**En ligne** (GitHub Pages) → **lien Safari** → **Partager** → **Sur l'écran d'accueil**.
Pas de compte, pas de serveur, pas de pistage : toutes les données restent sur son téléphone.

---

## 1. Ce que fait l'app

| Écran | Fonctions |
|---|---|
| **Bienvenue** | Prénom, âge, taille, poids, objectif, activité → calcul automatique de l'objectif calorique (Mifflin-St Jeor, déficit doux, plancher 1 200 kcal) |
| **Aujourd'hui** | Anneau de progression, protéines, 4 repas éditables, compteur d'eau (8 verres), série de jours notés, partage WhatsApp |
| **Ajouter** | Recherche instantanée dans ~130 aliments (dont plats marocains), portions ménagères, aliments récents, favoris, saisie rapide en kcal, « remettre le repas d'hier » |
| **Progrès** | **Pesée à n'importe quelle date**, courbe 30 j / 90 j / 1 an, tendance 7 jours, **récapitulatif par mois** (moyenne + variation vs mois précédent), historique complet (édition/suppression), régularité, bilan de la semaine |
| **Réglages** | Profil, objectif et macros, thème clair/sombre/auto, **mode simple** (sans calories), export/import JSON, rappels `.ics` (quotidien + pesée mensuelle), remise à zéro |

**Ton** : jamais de rouge, jamais « objectif dépassé ». Une série interrompue « se met en pause », elle ne se casse pas.

---

## 2. Structure du projet

```
emmafit/
├── index.html                  # page unique
├── assets/
│   ├── styles.css              # design (clair + sombre, safe-area iPhone)
│   ├── app.js                  # toute la logique
│   └── foods.js                # base d'aliments (valeurs /100 g + portions)
├── icons/                      # icônes PWA (180 / 192 / 512 / maskable)
├── manifest.webmanifest        # installation sur l'écran d'accueil
├── sw.js                       # service worker (mode hors-ligne)
├── tools/
│   ├── make-icons.py           # régénère les icônes
│   ├── smoke-test.mjs          # test des parcours (jsdom)
│   ├── shots.mjs               # captures d'écran (Playwright)
│   └── whatsapp-reminder.mjs   # rappel WhatsApp quotidien
└── .github/workflows/whatsapp-reminder.yml
```

Aucune dépendance à l'exécution : pas de CDN, pas de police externe, tout fonctionne sans réseau.

---

## 3. Tester en local

```bash
cd emmafit
python3 -m http.server 8080
# → http://localhost:8080
```

Le service worker exige `localhost` **ou** HTTPS. Ouvrir le fichier en `file://` ne l'active pas.

Tests automatisés :

```bash
node tools/smoke-test.mjs     # parcours : onboarding → ajout → eau → pesée → réglages
```

> Guide de mise en ligne détaillé : **[DEPLOIEMENT.md](DEPLOIEMENT.md)**

---

## 4. Mettre en ligne sur GitHub Pages (5 minutes)

```bash
cd emmafit
git init
git add .
git commit -m "EmmaFit v1.0"
git branch -M main
git remote add origin https://github.com/<TON_COMPTE>/emmafit.git
git push -u origin main
```

Puis, sur GitHub : **Settings → Pages**

- *Source* : `Deploy from a branch`
- *Branch* : `main` / `/ (root)`
- **Save**

L'URL apparaît au bout d'une minute :

```
https://<TON_COMPTE>.github.io/emmafit/
```

> Le projet fonctionne aussi tel quel sur Netlify Drop, Cloudflare Pages ou Vercel (glisser-déposer du dossier).

### Installation sur l'iPhone d'Emma

1. Ouvrir le lien dans **Safari** (obligatoire — pas Chrome, pas Instagram).
2. Bouton **Partager** (carré avec une flèche) → **Sur l'écran d'accueil** → **Ajouter**.
3. Ouvrir EmmaFit **depuis l'icône** une première fois, avec du réseau : le mode hors-ligne s'active.
   Ensuite, elle peut noter ses repas dans le métro, en avion, sans connexion.

---

## 5. Rappels WhatsApp — ce qu'il faut savoir

⚠️ **Un site web ne peut pas envoyer de WhatsApp tout seul.** Un message vers un numéro passe obligatoirement
par l'**API WhatsApp Business** : Twilio (le plus simple) ou Meta Cloud API. Un compte + une clé sont nécessaires.

Trois niveaux, du plus simple au plus complet :

### A. Partage manuel (disponible tout de suite, gratuit)

Dans l'app : **Aujourd'hui → Partager ma journée → Envoyer**. Le récap part dans la feuille de partage iOS,
elle choisit WhatsApp (et peut s'envoyer le message à elle-même). Zéro configuration.

### B. Rappel quotidien automatique (GitHub Actions + Twilio, gratuit avec le sandbox)

1. Créer un compte sur [twilio.com](https://www.twilio.com) → **Messaging → Try it → Send a WhatsApp message**.
   Twilio fournit un numéro de test du type `+1 415 523 8886` et un code `join <mot>`.
2. Depuis **son** WhatsApp, envoyer `join <mot>` à ce numéro : cela ouvre la session de test.
3. Dans le dépôt GitHub : **Settings → Secrets and variables → Actions → New repository secret**

   | Nom du secret | Valeur |
   |---|---|
   | `TWILIO_ACCOUNT_SID` | `AC…` (console Twilio) |
   | `TWILIO_AUTH_TOKEN` | jeton Twilio |
   | `TWILIO_WHATSAPP_FROM` | `whatsapp:+14155238886` |
   | `EMMA_WHATSAPP_TO` | `whatsapp:+2126XXXXXXXX` |
   | `EMMA_NAME` | `Emma` |

4. Tester : onglet **Actions → Rappel WhatsApp EmmaFit → Run workflow**.
5. Le rappel part ensuite chaque jour à **20 h (heure du Maroc)**.

> **Limite du sandbox Twilio** : un message « libre » n'est autorisé que dans les 24 h suivant un message
> du destinataire. Si l'envoi échoue avec l'erreur *63016 / outside window*, deux options :
> elle renvoie `join <mot>` de temps en temps, **ou** on passe à un **template approuvé** via Meta Cloud API
> (plus robuste, mais demande un compte Meta Business et une validation de modèle).
>
> GitHub désactive les workflows planifiés d'un dépôt **public** après 60 jours sans activité :
> un commit de temps en temps suffit à les réactiver (ou passer le dépôt en privé).

### C. Rappel sans API (astuce iPhone, immédiat)

Dans l'app : **Réglages → Rappels → `.ics`**. Le fichier s'ouvre dans Calendrier et crée un rappel
quotidien à 20 h. Aucune API, aucune limite, fonctionne hors-ligne.

---

## 6. Données & confidentialité

- Stockage : `localStorage`, clé `emmafit.v1`, uniquement sur l'appareil.
- **Export / import** : Réglages → Exporter (fichier `.json`), à garder dans iCloud/Notes.
  iOS peut purger le stockage d'un site peu utilisé : un rappel d'export s'affiche après 30 jours.
- Aucune requête réseau après le premier chargement. Aucun cookie, aucun analytics.

---

## 7. Personnalisation rapide

| Quoi | Où |
|---|---|
| Ajouter ses aliments | dans l'app, « Saisie rapide », ou dans `assets/foods.js` |
| Couleurs | variables `:root` en haut de `assets/styles.css` |
| Nom de l'app | `index.html` (`<title>`, `apple-mobile-web-app-title`), `manifest.webmanifest` |
| Messages de rappel WhatsApp | `tools/whatsapp-reminder.mjs`, tableau `MESSAGES` |
| Déficit calorique | `computeTargets()` dans `assets/app.js` (400 kcal par défaut, plancher 1 200) |

---

## 8. Après la mise en ligne (mise à jour)

```bash
git add .
git commit -m "maj"
git push
```

Puis, dans le navigateur de l'iPhone : fermer complètement l'app et la rouvrir deux fois — le service worker
récupère la nouvelle version. Pour forcer : **Réglages iOS → Safari → Effacer historique et données**
(⚠️ cela efface aussi les données locales : exporter avant).

---

## 9. Pistes v2

- Photos des repas (IndexedDB)
- Recettes & idées de menus marocains équilibrés
- Notifications push iOS (16.4+ pour les PWA installées) à la place de WhatsApp
- Synchronisation entre deux iPhones
- Suivi de l'activité (pas, sport)

---

*EmmaFit est un carnet de suivi, pas un dispositif médical. Un déficit trop important n'est jamais conseillé :
en cas de doute, en parler à un professionnel de santé.*
