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

    /// <summary>« Du 9 au 13 mars 2026 », « Du 27 février au 3 mars 2026 », « Du 29 décembre 2025 au 2 janvier 2026 ».</summary>
    public static string FromTo(DateOnly start, DateOnly end)
    {
        var from = start.Year != end.Year ? Date(start) : start.Month != end.Month ? $"{start.Day} {Months[start.Month - 1]}" : start.Day.ToString(CultureInfo.InvariantCulture);
        return $"Du {from} au {Date(end)}";
    }

    /// <summary>« 20/03/2026 »</summary>
    public static string ShortDate(DateOnly d) => d.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture);

    /// <summary>0.89 → « 89 % » (espace insécable).</summary>
    public static string Percent(decimal ratio) => $"{Math.Round(ratio * 100, MidpointRounding.AwayFromZero):0}{Nbsp}%";

    /// <summary>Part d'un total, une décimale : « 41,9 % » ; le total s'écrit « 100 % ».</summary>
    public static string Share(decimal part, decimal total)
    {
        if (total <= 0) return $"0{Nbsp}%";
        var value = Math.Round(part * 1000 / total, MidpointRounding.AwayFromZero) / 10;
        return value == 100 ? $"100{Nbsp}%" : $"{value.ToString("0.0", CultureInfo.InvariantCulture).Replace('.', ',')}{Nbsp}%";
    }

    /// <summary>1 → « 1 jour », 3 → « 3 jours » (espace insécable, singulier sous 2).</summary>
    public static string Days(decimal n) => $"{n.ToString("0.##", CultureInfo.InvariantCulture).Replace('.', ',')}{Nbsp}{(Math.Abs(n) < 2 ? "jour" : "jours")}";
}
