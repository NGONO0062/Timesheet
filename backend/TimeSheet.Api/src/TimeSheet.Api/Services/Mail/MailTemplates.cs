namespace TimeSheet.Api.Services.Mail;

using System.Net;

/// <summary>
/// Gabarits d'e-mails (repris de lib/mail/templates.ts, textes de lib/i18n/fr.ts « mail ») :
/// texte brut et HTML sobre, mis en page comme un document (le mot TimeSheet et l'émetteur
/// en tête, l'objet à droite, la mention interne en pied). Purs : l'envoi est fait par MailSender.
/// </summary>
public static class MailTemplates
{
    private const string Font = "font-family:'Helvetica Neue',Helvetica,Arial,sans-serif";
    private const string Cell = "border:0;height:auto;padding:0;vertical-align:top";
    private const string Issuer = "Orange Cameroun";
    private const string Footer = "Interne Orange Cameroun · TimeSheet";
    private const string Signature = "TimeSheet · usage interne";

    private static string Escape(string s) => WebUtility.HtmlEncode(s);

    /// <summary>Le mot seul, sur fond noir : « Time » en #f16e00, « Sheet » en blanc.</summary>
    private static string Wordmark(int size) =>
        $"<span style=\"display:inline-block;padding:5px 10px;border-radius:6px;background:#000000;color:#ffffff;{Font};font-size:{size}px;line-height:{size + 2}px;font-weight:700;letter-spacing:-.5px;white-space:nowrap\"><span style=\"color:#f16e00\">Time</span>Sheet</span>";

    private static string Head(string subject)
    {
        const int size = 14;
        return $"<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"width:100%;border-collapse:collapse;margin:0;{Font};font-size:{size}px;line-height:{size + 4}px;color:#000000\">"
               + $"<tr><td style=\"{Cell};text-align:left;padding:0 20px 10px 0;border-bottom:2px solid #000000\">{Wordmark(size + 8)}<div style=\"margin-top:10px\"><b style=\"font-weight:700\">{Escape(Issuer)}</b></div></td>"
               + $"<td style=\"{Cell};text-align:right;padding:0 0 10px;border-bottom:2px solid #000000\"><div style=\"font-size:{size + 8}px;line-height:{size + 10}px;font-weight:700\">{Escape(subject)}</div></td></tr></table>";
    }

    /// <summary>Assemble un e-mail : salutation, paragraphes, lien, signature.</summary>
    private static MailMessage Compose(string to, string subject, string firstName, IReadOnlyList<string> paragraphs, string url)
    {
        var hello = $"Bonjour {firstName},";
        var text = string.Join("\n\n", new[] { hello }.Concat(paragraphs).Append($"Ouvrir la fiche : {url}").Append(Signature));
        var html = $"<div style=\"max-width:640px;font-family:Helvetica,Arial,sans-serif;font-size:16px;line-height:1.4;color:#000000\">{Head(subject)}<div style=\"padding:20px 0\">"
                   + string.Concat(new[] { hello }.Concat(paragraphs).Select(p => $"<p>{Escape(p)}</p>"))
                   + $"<p><a href=\"{Escape(url)}\" style=\"color:#000000;text-decoration:underline\">{Escape(url)}</a></p>"
                   + $"</div><p style=\"margin:0;padding-top:10px;border-top:2px solid #000000;font-size:14px;color:#595959\">{Escape(Footer)}</p></div>";
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
}
