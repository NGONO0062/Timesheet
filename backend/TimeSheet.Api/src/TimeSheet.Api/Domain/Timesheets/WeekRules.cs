namespace TimeSheet.Api.Domain.Timesheets;

using System.Globalization;

/// <summary>Semaine ISO (lundi au dimanche).</summary>
public readonly record struct IsoWeek(int Year, int Week) : IComparable<IsoWeek>
{
    public DateOnly Monday => DateOnly.FromDateTime(ISOWeek.ToDateTime(Year, Week, DayOfWeek.Monday));

    public IsoWeek Shift(int weeks)
    {
        var day = Monday.AddDays(7 * weeks).ToDateTime(TimeOnly.MinValue);
        return new IsoWeek(ISOWeek.GetYear(day), ISOWeek.GetWeekOfYear(day));
    }

    public static IsoWeek Of(DateOnly date)
    {
        var day = date.ToDateTime(TimeOnly.MinValue);
        return new IsoWeek(ISOWeek.GetYear(day), ISOWeek.GetWeekOfYear(day));
    }

    /// <summary>Semaine existante (1 à 52 ou 53 selon l'année).</summary>
    public static bool IsValid(int year, int week) => year is >= 2000 and <= 2100 && week >= 1 && week <= ISOWeek.GetWeeksInYear(year);

    public int CompareTo(IsoWeek other) => Year != other.Year ? Year.CompareTo(other.Year) : Week.CompareTo(other.Week);

    public static bool operator <(IsoWeek a, IsoWeek b) => a.CompareTo(b) < 0;
    public static bool operator >(IsoWeek a, IsoWeek b) => a.CompareTo(b) > 0;
    public static bool operator <=(IsoWeek a, IsoWeek b) => a.CompareTo(b) <= 0;
    public static bool operator >=(IsoWeek a, IsoWeek b) => a.CompareTo(b) >= 0;
}

public enum TimesheetStatus
{
    DRAFT,
    SUBMITTED,
    REJECTED,
    VALIDATED,
}

/// <summary>Statut affiché : « Manquante » n'est pas stocké, il se calcule à l'échéance.</summary>
public enum DisplayStatus
{
    DRAFT,
    SUBMITTED,
    REJECTED,
    VALIDATED,
    MISSING,
}

/// <summary>
/// Règles pures d'une semaine de saisie (reprises de lib/timesheet/rules.ts et transitions.ts).
/// Heure de Douala : UTC+1, sans heure d'été.
/// </summary>
public static class WeekRules
{
    public static readonly TimeSpan DoualaOffset = TimeSpan.FromHours(1);

    /// <summary>Jour à Douala d'un instant.</summary>
    public static DateOnly DoualaDay(DateTimeOffset instant) => DateOnly.FromDateTime((instant.ToUniversalTime() + DoualaOffset).UtcDateTime);

    public static IsoWeek CurrentWeek(DateTimeOffset now) => IsoWeek.Of(DoualaDay(now));

    /// <summary>Jours ouvrés d'une semaine, du lundi au dimanche, selon les réglages de la division.</summary>
    public static IReadOnlyList<DateOnly> WorkingDays(IsoWeek week, IEnumerable<DayOfWeek> workingDays)
    {
        var set = workingDays.ToHashSet();
        return Enumerable.Range(0, 7).Select(i => week.Monday.AddDays(i)).Where(d => set.Contains(d.DayOfWeek)).ToList();
    }

    /// <summary>Instant de l'échéance : jour et heure réglés par la division, à Douala. « Lundi » tombe la semaine d'après.</summary>
    public static DateTimeOffset Deadline(IsoWeek week, DayOfWeek deadlineDay, string deadlineTime)
    {
        var offset = deadlineDay == DayOfWeek.Monday ? 7 : ((int)deadlineDay + 6) % 7;
        var day = week.Monday.AddDays(offset);
        var parts = deadlineTime.Split(':');
        var time = new TimeOnly(int.Parse(parts[0], CultureInfo.InvariantCulture), int.Parse(parts[1], CultureInfo.InvariantCulture));
        return new DateTimeOffset(day.ToDateTime(time), DoualaOffset).ToUniversalTime();
    }

    /// <summary>« Manquante » : échéance passée, fiche absente ou encore en brouillon.</summary>
    public static DisplayStatus Display(TimesheetStatus? stored, DateTimeOffset deadline, DateTimeOffset now)
    {
        var late = now > deadline;
        return stored switch
        {
            null => late ? DisplayStatus.MISSING : DisplayStatus.DRAFT,
            TimesheetStatus.DRAFT => late ? DisplayStatus.MISSING : DisplayStatus.DRAFT,
            TimesheetStatus.SUBMITTED => DisplayStatus.SUBMITTED,
            TimesheetStatus.REJECTED => DisplayStatus.REJECTED,
            _ => DisplayStatus.VALIDATED,
        };
    }

    /// <summary>Une fiche se modifie en brouillon ou après rejet ; validée, seulement si la division ne la verrouille pas.</summary>
    public static bool IsEditable(TimesheetStatus status, bool lockAfterValidation) =>
        status is TimesheetStatus.DRAFT or TimesheetStatus.REJECTED || (status == TimesheetStatus.VALIDATED && !lockAfterValidation);

    /// <summary>Semaine ouverte à la saisie : passée ou courante, ou future si la division l'autorise.</summary>
    public static bool IsWeekOpen(IsoWeek week, IsoWeek current, bool allowFutureWeeks) => allowFutureWeeks || week <= current;

    /// <summary>
    /// « Reprendre la semaine n » : pour chaque jour de la semaine affichée, le choix du même jour
    /// de la semaine reprise, s'il est encore proposé (projet ouvert, hors absence). Une absence
    /// ne se reprend pas : elle ne se répète pas d'une semaine à l'autre.
    /// </summary>
    public static IReadOnlyList<Guid?> CopyFrom(IReadOnlyList<DateOnly> days, IEnumerable<(DateOnly Date, Guid Activity)> source, IReadOnlySet<Guid> copyable)
    {
        var byWeekday = source.Where(s => copyable.Contains(s.Activity)).GroupBy(s => s.Date.DayOfWeek).ToDictionary(g => g.Key, g => g.First().Activity);
        return days.Select(d => byWeekday.TryGetValue(d.DayOfWeek, out var a) ? a : (Guid?)null).ToList();
    }
}
