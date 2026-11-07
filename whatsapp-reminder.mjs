#!/usr/bin/env node
/**
 * EmmaFit — rappel WhatsApp quotidien
 * -------------------------------------------------------------
 * Envoie un message WhatsApp doux à un numéro, une fois par jour.
 *
 * ⚠️ Un message WhatsApp ne peut pas être envoyé depuis un simple site web :
 *    il faut passer par l'API WhatsApp Business (Twilio ou Meta Cloud API).
 *    Ce script est prévu pour tourner dans GitHub Actions (gratuit) avec
 *    les identifiants stockés en « secrets » du dépôt.
 *
 * Variables d'environnement :
 *   TWILIO_ACCOUNT_SID   — ex. ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
 *   TWILIO_AUTH_TOKEN    — jeton d'authentification Twilio
 *   TWILIO_WHATSAPP_FROM — ex. whatsapp:+14155238886 (numéro du sandbox Twilio)
 *   EMMA_WHATSAPP_TO     — ex. whatsapp:+212612345678  (le numéro d'Emma)
 *   EMMA_NAME            — optionnel, prénom affiché (défaut : Emma)
 *   DRY_RUN              — "1" pour afficher le message sans l'envoyer
 */

const NAME = process.env.EMMA_NAME || "Emma";
const TO = process.env.EMMA_WHATSAPP_TO;
const SID = process.env.TWILIO_ACCOUNT_SID;
const TOKEN = process.env.TWILIO_AUTH_TOKEN;
const FROM = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";
const DRY = process.env.DRY_RUN === "1";

/** Messages tournants : jamais culpabilisants, une ligne d'action maximum. */
const MESSAGES = [
  `Bonjour ${NAME} 🌸 Petite pensée : 30 secondes pour noter ton petit-déj, et ta journée est lancée.`,
  `Coucou ${NAME} ☕️ Un tap sur EmmaFit pour noter ton déjeuner ? C'est tout ce qu'on te demande aujourd'hui.`,
  `${NAME}, ton carnet t'attend 🌿 Même 3 aliments notés, c'est déjà une journée de gagnée.`,
  `Petit rappel doux 💛 Noter ce que tu manges, ce n'est pas te juger — c'est te donner de la visibilité.`,
  `Hey ${NAME} ✨ Comment s'est passée la journée ? Un petit point sur EmmaFit avant de souffler.`,
  `Rien à prouver aujourd'hui ${NAME} 🤍 Juste noter, pour toi. La régularité compte plus que la perfection.`,
  `Dimanche, jour du bilan 🌱 Ouvre EmmaFit : ta tendance sur 7 jours en dit plus que la balance du matin.`
];

function pickMessage() {
  const d = new Date();
  // heure locale approximative du Maroc (UTC+1) pour choisir un message cohérent
  const day = (d.getUTCDay() + 6) % 7; // 0 = lundi
  return MESSAGES[day % MESSAGES.length];
}

async function main() {
  const body = pickMessage();

  if (DRY) {
    console.log("DRY_RUN — message qui aurait été envoyé :\n" + body);
    return;
  }

  const missing = [];
  if (!SID) missing.push("TWILIO_ACCOUNT_SID");
  if (!TOKEN) missing.push("TWILIO_AUTH_TOKEN");
  if (!TO) missing.push("EMMA_WHATSAPP_TO");
  if (missing.length) {
    console.error("Secrets manquants : " + missing.join(", "));
    console.error("Voir le README, section « Rappels WhatsApp ».");
    process.exit(1);
  }

  const params = new URLSearchParams({ From: FROM, To: TO, Body: body });
  const url = `https://api.twilio.com/2010-04-01/Accounts/${SID}/Messages.json`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${SID}:${TOKEN}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params.toString()
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    console.error("Échec de l'envoi (" + res.status + ") :", data.message || data);
    if (res.status === 63016 || /outside.*window|24 hour/i.test(String(data.message))) {
      console.error(
        "\n➜ Cause fréquente : hors du sandbox Twilio, un message « libre » n'est autorisé que dans " +
        "les 24 h suivant un message du destinataire.\n" +
        "  Solutions : (1) le numéro envoie « join <code> » au sandbox Twilio, " +
        "(2) ou utiliser un template WhatsApp approuvé (Meta Cloud API)."
      );
    }
    process.exit(1);
  }

  console.log("Message WhatsApp envoyé ✅ sid=" + data.sid);
}

main().catch((e) => { console.error(e); process.exit(1); });
