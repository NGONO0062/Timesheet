namespace TimeSheet.Api.Services.Mail;

using TimeSheet.Api.Services.Export;

/// <summary>
/// Gabarits d'e-mails (repris de lib/mail/templates.ts, textes de lib/i18n/fr.ts « mail ») :
/// texte brut et HTML sobre, mis en page comme un document (en-tête de <see cref="DocumentHtml"/>,
/// la mention interne en pied). Purs : l'envoi est fait par MailSender.
/// </summary>
public static class MailTemplates
{
    private const string Signature = "TimeSheet · usage interne";

    private static string Escape(string s) => DocumentHtml.Escape(s);

    /// <summary>Assemble un e-mail : salutation, paragraphes, lien, signature.</summary>
    private static MailMessage Compose(string to, string subject, string firstName, IReadOnlyList<string> paragraphs, string url, string link = "Ouvrir la fiche")
    {
        var hello = $"Bonjour {firstName},";
        var text = string.Join("\n\n", new[] { hello }.Concat(paragraphs).Append($"{link} : {url}").Append(Signature));
        var html = $"<div style=\"max-width:640px;font-family:Helvetica,Arial,sans-serif;font-size:16px;line-height:1.4;color:#000000\">{DocumentHtml.Head([DocumentHtml.Issuer], subject, [], size: 14, upper: false)}<div style=\"padding:20px 0\">"
                   + string.Concat(new[] { hello }.Concat(paragraphs).Select(p => $"<p>{Escape(p)}</p>"))
                   + $"<p><a href=\"{Escape(url)}\" style=\"color:#000000;text-decoration:underline\">{Escape(url)}</a></p>"
                   + $"</div><p style=\"margin:0;padding-top:10px;border-top:2px solid #000000;font-size:14px;color:#595959\">{Escape(DocumentHtml.Footer)}</p></div>";
        return new MailMessage(to, subject, text, html);
    }

    /// <summary>Fiche validée : prévient le collaborateur.</summary>
    public static MailMessage Validated(string to, string firstName, string validator, int week, string range, string days, string url) =>
        Compose(to, $"Semaine {week} validée", firstName,
            [$"{validator} a validé votre fiche de la semaine {week} ({range}) : {days}. La fiche est verrouillée."], url);

    /// <summary>Fiche rejetée : prévient le collaborateur, avec le motif.</summary>
    public static MailMessage Rejected(string to, string firstName, string validator, int week, string range, string reason, string url) =>
        Compose(to, $"Semaine {week} rejetée : à corriger", firstName,
            [$"{validator} a rejeté votre fiche de la semaine {week} ({range}). Elle repasse en saisie : corrigez-la, puis soumettez-la à nouveau.", $"Motif : « {reason} »"], url);

    /// <summary>Relance du validateur : la fiche attend une décision depuis N jours ouvrés.</summary>
    public static MailMessage Reminder(string to, string firstName, string name, int week, string range, string since, string url) =>
        Compose(to, $"Fiche de {name} en attente depuis le {since}", firstName,
            [$"La fiche de {name} pour la semaine {week} ({range}) attend votre décision depuis le {since}."], url);

    /// <summary>Rappel de saisie : la semaine n'est pas soumise à l'échéance (relance depuis la vue consolidée).</summary>
    public static MailMessage FillReminder(string to, string firstName, int week, string range, string deadline, string url) =>
        Compose(to, $"Semaine {week} à saisir", firstName,
            [$"Votre fiche de la semaine {week} ({range}) n'est pas soumise, l'échéance était le {deadline}. Merci de la compléter et de la soumettre dès que possible."], url);

    /// <summary>Relance d'un manager depuis la vue consolidée : fiches de son équipe en attente.</summary>
    public static MailMessage ManagerReminder(string to, string firstName, string team, int count, int days, string url) =>
        Compose(to, $"Fiches de l'équipe {team} en attente de validation", firstName,
            [count > 1
                ? $"{count} fiches de l'équipe {team} attendent votre décision depuis plus de {days} jours ouvrés."
                : $"{count} fiche de l'équipe {team} attend votre décision depuis plus de {days} jours ouvrés."], url);

    /// <summary>Invitation (PROMPT.md §19) : premier mot de passe, lien valable 7 jours.</summary>
    public static MailMessage Invitation(string to, string firstName, string division, string inviter, string url) =>
        Compose(to, $"Votre accès à TimeSheet · {division}", firstName,
            [$"{inviter} vous a créé un compte TimeSheet dans la division {division}. Choisissez votre mot de passe avec le lien ci-dessous, valable 7 jours."], url, "Choisir mon mot de passe");

    /// <summary>Mot de passe oublié : lien valable une heure.</summary>
    public static MailMessage Reset(string to, string firstName, string url) =>
        Compose(to, "Réinitialisation de votre mot de passe TimeSheet", firstName,
            ["Une demande de réinitialisation a été faite pour votre compte. Choisissez un nouveau mot de passe avec le lien ci-dessous, valable une heure. Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : votre mot de passe reste inchangé."], url, "Choisir un nouveau mot de passe");

    /// <summary>Rappel du vendredi à 12:00 (écran 14) : la semaine en cours est incomplète, avant l'échéance.</summary>
    public static MailMessage FillUpcoming(string to, string firstName, int week, string range, string done, string expected, string deadline, string url) =>
        Compose(to, $"Semaine {week} incomplète : échéance {deadline}", firstName,
            [$"Votre fiche de la semaine {week} ({range}) compte {done} sur {expected}. Pensez à la compléter et à la soumettre avant l'échéance, {deadline}."], url);
}
