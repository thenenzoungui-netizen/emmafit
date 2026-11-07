# 🚀 Mettre EmmaFit en ligne — pas à pas

Deux méthodes. La **A** ne demande aucun terminal (5 min, depuis le navigateur).
La **B** est la méthode git classique.

---

## Méthode A — sans terminal (recommandée si tu n'as jamais utilisé git)

1. Crée un compte sur [github.com](https://github.com) (gratuit).
2. En haut à droite : **+** → **New repository**
   - *Repository name* : `emmafit`
   - **Public** (obligatoire pour GitHub Pages gratuit)
   - Ne coche rien d'autre → **Create repository**
3. Sur la page du dépôt vide : clique **uploading an existing file**
4. Dans l'explorateur de fichiers, ouvre le dossier `emmafit` et **glisse tout son contenu** dans la page
   (⚠️ le contenu, pas le dossier `emmafit` lui-même : `index.html` doit être à la racine).
   - Sur Mac : `Cmd + Maj + .` pour voir les fichiers cachés, et inclure `.nojekyll` et `.github/`.
   - Sur Windows : active « éléments masqués » dans l'explorateur.
5. En bas : **Commit changes**
6. Va dans **Settings** (onglet du dépôt) → menu de gauche **Pages**
   - *Source* : **Deploy from a branch**
   - *Branch* : **main** / **/ (root)** → **Save**
7. Attends 1 à 2 minutes, puis recharge la page **Pages** : l'URL apparaît en haut :

```
https://<ton-compte>.github.io/emmafit/
```

C'est ce lien que tu envoies à Emma.

> Si la page affiche encore le README au lieu de l'app : vérifie que `index.html` est bien à la racine du dépôt.

---

## Méthode B — avec git (terminal)

```bash
cd emmafit
git init
git add .
git commit -m "EmmaFit v1.0"
git branch -M main
git remote add origin https://github.com/<TON_COMPTE>/emmafit.git
git push -u origin main
```

> Le dépôt est déjà initialisé avec deux commits dans ce dossier : tu peux sauter
> `git init` / `git add` / `git commit` et faire directement `git remote add` + `git push`.

Puis **Settings → Pages → Deploy from a branch → main / (root) → Save**.

### Mises à jour ensuite

```bash
git add .
git commit -m "maj"
git push
```

Sur l'iPhone : ferme complètement l'app puis rouvre-la **deux fois** pour que la nouvelle version s'installe
(le service worker met le cache à jour). Pense alors à incrémenter `CACHE` dans `sw.js` (`emmafit-v1.0.1` → `v1.0.2`)
pour forcer le remplacement.

---

## Installation sur l'iPhone d'Emma

1. Envoie-lui le lien sur WhatsApp.
2. Elle l'ouvre **dans Safari** (pas Chrome, pas le navigateur intégré de WhatsApp ou Instagram).
   → Astuce : dans WhatsApp, touche « ⋯ » puis **Ouvrir dans Safari**.
3. Bouton **Partager** (carré avec flèche vers le haut) → **Sur l'écran d'accueil** → **Ajouter**.
4. Elle ouvre EmmaFit **depuis l'icône** une première fois avec du réseau : le mode hors-ligne s'installe.
   Ensuite elle peut noter ses repas partout, même sans connexion.
5. Premier lancement : elle remplit l'écran de bienvenue (prénom, âge, taille, poids, objectif).

---

## Rappels WhatsApp (facultatif, après la mise en ligne)

### Ce qui marche immédiatement
Bouton **« Partager ma journée »** dans l'app → feuille de partage iOS → WhatsApp. Aucune configuration.

### Rappel automatique quotidien (GitHub Actions + Twilio)

1. Compte sur [twilio.com](https://www.twilio.com) → **Messaging → Try it out → Send a WhatsApp message**.
   Tu obtiens un numéro du type `+1 415 523 8886` et un code du type `join violet-cat`.
2. Emma envoie ce message au numéro depuis **son** WhatsApp : `join violet-cat`.
3. Sur GitHub : **Settings → Secrets and variables → Actions → New repository secret** — crée ces 5 secrets :

| Nom | Valeur |
|---|---|
| `TWILIO_ACCOUNT_SID` | `AC…` (page d'accueil de la console Twilio) |
| `TWILIO_AUTH_TOKEN` | le token affiché à côté |
| `TWILIO_WHATSAPP_FROM` | `whatsapp:+14155238886` |
| `EMMA_WHATSAPP_TO` | `whatsapp:+2126XXXXXXXX` (numéro d'Emma, format international, sans espaces) |
| `EMMA_NAME` | `Emma` |

4. Onglet **Actions** → **Rappel WhatsApp EmmaFit** → **Run workflow** pour tester tout de suite.
5. Ensuite, envoi automatique chaque jour à ~20 h (heure du Maroc).

**À savoir :** le sandbox Twilio autorise un message libre seulement dans les 24 h suivant un message d'Emma.
Si tu reçois l'erreur `63016`, deux options : elle renvoie `join …` de temps en temps, ou on passe à un
*template* approuvé via Meta Cloud API (plus robuste, plus long à mettre en place).

**Sans API :** Réglages → **Rappel quotidien** et **Rappel pesée mensuelle** (`.ics`) → s'ajoutent à l'app
Calendrier de l'iPhone, sans aucune limite.

---

## Petit guide pour Emma (à lui envoyer)

> **EmmaFit — 3 gestes par jour**
> 1. À chaque repas : l'app, bouton **+** sur la ligne du repas, tu tapes 2 lettres (« taj », « pou »…), tu choisis
>    la portion (« 1 assiette »), c'est enregistré. 10 secondes.
> 2. Pendant la journée : une goutte d'eau à chaque verre.
> 3. Une fois par jour ou par semaine (comme tu veux) : onglet **Progrès** → poids → **Enregistrer**.
>    Pas besoin de te peser tous les jours : le 1er de chaque mois suffit pour voir la tendance.
>
> Rien n'est jamais « raté ». Un oubli = une série en pause, pas une faute.

---

## En cas de problème

| Symptôme | Solution |
|---|---|
| Page blanche sur GitHub Pages | `index.html` n'est pas à la racine, ou Pages n'est pas encore déployé (attendre 2 min) |
| L'app s'ouvre mais rien ne se sauvegarde | Safari en navigation privée : sortir du mode privé |
| L'ancienne version reste affichée | Fermer l'app deux fois ; au besoin effacer les données Safari (⚠️ exporter avant) |
| L'icône n'apparaît pas sur l'écran d'accueil | Le lien a été ouvert depuis Chrome/Instagram → rouvrir dans Safari |
| Le rappel WhatsApp échoue | Voir la section « À savoir » ci-dessus (fenêtre de 24 h du sandbox) |
| Données perdues | Restaurer une sauvegarde : Réglages → **Importer** (les exports sont dans Fichiers/iCloud) |
