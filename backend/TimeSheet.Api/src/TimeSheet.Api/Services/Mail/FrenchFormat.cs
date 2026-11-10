namespace TimeSheet.Api.Services.Mail;

using System.Globalization;

/// <summary>
/// Formats français des e-mails (repris de lib/format.ts) : l'interface formate elle-même ce
/// qu'elle affiche ; l'API ne formate que ce qu'elle envoie.
/// </summary>
public static class FrenchFormat
{
    private const char Nbsp = ' ';

    private static readonly string[] Months = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
    private static readonly string[] MonthsShort = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

    /// <summary>« 20 mars 2026 »</summary>
    public static string Date(DateOnly d) => $"{d.Day} {Months[d.Month - 1]} {d.Year}";

    /// <summary>« 16–20 mars 2026 », « 28 sept. – 2 oct. 2026 », « 29 déc. 2025 – 2 janv. 2026 ».</summary>
    public static string Range(DateOnly start, DateOnly end)
    {
        if (start.Year == end.Year && start.Month == end.Month) return $"{start.Day}–{end.Day} {Months[start.Month - 1]} {end.Year}";
        if (start.Year == end.Year) return $"{start.Day} {MonthsShort[start.Month - 1]} – {end.Day} {MonthsShort[end.Month - 1]} {end.Year}";
        return $"{start.Day} {MonthsShort[start.Month - 1]} {start.Year} – {end.Day} {MonthsShort[end.Month - 1]} {end.Year}";
    }

    /// <summary>1 → « 1 jour », 3 → « 3 jours » (espace insécable, singulier sous 2).</summary>
    public static string Days(decimal n) => $"{n.ToString("0.##", CultureInfo.InvariantCulture).Replace('.', ',')}{Nbsp}{(Math.Abs(n) < 2 ? "jour" : "jours")}";
}
