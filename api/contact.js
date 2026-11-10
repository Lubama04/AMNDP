import { getResend, escapeHtml, stripNewlines, isValidEmail, isHoneypotFilled, readJsonBody, requireEnv, enforceBodySizeLimit, BodyTooLargeError } from './_lib.js';

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
    // On répond succès sans rien envoyer, pour ne pas renseigner le bot.
    if (isHoneypotFilled(body)) {
      return res.status(200).json({ ok: true });
    }

    const name = (body.name || '').toString().trim();
    const email = (body.email || '').toString().trim();
    const subject = (body.subject || '').toString().trim();
    const message = (body.message || '').toString().trim();

    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Nom, email et message sont requis.' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Adresse e-mail invalide.' });
    }
    if (name.length > 200 || subject.length > 200 || message.length > 5000) {
      return res.status(400).json({ error: 'Un des champs dépasse la longueur autorisée.' });
    }

    const resend = getResend();
    const toEmail = requireEnv('CONTACT_TO_EMAIL');
    const fromEmail = requireEnv('RESEND_FROM_EMAIL');

    const { error } = await resend.emails.send({
      from: `Site AMNDP <${fromEmail}>`,
      to: toEmail,
      replyTo: email,
      subject: `[Contact AMNDP] ${stripNewlines(subject) || 'Nouveau message'}`,
      html: `
        <h2>Nouveau message depuis le formulaire de contact</h2>
        <p><strong>Nom :</strong> ${escapeHtml(name)}</p>
        <p><strong>Email :</strong> ${escapeHtml(email)}</p>
        <p><strong>Objet :</strong> ${escapeHtml(subject || '')}</p>
        <p><strong>Message :</strong></p>
        <p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>
      `,
    });
    if (error) {
      console.error('Erreur Resend /api/contact :', error.name, error.statusCode);
      return res.status(502).json({ error: "Échec de l'envoi de l'email." });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    if (err instanceof BodyTooLargeError) {
      return res.status(413).json({ error: 'Requête trop volumineuse.' });
    }
    console.error('Erreur /api/contact :', err);
    return res.status(500).json({ error: "Échec de l'envoi de l'email." });
  }
}
