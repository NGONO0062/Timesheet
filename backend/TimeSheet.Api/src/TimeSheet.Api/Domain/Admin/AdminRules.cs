namespace TimeSheet.Api.Domain.Admin;

using System.Globalization;
using System.Text.RegularExpressions;
using TimeSheet.Api.Domain.Access;
using TimeSheet.Api.Domain.Attendance;

/// <summary>Stage saisi dans la fenêtre « Modifier » (dates jj/mm/aaaa).</summary>
public sealed record InternshipInput(string? Kind, string? Direction, string? Department, string? Service, string? Start, string? End);

/// <summary>Utilisateur saisi dans la fenêtre d'invitation ou de modification (écran 12).</summary>
public sealed record UserInput(string? Email, string? FirstName, string? LastName, string? Role, Guid? ManagerId, InternshipInput? Internship);

/// <summary>Workflow de la division (écran 12).</summary>
public sealed record WorkflowInput(string? HrEmail, bool HrAutoSend, int ReminderAfterWorkingDays, bool DelegateToOwner);

/// <summary>Règles de saisie (écran 12) : jours en anglais (« MONDAY »), seuil en texte saisi.</summary>
public sealed record RulesInput(string[]? WorkingDays, string? DeadlineDay, string? DeadlineTime, string? FillAlertThreshold, bool AllowFutureWeeks, bool LockAfterValidation);

/// <summary>Page de la liste des utilisateurs : « Utilisateurs 1 à 5 sur 21 ».</summary>
public sealed record PageInfo(int Page, int Count, int From, int To, int Skip);

/// <summary>
/// Règles pures de l'administration de division et des paramètres (reprises de
/// lib/admin/rules.ts). Les erreurs sont des noms de champs ; l'interface a les messages.
/// </summary>
public static partial class AdminRules
{
    public const int UsersPageSize = 5;
    public const int PasswordMin = 12;
    public static readonly int[] ReminderDays = [2, 3, 5];
    public static readonly string[] Weekdays = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
    public static readonly string[] DeadlineDays = ["FRIDAY", "MONDAY"];
    private static readonly string[] WeekdaysShort = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

    [GeneratedRegex(@"^[^\s@]+@[^\s@]+\.[^\s@]+$")]
    private static partial Regex EmailPattern();

    [GeneratedRegex(@"^([01]\d|2[0-3]):[0-5]\d$")]
    private static partial Regex TimePattern();

    public static bool IsEmail(string? s) => s is not null && s.Length <= 254 && EmailPattern().IsMatch(s.Trim());
    public static bool IsTime(string? s) => s is not null && TimePattern().IsMatch(s.Trim());

    public static DayOfWeek ToDay(string key) => key switch
    {
        "MONDAY" => DayOfWeek.Monday,
        "TUESDAY" => DayOfWeek.Tuesday,
        "WEDNESDAY" => DayOfWeek.Wednesday,
        "THURSDAY" => DayOfWeek.Thursday,
        "FRIDAY" => DayOfWeek.Friday,
        "SATURDAY" => DayOfWeek.Saturday,
        _ => DayOfWeek.Sunday,
    };

    public static string FromDay(DayOfWeek day) => Weekdays[((int)day + 6) % 7];

    /// <summary>« 05/01/2026 » → date ; null si invalide.</summary>
    public static DateOnly? ParseFrDate(string? s) =>
        DateOnly.TryParseExact(s?.Trim(), "dd/MM/yyyy", CultureInfo.InvariantCulture, DateTimeStyles.None, out var d) ? d : null;

    public static string FormatFrDate(DateOnly d) => d.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture);

    // ---------------------------------------------------------------------------------
    // Matrice des permissions
    // ---------------------------------------------------------------------------------

    /// <summary>Matrice effective d'une division : la matrice par défaut, puis ses réglages.</summary>
    public static Dictionary<Role, Permission[]> MatrixOf(IEnumerable<MatrixOverride> overrides)
    {
        var list = overrides.ToList();
        return PermissionRules.DivisionRoles.ToDictionary(r => r, r => Enum.GetValues<Permission>().Where(PermissionRules.Effective(r, list).Contains).ToArray());
    }

    /// <summary>Matrice reçue de l'interface (rôle → permissions) ; « matrix » si elle est incomplète ou inconnue.</summary>
    public static Dictionary<Role, Permission[]> ParseMatrix(IReadOnlyDictionary<string, string[]>? input)
    {
        var matrix = new Dictionary<Role, Permission[]>();
        foreach (var (key, values) in input ?? new Dictionary<string, string[]>())
        {
            var role = ParseDivisionRole(key) ?? throw new Exceptions.RuleException("matrix");
            matrix[role] = (values ?? []).Select(v => Enum.TryParse<Permission>(v, out var p) && v == p.ToString() ? p : throw new Exceptions.RuleException("matrix")).Distinct().ToArray();
        }
        if (matrix.Count != PermissionRules.DivisionRoles.Length) throw new Exceptions.RuleException("matrix");
        return matrix;
    }

    /// <summary>Réglages à enregistrer : seulement les écarts à la matrice par défaut ; la permission verrouillée reste accordée.</summary>
    public static List<MatrixOverride> OverridesFor(IReadOnlyDictionary<Role, Permission[]> matrix)
    {
        var result = new List<MatrixOverride>();
        foreach (var role in PermissionRules.DivisionRoles)
        {
            var granted = matrix.TryGetValue(role, out var g) ? g : [];
            foreach (var permission in Enum.GetValues<Permission>())
            {
                if (PermissionRules.IsLocked(role, permission)) continue;
                var wanted = granted.Contains(permission);
                if (wanted != PermissionRules.DefaultMatrix[role].Contains(permission)) result.Add(new MatrixOverride(role, permission, wanted));
            }
        }
        return result;
    }

    // ---------------------------------------------------------------------------------
    // Workflow et règles de saisie
    // ---------------------------------------------------------------------------------

    public static List<string> CheckWorkflow(WorkflowInput w)
    {
        var e = new List<string>();
        if (!IsEmail(w.HrEmail)) e.Add("hrEmail");
        if (!ReminderDays.Contains(w.ReminderAfterWorkingDays)) e.Add("reminder");
        return e;
    }

    public static List<string> CheckRules(RulesInput r)
    {
        var e = new List<string>();
        var days = r.WorkingDays ?? [];
        if (days.Length == 0 || days.Any(d => !Weekdays.Contains(d))) e.Add("workingDays");
        if (!DeadlineDays.Contains(r.DeadlineDay) || !IsTime(r.DeadlineTime)) e.Add("deadline");
        if (ParseThreshold(r.FillAlertThreshold) is null) e.Add("threshold");
        return e;
    }

    /// <summary>Seuil entier entre 0 et 100 ; null sinon.</summary>
    public static int? ParseThreshold(string? raw) =>
        int.TryParse(raw?.Trim(), NumberStyles.None, CultureInfo.InvariantCulture, out var n) && n is >= 0 and <= 100 ? n : null;

    /// <summary>Changements lisibles d'une règle à l'autre, pour l'objet du journal d'audit.</summary>
    public static List<string> DescribeRules(RulesInput before, RulesInput after)
    {
        static string OnOff(bool v) => v ? "Actif" : "Inactif";
        static (string Label, string Value)[] View(RulesInput r) =>
        [
            ("Jours ouvrés", string.Join(", ", Weekdays.Select((d, i) => (d, i)).Where(x => (r.WorkingDays ?? []).Contains(x.d)).Select(x => WeekdaysShort[x.i]))),
            ("Échéance de soumission", $"{(r.DeadlineDay == "MONDAY" ? "Lundi suivant" : "Vendredi")} {r.DeadlineTime?.Trim()}"),
            ("Seuil d'alerte de remplissage", $"{r.FillAlertThreshold?.Trim()} %"),
            ("Autoriser la saisie des semaines futures", OnOff(r.AllowFutureWeeks)),
            ("Verrouiller la fiche après validation", OnOff(r.LockAfterValidation)),
        ];
        var old = View(before);
        return View(after).Where((x, i) => x.Value != old[i].Value).Select(x => $"{x.Label} : {x.Value}").ToList();
    }

    // ---------------------------------------------------------------------------------
    // Utilisateurs
    // ---------------------------------------------------------------------------------

    public static Role? ParseDivisionRole(string? role) =>
        Enum.TryParse<Role>(role, out var r) && PermissionRules.DivisionRoles.Contains(r) && role == r.ToString() ? r : null;

    public static InternshipKind? ParseKind(string? kind) => Enum.TryParse<InternshipKind>(kind, out var k) && kind == k.ToString() ? k : null;

    /// <summary>
    /// Champs en erreur. Seul un compte Staff peut être stagiaire (§7). `managerIds` : managers
    /// et owners actifs de la division. `checkEmail` : faux à la modification (l'adresse ne change pas).
    /// </summary>
    public static List<string> CheckUser(UserInput u, IReadOnlyCollection<Guid> managerIds, bool checkEmail = true)
    {
        var e = new List<string>();
        if (checkEmail && !IsEmail(u.Email)) e.Add("email");
        if (string.IsNullOrWhiteSpace(u.FirstName) || u.FirstName.Length > 100) e.Add("firstName");
        if (string.IsNullOrWhiteSpace(u.LastName) || u.LastName.Length > 100) e.Add("lastName");
        var role = ParseDivisionRole(u.Role);
        if (role is null) e.Add("role");
        if (u.ManagerId is { } m && !managerIds.Contains(m)) e.Add("manager");
        if (u.Internship is { } i)
        {
            if (role is not null && role != Role.STAFF) e.Add("internRole");
            if (ParseKind(i.Kind) is null) e.Add("internKind");
            if (string.IsNullOrWhiteSpace(i.Direction) || i.Direction.Length > 100) e.Add("internDirection");
            if (string.IsNullOrWhiteSpace(i.Department) || i.Department.Length > 100) e.Add("internDepartment");
            if (string.IsNullOrWhiteSpace(i.Service) || i.Service.Length > 100) e.Add("internService");
            var start = ParseFrDate(i.Start);
            var end = ParseFrDate(i.End);
            if (start is null) e.Add("internStart");
            if (end is null || (start is not null && end < start)) e.Add("internEnd");
        }
        return e;
    }

    public static PageInfo PageOf(int total, int requested, int size = UsersPageSize)
    {
        var count = Math.Max(1, (int)Math.Ceiling(total / (double)size));
        var page = Math.Clamp(requested, 1, count);
        return new PageInfo(page, count, total == 0 ? 0 : (page - 1) * size + 1, Math.Min(total, page * size), (page - 1) * size);
    }

    // ---------------------------------------------------------------------------------
    // Mot de passe (politique à confirmer : docs/questions-ouvertes.md)
    // ---------------------------------------------------------------------------------

    /// <summary>« passwordRules » (12 caractères, une lettre, un chiffre), « passwordConfirm », ou null.</summary>
    public static string? CheckNewPassword(string? next, string? confirm)
    {
        next ??= "";
        if (next.Length < PasswordMin || next.Length > 200 || !next.Any(char.IsAsciiLetter) || !next.Any(char.IsAsciiDigit)) return "passwordRules";
        if (next != confirm) return "passwordConfirm";
        return null;
    }
}
