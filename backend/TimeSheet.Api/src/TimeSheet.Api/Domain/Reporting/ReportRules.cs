namespace TimeSheet.Api.Domain.Reporting;

using System.Globalization;
using TimeSheet.Api.Domain.Timesheets;

public enum ReportAxis
{
    project,
    person,
    activity,
}

/// <summary>Une journée saisie : une semaine, une personne, un projet et une activité.</summary>
public sealed record ReportEntry(IsoWeek Week, Guid PersonId, Guid ProjectId, string ProjectCode, string ProjectName, string ActivityName);

public sealed record ReportPerson(Guid Id, string Name, string? Team);

/// <summary>État d'une fiche attendue (une par personne et par semaine), tel qu'affiché.</summary>
public sealed record SheetState(Guid PersonId, IsoWeek Week, DisplayStatus Status);

/// <summary>Entité de l'axe (projet, personne ou activité) : jours par semaine, total, couleur de série.</summary>
public sealed record ReportEntity(string Key, string Label, string Sub, int Count, IReadOnlyList<int> ByWeek, int Total);

/// <summary>Série de couleur : une entité, ou « Autres » qui regroupe le reste. <c>Index</c> : 0 à 3.</summary>
public sealed record ReportSeries(string Key, string Label, int Index, IReadOnlyList<string> Keys);

public sealed record ReportKpis(int Entered, int Capacity, int Persons, int Weeks, int MissingDays, int MissingSheets, int Validated, int Pending, int ExpectedSheets);

/// <summary>Règles pures du reporting (reprises de lib/reporting/report.ts et view.ts).</summary>
public static class ReportRules
{
    public const int SeriesCount = 4;
    public const string OthersKey = "__autres__";
    public const string OthersLabel = "Autres";
    /// <summary>Au plus 60 semaines par rapport.</summary>
    public const int MaxWeeks = 60;
    private static readonly StringComparer French = StringComparer.Create(new CultureInfo("fr-FR"), false);

    public static ReportAxis ParseAxis(string? raw) => Enum.TryParse<ReportAxis>(raw, ignoreCase: false, out var a) && Enum.IsDefined(a) && !int.TryParse(raw, out _) ? a : ReportAxis.project;

    /// <summary>« 2026-12 » → semaine 12 de 2026 ; null si la clé est invalide.</summary>
    public static IsoWeek? ParseWeekKey(string? raw)
    {
        var parts = raw?.Split('-');
        if (parts is not { Length: 2 } || !int.TryParse(parts[0], NumberStyles.None, CultureInfo.InvariantCulture, out var y) || !int.TryParse(parts[1], NumberStyles.None, CultureInfo.InvariantCulture, out var w)) return null;
        return IsoWeek.IsValid(y, w) ? new IsoWeek(y, w) : null;
    }

    /// <summary>Période de l'adresse ; par défaut les trois dernières semaines, bornes remises dans l'ordre.</summary>
    public static (IsoWeek From, IsoWeek To) Period(string? from, string? to, IsoWeek current)
    {
        var a = ParseWeekKey(from) ?? current.Shift(-2);
        var b = ParseWeekKey(to) ?? current;
        return a > b ? (b, a) : (a, b);
    }

    public static IReadOnlyList<IsoWeek> WeeksBetween(IsoWeek from, IsoWeek to)
    {
        var weeks = new List<IsoWeek>();
        for (var w = from; w <= to && weeks.Count < MaxWeeks; w = w.Shift(1)) weeks.Add(w);
        return weeks;
    }

    private static string KeyOf(ReportAxis axis, ReportEntry e) => axis switch
    {
        ReportAxis.project => e.ProjectId.ToString(),
        ReportAxis.person => e.PersonId.ToString(),
        _ => e.ActivityName,
    };

    /// <summary>Regroupe les journées par entité de l'axe, semaine par semaine ; jours décroissants, puis libellé.</summary>
    public static IReadOnlyList<ReportEntity> Group(ReportAxis axis, IEnumerable<ReportEntry> entries, IReadOnlyList<IsoWeek> weeks, IReadOnlyList<ReportPerson> people, IReadOnlyDictionary<Guid, int> members)
    {
        var index = weeks.Select((w, i) => (w, i)).ToDictionary(x => x.w, x => x.i);
        var byPerson = people.ToDictionary(p => p.Id);
        return entries.Where(e => index.ContainsKey(e.Week))
            .GroupBy(e => KeyOf(axis, e))
            .Select(g =>
            {
                var first = g.First();
                var byWeek = weeks.Select(w => g.Count(e => e.Week == w)).ToList();
                var person = byPerson.GetValueOrDefault(first.PersonId);
                return axis switch
                {
                    ReportAxis.project => new ReportEntity(g.Key, first.ProjectName, first.ProjectCode, members.GetValueOrDefault(first.ProjectId), byWeek, byWeek.Sum()),
                    ReportAxis.person => new ReportEntity(g.Key, person?.Name ?? "", person?.Team ?? "", 0, byWeek, byWeek.Sum()),
                    _ => new ReportEntity(g.Key, first.ActivityName, "", g.Select(e => e.ProjectId).Distinct().Count(), byWeek, byWeek.Sum()),
                };
            })
            .OrderByDescending(e => e.Total).ThenBy(e => e.Label, French)
            .ToList();
    }

    /// <summary>
    /// Couleurs de séries : la couleur suit l'entité, pas son rang dans l'affichage. Attribuées sur
    /// tout le périmètre (toute l'équipe), par jours décroissants : un filtre ne repeint pas les
    /// séries restantes. Au-delà de quatre entités, les trois premières gardent leur couleur et le
    /// reste forme « Autres ».
    /// </summary>
    public static IReadOnlyList<ReportSeries> AssignSeries(IReadOnlyList<ReportEntity> entities)
    {
        var sorted = entities.OrderByDescending(e => e.Total).ThenBy(e => e.Label, French).ToList();
        if (sorted.Count <= SeriesCount) return sorted.Select((e, i) => new ReportSeries(e.Key, e.Label, i, [e.Key])).ToList();
        var head = sorted.Take(SeriesCount - 1).Select((e, i) => new ReportSeries(e.Key, e.Label, i, [e.Key])).ToList();
        head.Add(new ReportSeries(OthersKey, OthersLabel, SeriesCount - 1, sorted.Skip(SeriesCount - 1).Select(e => e.Key).ToList()));
        return head;
    }

    /// <summary>Indicateurs : jours saisis sur la capacité, jours et fiches manquants, fiches validées sur le total attendu.</summary>
    public static ReportKpis Kpis(int entered, IReadOnlyList<SheetState> sheets, int persons, IReadOnlyList<int> weekCapacity)
    {
        var capacity = persons * weekCapacity.Sum();
        return new ReportKpis(
            entered,
            capacity,
            persons,
            weekCapacity.Count,
            Math.Max(0, capacity - entered),
            sheets.Count(s => s.Status == DisplayStatus.MISSING),
            sheets.Count(s => s.Status == DisplayStatus.VALIDATED),
            sheets.Count(s => s.Status == DisplayStatus.SUBMITTED),
            sheets.Count);
    }
}
