namespace TimeSheet.Api.Domain.Reporting.Features;

using TimeSheet.Api.Domain.Access;
using TimeSheet.Api.Services.Export;
using TimeSheet.Api.Services.Mail;

/// <summary>
/// Exports du reporting (repris de lib/reporting/exports.ts, textes de lib/i18n/fr.ts
/// « reporting » et « document ») : mêmes données que l'écran, même ordre. Purs.
/// </summary>
public static class ReportExport
{
    public sealed record Meta(string Scope, string Division, string IssuedBy, string Number, string Date);

    private static (string Entity, string Sub, string Count, string Detail, string Axis) Columns(string axis) => axis switch
    {
        "person" => ("Personne", "Équipe", "", "Détail par personne", "Personne"),
        "activity" => ("Activité", "", "Projets", "Détail par activité", "Activité"),
        _ => ("Projet", "Code", "Membres", "Détail par projet", "Projet"),
    };

    public static string RoleLabel(Role role) => role switch
    {
        Role.STAFF => "Staff",
        Role.MANAGER => "Manager",
        Role.OWNER => "Owner",
        Role.DIVISION_ADMIN => "Admin division",
        _ => "Admin plateforme",
    };

    /// <summary>« Toute l'équipe (6) », « Toute la division (15) », ou le nom de la personne.</summary>
    public static string ScopeLabel(ReportDto r) =>
        r.People.FirstOrDefault(p => p.Id == r.PersonId)?.Name ?? (r.Whole ? $"Toute la division ({r.People.Count})" : $"Toute l'équipe ({r.People.Count})");

    private static string Plural(int n, string one, string many) => n > 1 ? $"{n} {many}" : $"{n} {one}";

    /// <summary>Textes des trois indicateurs (planche 10).</summary>
    public static (string Capacity, string Fill, string FillDetail, string Validated, string ValidatedDetail) KpiTexts(ReportKpis k)
    {
        var fill = k.Capacity > 0 ? (decimal)k.Entered / k.Capacity : 0;
        var missing = new List<string> { k.MissingDays > 0 ? $"Non saisi : {FrenchFormat.Days(k.MissingDays)}" : "Aucun jour manquant" };
        if (k.MissingSheets > 0) missing.Add(Plural(k.MissingSheets, "fiche manquante", "fiches manquantes"));
        return (
            $"sur {FrenchFormat.Days(k.Capacity)} de capacité ({Plural(k.Persons, "personne", "personnes")}, {Plural(k.Weeks, "semaine", "semaines")})",
            FrenchFormat.Percent(fill),
            string.Join(" : ", missing),
            $"{k.Validated} sur {k.ExpectedSheets}",
            $"{k.Pending} en attente de validation, {Plural(k.MissingSheets, "manquante", "manquantes")}");
    }

    /// <summary>Tableau de détail : une ligne par entité, une colonne par semaine, total et part (en %, une décimale).</summary>
    public static IReadOnlyList<IReadOnlyList<object?>> Rows(ReportDto r)
    {
        var c = Columns(r.Axis);
        var grand = r.Entities.Sum(e => e.Total);
        var head = new List<object?> { c.Entity };
        if (c.Sub.Length > 0) head.Add(c.Sub);
        if (c.Count.Length > 0) head.Add(c.Count);
        head.AddRange(r.Weeks.Select(w => (object?)$"S{w.Week}"));
        head.AddRange(["Total", "Part"]);

        var rows = new List<IReadOnlyList<object?>> { head };
        foreach (var e in r.Entities)
        {
            var row = new List<object?> { e.Label };
            if (c.Sub.Length > 0) row.Add(e.Sub);
            if (c.Count.Length > 0) row.Add(e.Count);
            row.AddRange(e.ByWeek.Select(d => (object?)d));
            row.Add(e.Total);
            row.Add(grand > 0 ? Math.Round((decimal)e.Total * 1000 / grand, MidpointRounding.AwayFromZero) / 10 : 0m);
            rows.Add(row);
        }
        var foot = new List<object?> { "Total" };
        if (c.Sub.Length > 0) foot.Add(null);
        if (c.Count.Length > 0) foot.Add(null);
        foot.AddRange(r.Weeks.Select((_, j) => (object?)r.Entities.Sum(e => e.ByWeek[j])));
        foot.Add(grand);
        foot.Add(100);
        rows.Add(foot);
        return rows;
    }

    /// <summary>Document HTML imprimé en PDF, mis en page comme une proforma : en-tête, périmètre, détail, récapitulatif.</summary>
    public static string Html(ReportDto r, Meta meta)
    {
        static string E(string s) => DocumentHtml.Escape(s);
        var c = Columns(r.Axis);
        var texts = KpiTexts(r.Kpis);
        var grand = r.Entities.Sum(e => e.Total);
        var period = r.Weeks.Count > 0 ? FrenchFormat.FromTo(r.Weeks[0].Monday, r.Weeks[^1].Monday.AddDays(4)) : "";
        string Th(string s, bool num = false) => $"<th{(num ? " class=\"num\"" : "")}>{E(s)}</th>";
        string Td(string s, bool num = false) => $"<td{(num ? " class=\"num\"" : "")}>{E(s)}</td>";

        var body = string.Concat(r.Entities.Select(e =>
            $"<tr>{Th(e.Label)}{(c.Sub.Length > 0 ? Td(e.Sub) : "")}{(c.Count.Length > 0 ? Td(e.Count.ToString(), true) : "")}"
            + string.Concat(e.ByWeek.Select(d => Td(FrenchFormat.Days(d), true)))
            + $"{Td(FrenchFormat.Days(e.Total), true)}{Td(FrenchFormat.Share(e.Total, grand), true)}</tr>"));
        var head = $"<tr>{Th(c.Entity)}{(c.Sub.Length > 0 ? Th(c.Sub) : "")}{(c.Count.Length > 0 ? Th(c.Count, true) : "")}{string.Concat(r.Weeks.Select(w => Th($"S{w.Week}", true)))}{Th("Total", true)}{Th("Part", true)}</tr>";
        var foot = $"<tr>{Th("Total")}{(c.Sub.Length > 0 ? "<td></td>" : "")}{(c.Count.Length > 0 ? "<td></td>" : "")}"
                   + string.Concat(r.Weeks.Select((_, j) => Td(FrenchFormat.Days(r.Entities.Sum(e => e.ByWeek[j])), true)))
                   + $"{Td(FrenchFormat.Days(grand), true)}{Td(FrenchFormat.Share(grand, grand), true)}</tr>";

        const string Style = "body{margin:0;font-family:\"Helvetica Neue\",Helvetica,Arial,sans-serif;font-size:11px;line-height:14px;color:#000000}"
                             + ".muted{color:#595959}table{width:100%;border-collapse:collapse}th,td{padding:5px;border-bottom:2px solid #dddddd;text-align:left}"
                             + "thead th{border-bottom:2px solid #000000;background:#fafafa}tbody th{font-weight:700}"
                             + "tfoot th,tfoot td{border-top:2px solid #000000;border-bottom:0;background:#fafafa;font-weight:700}.num{text-align:right}"
                             + ".detail{margin-top:20px}.detail caption{text-align:left;font-weight:700;text-transform:uppercase;padding-bottom:5px}";
        return $"<!doctype html><html lang=\"fr\"><head><meta charset=\"utf-8\"><title>{E($"Reporting · {meta.Scope}")}</title><style>{Style}</style></head><body>"
               + DocumentHtml.Head([DocumentHtml.Issuer, $"Division {meta.Division}"], "Rapport d'activité", [("N°", meta.Number), ("Date", meta.Date), ("Période", period)], size: 11)
               + "<div style=\"margin-top:20px\">" + DocumentHtml.Parties([
                   ("Périmètre", $"<b>{E(meta.Scope)}</b><br>Vue : {E(c.Axis)}"),
                   ("Établi par", $"<b>{E(meta.IssuedBy)}</b><br><span class=\"muted\">{E(texts.Capacity)}</span>"),
               ]) + "</div>"
               + $"<table class=\"detail\"><caption>{E(c.Detail)}</caption><thead>{head}</thead><tbody>{body}</tbody><tfoot>{foot}</tfoot></table>"
               + DocumentHtml.Summary([("Taux de remplissage", texts.Fill), ("Fiches validées", texts.Validated), ("Jours saisis", FrenchFormat.Days(grand))])
               + "</body></html>";
    }
}
