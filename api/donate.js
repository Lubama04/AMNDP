import { getResend, escapeHtml, stripNewlines, isValidEmail, isHoneypotFilled, readJsonBody, requireEnv, enforceBodySizeLimit, BodyTooLargeError } from './_lib.js';

const ALLOWED_PURPOSES = [
  'Soutien général',
  'Parrainage bénéficiaire',
  'Équipement atelier',
  'Mission chirurgicale',
  'Autre',
];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Méthode non autorisée.' });
  }
  const contentType = req.headers['content-type'] || '';
  if (!contentType.includes('application/json')) {
    return res.status(415).json({ error: 'Content-Type invalide, application/json attendu.' });
  }

  try {
    enforceBodySizeLimit(req);
    const body = await readJsonBody(req);

    // Champ piège anti-spam : un bot le remplit, un humain ne le voit jamais.
    if (isHoneypotFilled(body)) {
      return res.status(200).json({ ok: true });
    }

    const fullName = (body.fullName || '').toString().trim();
    const email = (body.email || '').toString().trim();
    const country = (body.country || '').toString().trim();
    const amount = (body.amount || '').toString().trim();
    const purpose = (body.purpose || '').toString().trim();
    const message = (body.message || '').toString().trim();
    const consent = body.consent === 'on' || body.consent === true || body.consent === 'true';

    if (!fullName || !email || !country || !purpose) {
      return res.status(400).json({ error: 'Nom, email, pays et objet du don sont requis.' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Adresse e-mail invalide.' });
    }
    if (!ALLOWED_PURPOSES.includes(purpose)) {
      return res.status(400).json({ error: 'Objet du don invalide.' });
    }
    if (fullName.length > 200 || country.length > 200 || amount.length > 100 || message.length > 5000) {
      return res.status(400).json({ error: 'Un des champs dépasse la longueur autorisée.' });
    }
    if (!consent) {
      return res.status(400).json({ error: 'Le consentement à l\'utilisation des informations est requis.' });
    }

    const resend = getResend();
    const toEmail = requireEnv('DONATION_TO_EMAIL');
    const fromEmail = requireEnv('RESEND_FROM_EMAIL');

    const { error } = await resend.emails.send({
      from: `Site AMNDP <${fromEmail}>`,
      to: toEmail,
      replyTo: email,
      subject: `[Don AMNDP] ${stripNewlines(purpose)} : ${stripNewlines(fullName)}`,
      html: `
        <h2>Nouvelle démarche de don depuis le site</h2>
        <p><strong>Nom complet :</strong> ${escapeHtml(fullName)}</p>
        <p><strong>Email :</strong> ${escapeHtml(email)}</p>
        <p><strong>Pays de résidence :</strong> ${escapeHtml(country)}</p>
        <p><strong>Montant envisagé :</strong> ${escapeHtml(amount || 'Non précisé')}</p>
        <p><strong>Objet du don :</strong> ${escapeHtml(purpose)}</p>
        <p><strong>Message :</strong></p>
        <p>${escapeHtml(message || '').replace(/\n/g, '<br>')}</p>
        <hr>
        <p style="color:#666;font-size:.85rem;">Merci de recontacter cette personne dans les 48 heures, conformément au message affiché sur le site.</p>
      `,
    });
    if (error) {
      console.error('Erreur Resend /api/donate :', error.name, error.statusCode);
      return res.status(502).json({ error: "Échec de l'envoi de l'email." });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    if (err instanceof BodyTooLargeError) {
      return res.status(413).json({ error: 'Requête trop volumineuse.' });
    }
    console.error('Erreur /api/donate :', err);
    return res.status(500).json({ error: "Échec de l'envoi de l'email." });
  }
}
