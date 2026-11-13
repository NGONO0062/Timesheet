namespace TimeSheet.Api.Domain.Projects;

/// <summary>
/// Fiche projet : part du budget consommée, part du délai écoulée, points d'attention.
/// Règles pures, sans base ni horloge.
/// </summary>
public static class ProjectSheetRules
{
    /// <summary>Écart, en points, à partir duquel le budget est dit « en avance sur le délai ».</summary>
    public const int AheadMargin = 20;

    /// <summary>Jours sans journée saisie à partir desquels un projet en cours est dit « sans activité ».</summary>
    public const int QuietDays = 21;

    /// <summary>Semaines de la tendance, semaine en cours comprise.</summary>
    public const int TrendWeeks = 8;

    /// <summary>Part du budget consommée, en pour cent (peut dépasser 100) ; null sans budget.</summary>
    public static int? BudgetPercent(int consumed, int? budget) =>
        budget is > 0 ? (int)Math.Round(consumed * 100m / budget.Value, MidpointRounding.AwayFromZero) : null;

    /// <summary>Part du délai écoulée au jour dit, de 0 à 100 ; null sans date de fin.</summary>
    public static int? ElapsedPercent(DateOnly start, DateOnly? end, DateOnly today)
    {
        if (end is not { } last || last < start) return null;
        var total = last.DayNumber - start.DayNumber + 1;
        var elapsed = Math.Clamp(today.DayNumber - start.DayNumber + 1, 0, total);
        return (int)Math.Round(elapsed * 100m / total, MidpointRounding.AwayFromZero);
    }

    /// <summary>
    /// Points d'attention, du plus grave au moins grave :
    /// <c>overBudget</c> (consommé au-delà du budget), <c>endPassed</c> (date de fin dépassée, projet
    /// encore en cours), <c>budgetAhead</c> (le budget se consomme plus vite que le délai, d'au moins
    /// <see cref="AheadMargin"/> points), <c>quiet</c> (projet en cours sans journée depuis
    /// <see cref="QuietDays"/> jours). <paramref name="lastDay"/> : dernière journée saisie sur le projet.
    /// </summary>
    public static IReadOnlyList<string> Attention(ProjectStatus status, int consumed, int? budget, DateOnly start, DateOnly? end, DateOnly today, DateOnly? lastDay)
    {
        var points = new List<string>();
        var running = status == ProjectStatus.IN_PROGRESS;
        if (budget is > 0 && consumed > budget) points.Add("overBudget");
        if (running && end is { } last && last < today) points.Add("endPassed");
        if (running && BudgetPercent(consumed, budget) is { } used && used <= 100 && ElapsedPercent(start, end, today) is { } elapsed && elapsed < 100 && used - elapsed >= AheadMargin)
            points.Add("budgetAhead");
        var since = lastDay ?? start;
        if (running && today.DayNumber - since.DayNumber >= QuietDays) points.Add("quiet");
        return points;
    }
}
