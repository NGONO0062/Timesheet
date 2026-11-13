namespace TimeSheet.Api.Domain.Projects;

using System.Globalization;

/// <summary>Saisie du panneau de création et de modification (écran 09).</summary>
public sealed record ProjectInput(string? Name, DateOnly? Start, DateOnly? End, string? Status, int? Budget, IReadOnlyList<string>? Activities, IReadOnlyList<Guid>? MemberIds);

/// <summary>Saisie contrôlée, prête à enregistrer.</summary>
public sealed record CleanProject(string Name, DateOnly Start, DateOnly? End, ProjectStatus Status, int? Budget, IReadOnlyList<string> Activities, IReadOnlyList<Guid> MemberIds);

/// <summary>Règles pures des projets (reprises de lib/projects/rules.ts).</summary>
public static class ProjectRules
{
    public const int MaxName = 120;
    public const int MaxActivity = 80;
    public const int MaxBudget = 999_999;

    /// <summary>
    /// Contrôle du panneau (les mêmes règles que l'interface). Les erreurs portent le nom du
    /// champ : « name », « start », « end », « budget », « activities ».
    /// </summary>
    public static (CleanProject? Value, IReadOnlyList<string> Errors) Check(ProjectInput input)
    {
        var errors = new List<string>();
        var name = input.Name?.Trim() ?? "";
        if (name.Length is 0 or > MaxName) errors.Add("name");
        if (input.Start is null) errors.Add("start");
        if (input.End is { } end && input.Start is { } start && end < start) errors.Add("end");
        if (input.Budget is < 0 or > MaxBudget) errors.Add("budget");
        var activities = (input.Activities ?? []).Select(a => a.Trim()).Where(a => a.Length > 0).Distinct().ToList();
        if (activities.Count == 0 || activities.Any(a => a.Length > MaxActivity)) errors.Add("activities");
        var status = ParseStatus(input.Status);
        if (status is null) errors.Add("status");
        if (errors.Count > 0) return (null, errors);
        return (new CleanProject(name, input.Start!.Value, input.End, status!.Value, input.Budget, activities, (input.MemberIds ?? []).Distinct().ToList()), []);
    }

    /// <summary>Statut reçu en texte (« IN_PROGRESS ») ; null s'il est inconnu.</summary>
    public static ProjectStatus? ParseStatus(string? raw) =>
        raw is not null && !int.TryParse(raw, out _) && Enum.TryParse<ProjectStatus>(raw, ignoreCase: false, out var s) && Enum.IsDefined(s) ? s : null;

    /// <summary>Prochain code libre : « CX-2026-07 » (préfixe de la division, année de début, numéro sur deux chiffres).</summary>
    public static string NextCode(string prefix, int year, IEnumerable<string> existing)
    {
        var head = $"{prefix}-{year}-";
        var used = existing.Where(c => c.StartsWith(head, StringComparison.Ordinal))
            .Select(c => int.TryParse(c[head.Length..], NumberStyles.None, CultureInfo.InvariantCulture, out var n) ? n : 0)
            .ToList();
        return $"{head}{(used.Count > 0 ? used.Max() + 1 : 1):00}";
    }

    /// <summary>Préfixe des codes : le département de la division, sinon le début de son identifiant.</summary>
    public static string Prefix(string? department, string slug) =>
        (string.IsNullOrWhiteSpace(department) ? slug[..Math.Min(3, slug.Length)] : department).ToUpperInvariant();
}
