namespace TimeSheet.Api.Domain.Timesheets;

using System.Globalization;

/// <summary>Onglets de la file de validation (écran 07).</summary>
public enum QueueTab
{
    SUBMITTED,
    VALIDATED,
    REJECTED,
    ALL,
}

/// <summary>
/// Règles pures de la validation (reprises de lib/validation/queue.ts et lib/timesheet/workdays.ts) :
/// périodes de la file, jours ouvrés, relance du validateur.
/// </summary>
public static class ValidationRules
{
    public const string DefaultPeriod = "4s";
    private const int LastWeeks = 4;

    /// <summary>
    /// Semaines d'une période de la file ; null pour « Toutes les périodes ». Clés : « 4s » (les
    /// 4 dernières semaines, par défaut), « s-2026-12 » (une semaine), « m-2026-3 » (les semaines
    /// dont le lundi tombe en mars 2026), « tout ». Une clé inconnue vaut la période par défaut.
    /// </summary>
    public static IReadOnlyList<IsoWeek>? PeriodWeeks(string? key, IsoWeek current)
    {
        var parts = (key ?? DefaultPeriod).Split('-');
        int Part(int i) => int.TryParse(parts[i], NumberStyles.None, CultureInfo.InvariantCulture, out var n) ? n : -1;
        switch (parts[0])
        {
            case "tout" when parts.Length == 1:
                return null;
            case "s" when parts.Length == 3 && IsoWeek.IsValid(Part(1), Part(2)):
                return [new IsoWeek(Part(1), Part(2))];
            case "m" when parts.Length == 3 && Part(1) is >= 2000 and <= 2100 && Part(2) is >= 1 and <= 12:
                return WeeksOfMonth(Part(1), Part(2));
            default:
                return Enumerable.Range(0, LastWeeks).Select(i => current.Shift(-i)).ToList();
        }
    }

    /// <summary>Semaines ISO dont le lundi tombe dans le mois (1 = janvier).</summary>
    public static IReadOnlyList<IsoWeek> WeeksOfMonth(int year, int month)
    {
        var first = new DateOnly(year, month, 1);
        return Enumerable.Range(0, DateTime.DaysInMonth(year, month))
            .Select(first.AddDays)
            .Where(d => d.DayOfWeek == DayOfWeek.Monday)
            .Select(IsoWeek.Of)
            .ToList();
    }

    /// <summary>Le jour est-il ouvré : jour de travail de la division et pas férié ?</summary>
    public static bool IsWorkingDay(DateOnly day, IReadOnlyCollection<DayOfWeek> workingDays, IReadOnlySet<DateOnly> holidays) =>
        workingDays.Contains(day.DayOfWeek) && !holidays.Contains(day);

    /// <summary>Le n-ième jour ouvré après <paramref name="day"/> (n ≥ 1).</summary>
    public static DateOnly AddWorkingDays(DateOnly day, int n, IReadOnlyCollection<DayOfWeek> workingDays, IReadOnlySet<DateOnly> holidays)
    {
        if (workingDays.Count == 0) throw new InvalidOperationException("Aucun jour ouvré dans la division.");
        var d = day;
        for (var left = n; left > 0;)
        {
            d = d.AddDays(1);
            if (IsWorkingDay(d, workingDays, holidays)) left--;
        }
        return d;
    }

    /// <summary>
    /// Relance due : la fiche attend une décision depuis <paramref name="afterDays"/> jours ouvrés
    /// révolus (jour de soumission non compté), et aucune relance n'est partie depuis la dernière
    /// soumission.
    /// </summary>
    public static bool ReminderDue(DateOnly submittedDay, DateOnly today, int afterDays, IReadOnlyCollection<DayOfWeek> workingDays, IReadOnlySet<DateOnly> holidays, bool alreadyReminded) =>
        !alreadyReminded && today > AddWorkingDays(submittedDay, afterDays, workingDays, holidays);
}
