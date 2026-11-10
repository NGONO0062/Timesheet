namespace TimeSheet.Api.Domain.Attendance;

using TimeSheet.Api.Services.Export;

/// <summary>Signature du superviseur, imprimée dans la case prévue du modèle papier.</summary>
public sealed record PrintedSignature(string Name, string? Drawing, string Note);

/// <summary>Cartouche de la fiche : division, numéro, date de génération, mois.</summary>
public sealed record SheetMeta(string Division, string Number, string Generated, string Month);

/// <summary>
/// Gabarit de la feuille (repris de lib/attendance/html.ts) : le MÊME document sert à l'aperçu
/// (affiché tel quel par l'interface) et au PDF (PROMPT.md §11.4). Mise en page proforma
/// (docs/questions-ouvertes.md, point 81), tous les champs du modèle papier RH gardés. Pur,
/// tout le texte est échappé.
/// </summary>
public static class SheetHtml
{
    private static string E(string s) => DocumentHtml.Escape(s);

    private static readonly (InternshipKind Kind, string Label)[] Kinds = [(InternshipKind.ACADEMIC, "Académique"), (InternshipKind.PROFESSIONAL, "Professionnel"), (InternshipKind.GRADUATE, "Graduate")];

    private static string Box(bool checkedBox) =>
        $"<span class=\"ts-box{(checkedBox ? " is-checked" : "")}\" role=\"img\" aria-label=\"{(checkedBox ? "coché" : "non coché")}\"></span>";

    private static string Block(SheetBlock b) =>
        "<table><thead><tr><td></td><td>Arrivée</td><td>Départ</td></tr></thead><tbody>"
        + string.Concat(b.Rows.Select(r => $"<tr><td>{E(r.Label)}</td><td>{E(r.Arrival)}</td><td>{E(r.Departure)}</td></tr>"))
        + "</tbody></table>";

    private static string SignatureCell(PrintedSignature? s)
    {
        if (s is null) return "";
        var drawing = s.Drawing is { } d
            ? $"<svg width=\"120\" height=\"40\" viewBox=\"0 0 300 100\" fill=\"none\" aria-hidden=\"true\"><path d=\"{E(d)}\" stroke=\"#000000\" stroke-width=\"6\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>"
            : "";
        return $"<span style=\"display:flex;align-items:center;gap:10px;flex-wrap:wrap\">{E(s.Name)}{drawing}<span style=\"font-weight:400\">{E(s.Note)}</span></span>";
    }

    /// <summary>La feuille seule, classes .ts-sheet* (styles de <see cref="Document"/>).</summary>
    public static string Sheet(SheetModel m, SheetMeta meta, PrintedSignature? signature)
    {
        static string B(string s) => $"<b style=\"font-weight:700\">{E(s)}</b>";
        var kinds = string.Concat(Kinds.Select(k => $"<span style=\"white-space:nowrap;margin-right:10px\">{E(k.Label)} {Box(m.Kind == k.Kind)}</span>"));
        return string.Concat(
            "<div class=\"ts-sheet\">",
            DocumentHtml.Head([DocumentHtml.Issuer, $"Division {meta.Division}"], AttendanceRules.Title,
                [("Réf.", $"{AttendanceRules.Reference} · Version {AttendanceRules.Version}"), ("Mise à jour le", AttendanceRules.UpdatedOn), ("N°", meta.Number), ("Générée le", meta.Generated)], size: 12),
            DocumentHtml.Parties([
                // Chaque case reste collée à son libellé : une coupure de ligne ne doit pas l'attribuer au choix suivant.
                ("NOM ET PRENOM DU STAGIAIRE", $"{B(m.Name)}<br>NATURE DU STAGE :<br>{kinds}"),
                ("ENTITE D'AFFECTATION", $"Direction : {B(m.Direction)}<br>Département : {B(m.Department)}<br>Service : {B(m.Service)}"),
                ("PERIODE DE STAGE", $"Du {B(m.From)} Au {B(m.To)}<br>Mois : {B(meta.Month)}"),
            ], gap: 30),
            "<div class=\"ts-sheet-weeks\">",
            string.Concat(m.Blocks.Select(Block)),
            "<div></div>",
            "<div class=\"ts-sheet-bottom\">",
            $"<p class=\"ts-sheet-line\" style=\"gap:10px\"><span>Nombre de jours d'absence :</span><span class=\"ts-sheet-field\" style=\"width:120px\">{m.AbsenceDays}</span></p>",
            "<p>Observation :</p>",
            $"<div class=\"ts-sheet-field\" style=\"min-height:60px\">{E(m.Observation)}</div>",
            $"<p class=\"ts-sheet-line\" style=\"gap:10px;flex-wrap:nowrap\"><span style=\"white-space:nowrap\">Nom et signature du superviseur :</span><span class=\"ts-sheet-field\" style=\"flex:1 1 0%;min-height:30px\">{SignatureCell(signature)}</span></p>",
            "</div>",
            "</div>",
            $"<div class=\"ts-sheet-foot\"><span>{E(AttendanceRules.Footer)} · TimeSheet · {E(meta.Number)}</span><span>{E(AttendanceRules.Page)}</span></div>",
            "</div>");
    }

    private const string Css =
        "@page{size:A4 landscape;margin:0}*{box-sizing:border-box}"
        + "body{margin:0;font-family:\"Helvetica Neue\",Helvetica,Arial,sans-serif;color:#000;background:#fff}p{margin:0}"
        + ".ts-sheet{display:flex;flex-direction:column;gap:10px;width:297mm;height:210mm;padding:12mm 15mm;background:#fff;font-size:12px;line-height:14px}"
        + ".ts-sheet table{width:100%;border-collapse:collapse}"
        + ".ts-sheet td{height:18px;padding:0 5px;border:2px solid #000;text-align:center}"
        + ".ts-sheet td:first-child{text-align:left}.ts-sheet thead td{border:0}"
        + ".ts-sheet-line{display:flex;flex-wrap:wrap;align-items:center;gap:5px 20px}.ts-sheet-line b{font-weight:700}"
        + ".ts-sheet-weeks{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px 30px}"
        + ".ts-box{position:relative;display:inline-block;width:12px;height:12px;border:2px solid #000;vertical-align:-2px}"
        + ".ts-box.is-checked::after{content:\"\";position:absolute;inset:0;background:#000;clip-path:polygon(20% 10%,50% 40%,80% 10%,90% 20%,60% 50%,90% 80%,80% 90%,50% 60%,20% 90%,10% 80%,40% 50%,10% 20%)}"
        + ".ts-sheet-bottom{grid-column:2 / -1;display:flex;flex-direction:column;gap:10px;padding:10px;border:2px solid #000}"
        + ".ts-sheet-field{display:inline-flex;align-items:center;min-height:20px;padding:0 5px;border:2px solid #000;font-weight:700}"
        + ".ts-sheet-foot{display:flex;justify-content:space-between;gap:20px;margin-top:auto;padding-top:5px;border-top:2px solid #000}";

    /// <summary>Document autonome (A4 paysage, une page) : aperçu à l'écran et PDF.</summary>
    public static string Document(SheetModel m, SheetMeta meta, PrintedSignature? signature, string title) =>
        $"<!doctype html><html lang=\"fr\"><head><meta charset=\"utf-8\"><title>{E(title)}</title><style>{Css}</style></head><body>{Sheet(m, meta, signature)}</body></html>";
}
