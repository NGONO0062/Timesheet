namespace TimeSheet.Api.Domain.Divisions;

using TimeSheet.Api.Domain.Access;

/// <summary>
/// Division (PROMPT.md §7) : unité étanche. Aucune donnée ne traverse d'une division à
/// l'autre ; chaque requête porte l'identifiant de la division de l'utilisateur connecté.
/// </summary>
public class Division : BaseEntity
{
    public string Name { get; private set; } = "";
    public string Slug { get; private set; } = "";
    public string Direction { get; private set; } = "";
    public string? Department { get; private set; }
    public string? Service { get; private set; }
    public DivisionStatus Status { get; private set; } = DivisionStatus.ONBOARDING;
    public int OnboardingStep { get; private set; } = 1;

    private readonly List<RolePermission> _permissions = [];
    public IReadOnlyCollection<RolePermission> Permissions => _permissions;

    public static Division Create(string name, string slug, string direction, string? department = null, string? service = null, DivisionStatus status = DivisionStatus.ONBOARDING)
    {
        return new Division { Name = name.Trim(), Slug = slug.Trim().ToLowerInvariant(), Direction = direction.Trim(), Department = department, Service = service, Status = status };
    }

    /// <summary>Une division suspendue bloque la connexion de tous ses utilisateurs ; rien n'est supprimé.</summary>
    public bool AllowsSignIn => Status != DivisionStatus.SUSPENDED;

    public void SetStatus(DivisionStatus status) => Status = status;

    /// <summary>Accorde ou retire une permission à un rôle ; la permission verrouillée reste inchangée.</summary>
    public void SetPermission(Role role, Permission permission, bool granted)
    {
        if (role == Role.PLATFORM_ADMIN || PermissionRules.IsLocked(role, permission)) return;
        var existing = _permissions.FirstOrDefault(p => p.Role == role && p.Permission == permission);
        if (existing is null) _permissions.Add(new RolePermission(Id, role, permission, granted));
        else existing.Granted = granted;
    }

    public IEnumerable<MatrixOverride> Overrides => _permissions.Select(p => new MatrixOverride(p.Role, p.Permission, p.Granted));

    protected Division() { } // EF
}

/// <summary>Réglage de la matrice des permissions d'une division (écran 12).</summary>
public class RolePermission
{
    public Guid DivisionId { get; private set; }
    public Role Role { get; private set; }
    public Permission Permission { get; private set; }
    public bool Granted { get; internal set; }

    internal RolePermission(Guid divisionId, Role role, Permission permission, bool granted)
    {
        DivisionId = divisionId;
        Role = role;
        Permission = permission;
        Granted = granted;
    }

    protected RolePermission() { } // EF
}
