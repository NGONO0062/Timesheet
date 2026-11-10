namespace TimeSheet.Api.Domain.Platform;

using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using TimeSheet.Api.Domain.Admin;
using TimeSheet.Api.Domain.Timesheets;

/// <summary>Étape 1 de l'onboarding : identité de la division.</summary>
public sealed record IdentityInput(string? Name, string? Slug, string? Direction);

/// <summary>Étape 2 : administrateur (invité à la fin) et configuration de départ (« COPY » ou « BLANK »).</summary>
public sealed record OnboardingAdminInput(string? FullName, string? Email, string? Config);

/// <summary>Filtres du journal d'audit, lus dans l'adresse (planche 13).</summary>
public sealed record AuditParams(Guid? Division, string? Type, string? From, string? To, string? Q, int Page);

/// <summary>Filtres appliqués : textes des dates (ré-affichés) et instants [From, To[.</summary>
public sealed record AuditFilters(Guid? DivisionId, string? Category, string Q, string FromText, string ToText, DateTimeOffset From, DateTimeOffset To, int Page);

/// <summary>
/// Règles pures de la plateforme (reprises de lib/onboarding/rules.ts et lib/audit/) :
/// identité et administrateur d'une division, catalogue et filtres du journal d'audit.
/// </summary>
public static partial class PlatformRules
{
    /// <summary>Division pilote : sa configuration peut être reprise, jamais ses données.</summary>
    public const string PilotSlug = "cx-expertise";
    public const int Steps = 5;
    public const int AuditPageSize = 20;
    public const int ExportLimit = 10_000;

    [GeneratedRegex("^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$")]
    private static partial Regex SlugPattern();

    /// <summary>Identifiant proposé à partir du nom : « Relation client B2B » → « relation-client-b2b ».</summary>
    public static string Slugify(string name)
    {
        var plain = new string(name.Normalize(NormalizationForm.FormD).Where(c => CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark).ToArray()).ToLowerInvariant();
        var slug = Regex.Replace(plain, "[^a-z0-9]+", "-").Trim('-');
        return (slug.Length > 40 ? slug[..40] : slug).TrimEnd('-');
    }

    public static bool IsSlug(string? s) => s is not null && SlugPattern().IsMatch(s) && !s.Contains("--");

    public static List<string> CheckIdentity(IdentityInput i)
    {
        var e = new List<string>();
        if (string.IsNullOrWhiteSpace(i.Name) || i.Name.Length > 100) e.Add("name");
        if (!IsSlug(i.Slug?.Trim())) e.Add("slug");
        if (string.IsNullOrWhiteSpace(i.Direction) || i.Direction.Length > 100) e.Add("direction");
        return e;
    }

    /// <summary>« Nom complet » : le premier mot est le prénom, le reste le nom.</summary>
    public static (string FirstName, string LastName)? SplitName(string? fullName)
    {
        var parts = (fullName ?? "").Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        return parts.Length < 2 || fullName!.Length > 200 ? null : (parts[0], string.Join(' ', parts[1..]));
    }

    public static List<string> CheckAdmin(OnboardingAdminInput a)
    {
        var e = new List<string>();
        if (SplitName(a.FullName) is null) e.Add("fullName");
        if (!AdminRules.IsEmail(a.Email)) e.Add("email");
        if (a.Config is not ("COPY" or "BLANK")) e.Add("config");
        return e;
    }

    // ---------------------------------------------------------------------------------
    // Journal d'audit
    // ---------------------------------------------------------------------------------

    /// <summary>Familles du filtre « Type d'action » et leurs actions.</summary>
    public static readonly IReadOnlyDictionary<string, string[]> Categories = new Dictionary<string, string[]>
    {
        ["LOGIN"] = ["LOGIN_SUCCESS", "LOGIN_FAILURE", "LOGOUT"],
        ["SUBMISSIONS"] = ["TIMESHEET_SUBMITTED"],
        ["VALIDATIONS"] = ["TIMESHEET_VALIDATED"],
        ["REJECTIONS"] = ["TIMESHEET_REJECTED"],
        ["REMINDERS"] = ["VALIDATION_REMINDER_SENT", "FILL_REMINDER_SENT"],
        ["SIGNATURES"] = ["ATTENDANCE_GENERATED", "ATTENDANCE_SIGNED", "ATTENDANCE_SIGNATURE_FAILURE", "ATTENDANCE_REJECTED"],
        ["HR"] = ["ATTENDANCE_SENT"],
        ["RULES"] = ["RULES_CHANGED", "WORKFLOW_CHANGED", "PERMISSIONS_CHANGED"],
        ["USERS"] = ["USER_INVITED", "USER_UPDATED", "USER_ROLE_CHANGED", "USER_ACTIVATED", "USER_DEACTIVATED", "INVITATION_ACCEPTED", "PASSWORD_RESET", "PASSWORD_CHANGED"],
        ["PROJECTS"] = ["PROJECT_CREATED", "PROJECT_UPDATED", "PROJECT_STATUS_CHANGED", "PROJECT_ARCHIVED", "PROJECT_UNARCHIVED"],
        ["DIVISIONS"] = ["DIVISION_CREATED", "DIVISION_UPDATED", "DIVISION_SUSPENDED", "DIVISION_ACTIVATED"],
    };

    /// <summary>Libellés des actions (écran et exports), repris de la planche 13.</summary>
    public static readonly IReadOnlyDictionary<string, string> ActionLabels = new Dictionary<string, string>
    {
        ["LOGIN_SUCCESS"] = "Connexion",
        ["LOGIN_FAILURE"] = "Connexion",
        ["LOGOUT"] = "Déconnexion",
        ["TIMESHEET_SUBMITTED"] = "Soumission de fiche",
        ["TIMESHEET_VALIDATED"] = "Validation de fiche",
        ["TIMESHEET_REJECTED"] = "Rejet de fiche",
        ["VALIDATION_REMINDER_SENT"] = "Relance du validateur",
        ["FILL_REMINDER_SENT"] = "Rappel de saisie",
        ["ATTENDANCE_GENERATED"] = "Génération de fiche de présence",
        ["ATTENDANCE_SIGNED"] = "Signature de fiche de présence",
        ["ATTENDANCE_SIGNATURE_FAILURE"] = "Signature de fiche de présence",
        ["ATTENDANCE_REJECTED"] = "Renvoi de fiche de présence",
        ["ATTENDANCE_SENT"] = "Envoi aux RH",
        ["RULES_CHANGED"] = "Modification de règle",
        ["WORKFLOW_CHANGED"] = "Modification du workflow",
        ["PERMISSIONS_CHANGED"] = "Modification des permissions",
        ["USER_INVITED"] = "Invitation d'utilisateur",
        ["USER_UPDATED"] = "Modification d'utilisateur",
        ["USER_ROLE_CHANGED"] = "Changement de rôle",
        ["USER_ACTIVATED"] = "Activation de compte",
        ["USER_DEACTIVATED"] = "Désactivation de compte",
        ["INVITATION_ACCEPTED"] = "Première connexion",
        ["PASSWORD_RESET"] = "Réinitialisation du mot de passe",
        ["PASSWORD_CHANGED"] = "Changement de mot de passe",
        ["PROJECT_CREATED"] = "Création de projet",
        ["PROJECT_UPDATED"] = "Modification de projet",
        ["PROJECT_STATUS_CHANGED"] = "Changement de statut de projet",
        ["PROJECT_ARCHIVED"] = "Archivage de projet",
        ["PROJECT_UNARCHIVED"] = "Désarchivage de projet",
        ["DIVISION_CREATED"] = "Création de division",
        ["DIVISION_UPDATED"] = "Onboarding de division",
        ["DIVISION_SUSPENDED"] = "Suspension de division",
        ["DIVISION_ACTIVATED"] = "Réactivation de division",
    };

    public static string ActionLabel(string action) => ActionLabels.TryGetValue(action, out var label) ? label : action;

    /// <summary>Période par défaut : du lundi au vendredi de la semaine en cours (planche 13), aujourd'hui compris.</summary>
    public static (DateOnly From, DateOnly To) DefaultPeriod(DateOnly today)
    {
        var monday = today.AddDays(-(((int)today.DayOfWeek + 6) % 7));
        var friday = monday.AddDays(4);
        return (monday, today > friday ? today : friday);
    }

    /// <summary>
    /// Filtres appliqués et erreurs de date (« date » ou « order », par champ). Une date mal
    /// écrite est signalée et la période par défaut s'applique. Jours de Douala (UTC+1).
    /// </summary>
    public static (AuditFilters Filters, Dictionary<string, string> Errors) ParseFilters(AuditParams p, DateOnly today)
    {
        var errors = new Dictionary<string, string>();
        var def = DefaultPeriod(today);
        var fromText = (p.From ?? AdminRules.FormatFrDate(def.From)).Trim();
        var toText = (p.To ?? AdminRules.FormatFrDate(def.To)).Trim();
        var from = AdminRules.ParseFrDate(fromText);
        var to = AdminRules.ParseFrDate(toText);
        if (from is null) errors["from"] = "date";
        if (to is null) errors["to"] = "date";
        if (from is not null && to is not null && to < from) errors["to"] = "order";
        if (errors.Count > 0) (from, to) = (def.From, def.To);
        static DateTimeOffset Start(DateOnly d) => new DateTimeOffset(d.ToDateTime(TimeOnly.MinValue), TimeSpan.Zero) - WeekRules.DoualaOffset;
        var q = (p.Q ?? "").Trim();
        return (new AuditFilters(
            p.Division,
            p.Type is not null && Categories.ContainsKey(p.Type) ? p.Type : null,
            q.Length > 100 ? q[..100] : q,
            fromText.Length > 10 ? fromText[..10] : fromText,
            toText.Length > 10 ? toText[..10] : toText,
            Start(from!.Value),
            Start(to!.Value.AddDays(1)),
            Math.Max(1, p.Page)), errors);
    }

    /// <summary>Nom des fichiers exportés : « Journal_audit_2026-03-16_2026-03-20 ».</summary>
    public static string FileName(AuditFilters f)
    {
        static string Iso(string fr) => AdminRules.ParseFrDate(fr) is { } d ? d.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture) : fr;
        return $"Journal_audit_{Iso(f.FromText)}_{Iso(f.ToText)}";
    }
}
