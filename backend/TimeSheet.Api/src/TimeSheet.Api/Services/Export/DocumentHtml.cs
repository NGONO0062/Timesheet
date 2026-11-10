namespace TimeSheet.Api.Services.Export;

using TimeSheet.Api.Domain.Timesheets;

/// <summary>
/// Documents qui sortent de l'application (e-mails, PDF), repris de lib/export/brand.ts : mis en
/// page comme une facture proforma — émetteur et cartouche (titre, numéro, date), blocs
/// d'information, contenu, récapitulatif, pied. Pas de logo : le mot TimeSheet, « Time » en
/// #f16e00, « Sheet » en blanc sur fond noir. Styles en ligne (messageries, impression PDF). Tout
/// le texte est échappé.
/// </summary>
public static class DocumentHtml
{
    public const string Issuer = "Orange Cameroun";
    public const string Footer = "Interne Orange Cameroun · TimeSheet";
    private const string Font = "font-family:'Helvetica Neue',Helvetica,Arial,sans-serif";
    // Cellule neutre : annule les bordures et hauteurs des tableaux du gabarit qui l'entoure.
    private const string Cell = "border:0;height:auto;padding:0;vertical-align:top";

    /// <summary>Échappe les caractères qui comptent en HTML (&amp; &lt; &gt; &quot; &#39;), garde les accents lisibles.</summary>
    public static string Escape(string s) => s.Replace("&", "&amp;").Replace("<", "&lt;").Replace(">", "&gt;").Replace("\"", "&quot;").Replace("'", "&#39;");

    /// <summary>Le mot seul, sur fond noir : <paramref name="size"/> en pixels.</summary>
    public static string Wordmark(int size = 20) =>
        $"<span style=\"display:inline-block;padding:5px 10px;border-radius:6px;background:#000000;color:#ffffff;{Font};font-size:{size}px;line-height:{size + 2}px;font-weight:700;letter-spacing:-.5px;white-space:nowrap\"><span style=\"color:#f16e00\">Time</span>Sheet</span>";

    /// <summary>
    /// En-tête : émetteur à gauche (la première ligne en gras), cartouche à droite (titre, puis
    /// libellés et valeurs), filet noir dessous. Un tableau : lu par toutes les messageries.
    /// </summary>
    public static string Head(IReadOnlyList<string> issuer, string title, IReadOnlyList<(string Label, string Value)> facts, int size = 12, bool upper = true)
    {
        var lines = string.Join("<br>", issuer.Select((line, i) => i == 0 ? $"<b style=\"font-weight:700\">{Escape(line)}</b>" : Escape(line)));
        var rows = string.Concat(facts.Select(f =>
            $"<tr><td style=\"{Cell};padding:0 10px 0 0;text-align:right;color:#595959\">{Escape(f.Label)}</td><td style=\"{Cell};text-align:right;font-weight:700\">{Escape(f.Value)}</td></tr>"));
        var cartouche = rows.Length > 0 ? $"<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" style=\"border-collapse:collapse;margin:10px 0 0 auto;width:auto\">{rows}</table>" : "";
        return $"<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"width:100%;border-collapse:collapse;margin:0;{Font};font-size:{size}px;line-height:{size + 4}px;color:#000000\">"
               + $"<tr><td style=\"{Cell};text-align:left;padding:0 20px 10px 0;border-bottom:2px solid #000000\">{Wordmark(size + 8)}<div style=\"margin-top:10px\">{lines}</div></td>"
               + $"<td style=\"{Cell};text-align:right;padding:0 0 10px;border-bottom:2px solid #000000\"><div style=\"font-size:{size + 8}px;line-height:{size + 10}px;font-weight:700{(upper ? ";text-transform:uppercase" : "")}\">{Escape(title)}</div>{cartouche}</td></tr></table>";
    }

    /// <summary>Blocs d'information côte à côte : libellé en capitales, contenu HTML déjà échappé.</summary>
    public static string Parties(IReadOnlyList<(string Label, string Html)> parties, int gap = 20) =>
        $"<div style=\"display:flex;gap:{gap}px\">" + string.Concat(parties.Select(p =>
            $"<div style=\"flex:1 1 0%;min-width:0;padding:10px;border:2px solid #000000;border-radius:6px\"><div style=\"margin-bottom:5px;color:#595959;font-weight:700;text-transform:uppercase\">{Escape(p.Label)}</div>{p.Html}</div>")) + "</div>";

    /// <summary>Récapitulatif aligné à droite : la dernière ligne en gras, sur fond #fafafa, filet noir au-dessus.</summary>
    public static string Summary(IReadOnlyList<(string Label, string Value)> rows, string title = "Récapitulatif")
    {
        var body = string.Concat(rows.Select((r, i) =>
        {
            var cell = i == rows.Count - 1 ? "border:0;border-top:2px solid #000000;background:#fafafa;font-weight:700" : "border:0;background:#ffffff";
            return $"<tr><td style=\"{cell};padding:5px 10px;text-align:left\">{Escape(r.Label)}</td><td style=\"{cell};padding:5px 10px;text-align:right;white-space:nowrap\">{Escape(r.Value)}</td></tr>";
        }));
        return $"<div style=\"width:320px;margin:20px 0 0 auto\"><div style=\"padding:0 0 5px;font-weight:700;text-transform:uppercase\">{Escape(title)}</div>"
               + $"<div style=\"border:2px solid #000000;border-radius:6px;overflow:hidden\"><table style=\"width:100%;margin:0;border-collapse:collapse\"><tbody>{body}</tbody></table></div></div>";
    }

    /// <summary>Pied de page des PDF (gabarit Chromium) : mention et numéro à gauche, « Page n/N » à droite.</summary>
    public static string PdfFooter(string left) =>
        $"<div style=\"width:100%;margin:0 15mm;padding-top:5px;border-top:2px solid #000000;display:flex;justify-content:space-between;{Font};font-size:9px;line-height:11px;color:#000000\">"
        + $"<span>{Escape(left)}</span><span>Page <span class=\"pageNumber\"></span>/<span class=\"totalPages\"></span></span></div>";

    /// <summary>Numéro de document : préfixe, jour et heure d'édition à Douala. « RPT-20261012-1542 ».</summary>
    public static string Number(string prefix, DateTimeOffset at)
    {
        var local = at.ToUniversalTime() + WeekRules.DoualaOffset;
        return $"{prefix}-{local:yyyyMMdd}-{local:HHmm}";
    }
}
