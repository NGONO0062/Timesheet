namespace TimeSheet.Api.Domain.Divisions;

using System.Globalization;
using TimeSheet.Api.Domain.Timesheets;

public sealed record TeamInfo(Guid Id, string Name, Guid? ManagerId, string? Manager);

/// <summary>Collaborateur compté dans la vue : il saisit ses temps et ne manage pas d'équipe.</summary>
public sealed record Member(Guid Id, string Name, Guid? TeamId, Guid? ManagerId, string? Manager);

/// <summary>Fiche d'une personne pour une semaine : jours saisis (brouillon compris) et statut enregistré.</summary>
public sealed record PersonWeek(Guid PersonId, IsoWeek Week, int Days, TimesheetStatus? Stored);

/// <summary>Ligne du tableau par équipe (« sans-equipe » et « division » pour les lignes calculées).</summary>
public sealed record TeamRow(string Id, string Name, string? Manager, int Persons, int Entered, int Capacity, int Fill, int Submitted, int Validated, bool Under);

public sealed record TrendPoint(int Year, int Week, int Fill, bool Open);

/// <summary>
/// Dérive à traiter (planche 11). <c>Kind</c> : BUDGET, UNDERFILL, LATE_VALIDATION, MISSING.
/// <c>TargetId</c> : projet, équipe, manager ou personne selon le type ; les champs chiffrés
/// ne sont remplis que pour le type qui les utilise.
/// </summary>
public sealed record Drift(
    string Kind,
    string Key,
    string TargetId,
    string Label,
    string? Owner,
    int? Year = null,
    int? Week = null,
    int? Consumed = null,
    int? Budget = null,
    int? Fill = null,
    int? Threshold = null,
    int? Count = null,
    int? Days = null,
    int? Missing = null);

/// <summary>Règles pures de la vue consolidée (reprises de lib/division/consolidated.ts).</summary>
public static class ConsolidatedRules
{
    public const int TrendWeeks = 6;
    public const string NoTeam = "sans-equipe";
    public const string DivisionRow = "division";
    private static readonly StringComparer French = StringComparer.Create(new CultureInfo("fr-FR"), false);
    private static readonly string[] Order = ["BUDGET", "UNDERFILL", "LATE_VALIDATION", "MISSING"];

    /// <summary>Taux de remplissage en pour cent entier ; 0 sans capacité.</summary>
    public static int FillRate(int entered, int capacity) =>
        capacity > 0 ? (int)Math.Round(entered * 100m / capacity, MidpointRounding.AwayFromZero) : 0;

    private static bool IsSubmitted(TimesheetStatus? s) => s is TimesheetStatus.SUBMITTED or TimesheetStatus.VALIDATED;

    private static TeamRow Row(string id, string name, string? manager, IReadOnlyList<Member> people, IReadOnlyList<PersonWeek> states, int weekCapacity, int threshold)
    {
        var ids = people.Select(p => p.Id).ToHashSet();
        var own = states.Where(s => ids.Contains(s.PersonId)).ToList();
        var entered = own.Sum(s => s.Days);
        var capacity = people.Count * weekCapacity;
        var fill = FillRate(entered, capacity);
        return new TeamRow(id, name, manager, people.Count, entered, capacity, fill,
            own.Count(s => IsSubmitted(s.Stored)), own.Count(s => s.Stored == TimesheetStatus.VALIDATED), people.Count > 0 && fill < threshold);
    }

    /// <summary>
    /// Tableau par équipe pour une semaine (les plus nombreuses d'abord), et ligne Division. Une
    /// personne sans équipe compte dans la ligne Division et dans une ligne « Sans équipe ».
    /// </summary>
    public static (IReadOnlyList<TeamRow> Rows, TeamRow Total) TeamTable(IReadOnlyList<TeamInfo> teams, IReadOnlyList<Member> people, IReadOnlyList<PersonWeek> states, IsoWeek week, int weekCapacity, int threshold)
    {
        var ofWeek = states.Where(s => s.Week == week).ToList();
        var rows = teams
            .Select(t => Row(t.Id.ToString(), t.Name, t.Manager, people.Where(p => p.TeamId == t.Id).ToList(), ofWeek, weekCapacity, threshold))
            .Where(r => r.Persons > 0)
            .OrderByDescending(r => r.Persons).ThenBy(r => r.Name, French)
            .ToList();
        var loose = people.Where(p => p.TeamId is null || teams.All(t => t.Id != p.TeamId)).ToList();
        if (loose.Count > 0) rows.Add(Row(NoTeam, "Sans équipe", null, loose, ofWeek, weekCapacity, threshold));
        return (rows, Row(DivisionRow, "Division", null, people, ofWeek, weekCapacity, threshold));
    }

    /// <summary>Taux de remplissage des semaines données ; une semaine courante (ou future) est ouverte.</summary>
    public static IReadOnlyList<TrendPoint> Trend(IReadOnlyList<IsoWeek> weeks, IReadOnlyList<PersonWeek> states, int persons, IReadOnlyList<int> capacities, IsoWeek current) =>
        weeks.Select((w, i) => new TrendPoint(w.Year, w.Week, FillRate(states.Where(s => s.Week == w).Sum(s => s.Days), persons * capacities[i]), w >= current)).ToList();

    /// <summary>Projets dont les jours consommés (fiches soumises ou validées) dépassent le budget.</summary>
    public static IEnumerable<Drift> BudgetDrifts(IEnumerable<(Guid Id, string Name, int Consumed, int Budget, string? Owner)> projects) =>
        projects.Where(p => p.Consumed > p.Budget)
            .OrderByDescending(p => p.Consumed - p.Budget).ThenBy(p => p.Name, French)
            .Select(p => new Drift("BUDGET", $"budget-{p.Id}", p.Id.ToString(), p.Name, p.Owner, Consumed: p.Consumed, Budget: p.Budget));

    /// <summary>Équipes sous le seuil de remplissage de la division pour la semaine.</summary>
    public static IEnumerable<Drift> UnderfillDrifts(IEnumerable<TeamRow> rows, IsoWeek week, int threshold) =>
        rows.Where(r => r.Under && r.Id != NoTeam)
            .Select(r => new Drift("UNDERFILL", $"remplissage-{r.Id}", r.Id, r.Name, r.Manager, week.Year, week.Week, Fill: r.Fill, Threshold: threshold));

    /// <summary>Fiches soumises en attente depuis plus de N jours ouvrés, regroupées par validateur.</summary>
    public static IEnumerable<Drift> LateDrifts(IEnumerable<(Guid ManagerId, string Manager, string Team, bool Late)> sheets, int days) =>
        sheets.Where(s => s.Late)
            .GroupBy(s => s.ManagerId)
            .Select(g => (Id: g.Key, g.First().Manager, g.First().Team, Count: g.Count()))
            .OrderByDescending(g => g.Count).ThenBy(g => g.Team, French)
            .Select(g => new Drift("LATE_VALIDATION", $"retard-{g.Id}", g.Id.ToString(), g.Team, g.Manager, Count: g.Count, Days: days));

    /// <summary>Semaines dont l'échéance est passée sans soumission : jours attendus non saisis. Les plus récentes d'abord.</summary>
    public static IEnumerable<Drift> MissingDrifts(IReadOnlyList<Member> people, IReadOnlyList<PersonWeek> states, IReadOnlyList<IsoWeek> weeks, IReadOnlyList<int> expected, IReadOnlyList<DateTimeOffset> deadlines, DateTimeOffset now)
    {
        var drifts = new List<(IsoWeek Week, Drift Drift)>();
        for (var i = 0; i < weeks.Count; i++)
        {
            var w = weeks[i];
            foreach (var p in people)
            {
                var s = states.FirstOrDefault(x => x.PersonId == p.Id && x.Week == w);
                if (WeekRules.Display(s?.Stored, deadlines[i], now) != DisplayStatus.MISSING) continue;
                drifts.Add((w, new Drift("MISSING", $"saisie-{p.Id}-{w.Year}-{w.Week}", p.Id.ToString(), p.Name, p.Manager, w.Year, w.Week, Missing: Math.Max(0, expected[i] - (s?.Days ?? 0)))));
            }
        }
        return drifts.OrderByDescending(d => d.Week).ThenBy(d => d.Drift.Label, French).Select(d => d.Drift);
    }

    /// <summary>Toutes les dérives, dans l'ordre de la planche : budget, remplissage, validation, saisie.</summary>
    public static IReadOnlyList<Drift> Sort(IEnumerable<Drift> drifts) => drifts.OrderBy(d => Array.IndexOf(Order, d.Kind)).ToList();
}
