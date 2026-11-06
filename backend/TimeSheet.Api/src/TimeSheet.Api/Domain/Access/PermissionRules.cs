namespace TimeSheet.Api.Domain.Access;

/// <summary>Réglage d'une division : une permission accordée ou retirée à un rôle (écran 12).</summary>
public sealed record MatrixOverride(Role Role, Permission Permission, bool Granted);

/// <summary>
/// Règles pures des permissions (reprises de lib/permissions.ts). La matrice par défaut
/// est modifiable par division ; l'admin plateforme n'a aucune permission de division.
/// </summary>
public static class PermissionRules
{
    public static readonly Role[] DivisionRoles = [Role.STAFF, Role.MANAGER, Role.OWNER, Role.DIVISION_ADMIN];

    /// <summary>Matrice par défaut d'une division.</summary>
    public static readonly IReadOnlyDictionary<Role, Permission[]> DefaultMatrix = new Dictionary<Role, Permission[]>
    {
        [Role.STAFF] = [Permission.ENTER_TIME],
        [Role.MANAGER] = [Permission.ENTER_TIME, Permission.VALIDATE_TEAM, Permission.MANAGE_PROJECTS, Permission.VIEW_REPORTING],
        [Role.OWNER] = [Permission.VALIDATE_TEAM, Permission.MANAGE_PROJECTS, Permission.VIEW_REPORTING, Permission.VIEW_DIVISION],
        [Role.DIVISION_ADMIN] = [Permission.MANAGE_PROJECTS, Permission.VIEW_REPORTING, Permission.VIEW_DIVISION, Permission.ADMINISTER_DIVISION],
    };

    /// <summary>La dernière permission de l'admin de division ne peut pas être retirée.</summary>
    public static bool IsLocked(Role role, Permission permission) =>
        role == Role.DIVISION_ADMIN && permission == Permission.ADMINISTER_DIVISION;

    /// <summary>Permissions effectives d'un rôle : matrice par défaut, puis réglages de la division.</summary>
    public static IReadOnlySet<Permission> Effective(Role role, IEnumerable<MatrixOverride>? overrides = null)
    {
        if (role == Role.PLATFORM_ADMIN) return new HashSet<Permission>();
        var granted = new HashSet<Permission>(DefaultMatrix[role]);
        foreach (var o in overrides ?? [])
        {
            if (o.Role != role || IsLocked(o.Role, o.Permission)) continue;
            if (o.Granted) granted.Add(o.Permission);
            else granted.Remove(o.Permission);
        }
        return granted;
    }
}
