namespace TimeSheet.Api.Services.Security;

/// <summary>
/// Profils de démonstration (bloc « Prototype uniquement » de l'écran de connexion, PROMPT.md §10),
/// repris de lib/demo.ts. Ils entrent sans mot de passe : désactivés par défaut, et en production
/// acceptés seulement sur une adresse locale (staging sur un poste), jamais sur un serveur joignable.
/// </summary>
public static class DemoProfiles
{
    public sealed record Account(string Label, string Email);

    public static readonly Account[] Accounts =
    [
        new("Staff", "aicha.ndongo@exemple.com"),
        new("Manager", "samuel.etoga@exemple.com"),
        new("Owner", "brigitte.mbarga@exemple.com"),
        new("Admin division", "paul.tchouta@exemple.com"),
        new("Admin plateforme", "rose.ekambi@exemple.com"),
    ];

    /// <summary>Adresse servie sur ce poste seulement.</summary>
    public static bool IsLocalUrl(string? url) =>
        Uri.TryCreate(url, UriKind.Absolute, out var uri) && uri.Host is "localhost" or "127.0.0.1" or "[::1]";

    public static bool Allowed(bool isProduction, string? demoProfiles, string? appUrl) =>
        demoProfiles == "true" && (!isProduction || IsLocalUrl(appUrl));

    /// <summary>Réglages qui empêchent de démarrer en production ; liste vide si tout va bien.</summary>
    public static IReadOnlyList<string> ProductionProblems(bool isProduction, string? demoProfiles, string? appUrl)
    {
        if (!isProduction) return [];
        var problems = new List<string>();
        if (string.IsNullOrWhiteSpace(appUrl)) problems.Add("APP_URL est vide : les liens des e-mails pointeraient vers localhost.");
        if (demoProfiles == "true" && !IsLocalUrl(appUrl)) problems.Add("DEMO_PROFILES vaut « true » sur une adresse publique : connexion sans mot de passe.");
        return problems;
    }
}
