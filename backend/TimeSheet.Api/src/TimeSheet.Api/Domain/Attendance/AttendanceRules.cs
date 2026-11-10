namespace TimeSheet.Api.Domain.Attendance;

using System.Globalization;
using System.Text;
using TimeSheet.Api.Domain.Timesheets;

/// <summary>Jour validé d'un mois : journée travaillée, ou absence (activité système).</summary>
public sealed record DayEntry(DateOnly Date, bool Absence);

public sealed record SheetRow(string Label, string Arrival, string Departure);

public sealed record SheetBlock(IReadOnlyList<SheetRow> Rows, bool Used);

/// <summary>Contenu de la feuille (modèle papier OCM/PS-01/SE/049), tel qu'imprimé.</summary>
public sealed record SheetModel(
    string Name,
    InternshipKind Kind,
    string Direction,
    string Department,
    string Service,
    string From,
    string To,
    IReadOnlyList<SheetBlock> Blocks,
    int AbsenceDays,
    string Observation);

/// <summary>Règles pures de la fiche de présence (reprises de lib/attendance/sheet.ts et config.ts).</summary>
public static class AttendanceRules
{
    // Modèle papier : « Version » et « Mise à jour le » lus sur le scan d'Orange Cameroun.
    public const string Title = "FICHE DE PRESENCE STAGIAIRE";
    public const string Reference = "OCM/PS-01/SE/049";
    public const string Version = "1.0";
    public const string UpdatedOn = "15/06/2023";
    public const string Footer = "Interne Orange Cameroun";
    public const string Page = "Page 1/1";
    /// <summary>Blocs de semaine imprimés sur la page, utilisés ou non.</summary>
    public const int Blocks = 6;
    private const int WeekdayCount = 5;

    private static readonly string[] Weekdays = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];
    private static readonly string[] Months = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

    /// <summary>« Février 2026 ».</summary>
    public static string MonthLabel(int year, int month) => $"{char.ToUpperInvariant(Months[month - 1][0])}{Months[month - 1][1..]} {year}";

    private static string Fr(DateOnly d) => d.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture);

    /// <summary>Lundis des semaines qui contiennent au moins un jour ouvré (lundi à vendredi) du mois.</summary>
    public static IReadOnlyList<DateOnly> MondaysOfMonth(int year, int month)
    {
        var first = new DateOnly(year, month, 1);
        var last = first.AddMonths(1).AddDays(-1);
        var mondays = new List<DateOnly>();
        for (var monday = first.AddDays(-(((int)first.DayOfWeek + 6) % 7)); monday <= last; monday = monday.AddDays(7))
        {
            if (Enumerable.Range(0, WeekdayCount).Select(monday.AddDays).Any(d => d >= first && d <= last)) mondays.Add(monday);
        }
        return mondays;
    }

    /// <summary>
    /// Semaines ISO du mois : la fiche est générée quand elles sont toutes validées. Avec la période
    /// de stage, seules celles qui la recoupent comptent (un stage qui commence le 5 janvier
    /// n'attend pas la semaine du 29 décembre).
    /// </summary>
    public static IReadOnlyList<IsoWeek> WeeksOfMonth(int year, int month, DateOnly? start = null, DateOnly? end = null) =>
        MondaysOfMonth(year, month)
            .Where(m => (start is null || m.AddDays(WeekdayCount - 1) >= start) && (end is null || m <= end))
            .Select(IsoWeek.Of)
            .ToList();

    /// <summary>Mois (année, 1 à 12) dont les jours ouvrés touchent une semaine : une semaine à cheval en a deux.</summary>
    public static IReadOnlyList<(int Year, int Month)> MonthsOfWeek(IsoWeek week) =>
        Enumerable.Range(0, WeekdayCount).Select(i => week.Monday.AddDays(i)).Select(d => (d.Year, d.Month)).Distinct().ToList();

    private static SheetRow EmptyRow(int i)
    {
        var day = Weekdays[i];
        return new SheetRow($"{day} {(day.Length > 5 ? "........" : "............")}", "", "");
    }

    /// <summary>
    /// Contenu de la feuille. Arrivée et départ : les horaires habituels du stagiaire, pour chaque
    /// jour du mois validé hors absence. Un jour d'absence reste vide et compte dans le nombre de
    /// jours d'absence. Les jours d'une semaine qui tombent dans un autre mois restent vides (ils
    /// sont sur l'autre fiche). Les blocs non utilisés restent en pointillés.
    /// </summary>
    public static SheetModel Build(int year, int month, string firstName, string lastName, Internship internship, string arrival, string departure, IReadOnlyList<DayEntry> days, string? observation)
    {
        var first = new DateOnly(year, month, 1);
        var last = first.AddMonths(1).AddDays(-1);
        var byDate = days.GroupBy(d => d.Date).ToDictionary(g => g.Key, g => g.First());
        var absence = 0;
        var blocks = MondaysOfMonth(year, month).Select(monday => new SheetBlock(
            Enumerable.Range(0, WeekdayCount).Select(i =>
            {
                var date = monday.AddDays(i);
                if (date < first || date > last) return EmptyRow(i);
                var label = $"{Weekdays[i]} {date:dd}/{date:MM}";
                if (!byDate.TryGetValue(date, out var d)) return new SheetRow(label, "", "");
                if (d.Absence)
                {
                    absence++;
                    return new SheetRow(label, "", "");
                }
                return new SheetRow(label, arrival, departure);
            }).ToList(), true)).ToList();
        while (blocks.Count < Blocks) blocks.Add(new SheetBlock(Enumerable.Range(0, WeekdayCount).Select(EmptyRow).ToList(), false));

        return new SheetModel($"{lastName.ToUpper(new CultureInfo("fr-FR"))} {firstName}", internship.Kind, internship.Direction, internship.Department, internship.Service,
            Fr(internship.StartDate), Fr(internship.EndDate), blocks.Take(Blocks).ToList(), absence, observation ?? "");
    }

    /// <summary>Nom en capitales, sans accent ni espace : « NDONGO », « BIKOI ».</summary>
    public static string FileSafe(string lastName)
    {
        var plain = new string(lastName.Normalize(NormalizationForm.FormD).Where(c => CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark).ToArray()).ToUpperInvariant();
        var safe = string.Concat(plain.Select(c => c is >= 'A' and <= 'Z' or >= '0' and <= '9' ? c : '-'));
        while (safe.Contains("--", StringComparison.Ordinal)) safe = safe.Replace("--", "-", StringComparison.Ordinal);
        return safe.Trim('-');
    }

    /// <summary>« Fiche_presence_2026-02_NDONGO.pdf ».</summary>
    public static string FileName(int year, int month, string lastName) => $"Fiche_presence_{year}-{month:00}_{FileSafe(lastName)}.pdf";

    /// <summary>Numéro imprimé sur la fiche : « FP-2026-02-NDONGO », un par stagiaire et par mois.</summary>
    public static string Number(int year, int month, string lastName) => $"FP-{year}-{month:00}-{FileSafe(lastName)}";

    /// <summary>Tracé produit par la zone de signature : commandes M et L, coordonnées entières, 20 000 caractères au plus.</summary>
    public static bool IsDrawing(string? drawing)
    {
        if (string.IsNullOrWhiteSpace(drawing) || drawing.Length > 20_000) return false;
        var tokens = drawing.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (tokens.Length % 3 != 0) return false;
        for (var i = 0; i < tokens.Length; i += 3)
        {
            if (tokens[i] is not ("M" or "L")) return false;
            if (!IsCoordinate(tokens[i + 1]) || !IsCoordinate(tokens[i + 2])) return false;
        }
        return true;
    }

    private static bool IsCoordinate(string s) => s.Length is > 0 and <= 5 && int.TryParse(s, NumberStyles.AllowLeadingSign, CultureInfo.InvariantCulture, out var n) && Math.Abs(n) < 10_000;
}
