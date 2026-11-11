namespace TimeSheet.Api.Domain.Admin;

using System.Globalization;

/// <summary>Jour férié saisi dans l'administration : date jj/mm/aaaa et libellé.</summary>
public sealed record HolidayInput(string? Date, string? Label);

/// <summary>Règles des jours fériés d'une division (écran 12, bloc « Jours fériés »).</summary>
public static class HolidayRules
{
    public const int LabelMax = 80;
    public const int MinYear = 2000;
    public const int MaxYear = 2100;

    /// <summary>« 01/05/2026 » ou « 1/5/2026 » → date ; null si la date n'existe pas ou sort de 2000–2100.</summary>
    public static DateOnly? ParseDate(string? raw) =>
        DateOnly.TryParseExact(raw?.Trim(), "d/M/yyyy", CultureInfo.InvariantCulture, DateTimeStyles.None, out var d) && d.Year is >= MinYear and <= MaxYear ? d : null;

    /// <summary>Libellé sans espaces en trop ; null s'il est vide ou dépasse 80 caractères.</summary>
    public static string? CleanLabel(string? raw)
    {
        var label = string.Join(' ', (raw ?? "").Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
        return label.Length is > 0 and <= LabelMax ? label : null;
    }

    /// <summary>Champs en erreur : <c>holidayDate</c>, <c>holidayLabel</c>.</summary>
    public static List<string> Check(HolidayInput h)
    {
        var e = new List<string>();
        if (ParseDate(h.Date) is null) e.Add("holidayDate");
        if (CleanLabel(h.Label) is null) e.Add("holidayLabel");
        return e;
    }

    /// <summary>Années proposées à l'écran : celles qui ont un jour férié, l'année en cours et la suivante.</summary>
    public static IReadOnlyList<int> Years(IEnumerable<DateOnly> dates, int currentYear) =>
        dates.Select(d => d.Year).Append(currentYear).Append(currentYear + 1).Distinct().Order().ToList();
}
