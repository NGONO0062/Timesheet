namespace TimeSheet.Api.Domain.Access;

/// <summary>Rôles (PROMPT.md §7). L'admin plateforme n'appartient à aucune division.</summary>
public enum Role
{
    STAFF,
    MANAGER,
    OWNER,
    DIVISION_ADMIN,
    PLATFORM_ADMIN,
}

/// <summary>Permissions : la navigation et chaque contrôle lisent les permissions, jamais le nom du rôle.</summary>
public enum Permission
{
    ENTER_TIME,
    VALIDATE_TEAM,
    MANAGE_PROJECTS,
    VIEW_REPORTING,
    VIEW_DIVISION,
    ADMINISTER_DIVISION,
}

public enum DivisionStatus
{
    ACTIVE,
    ONBOARDING,
    SUSPENDED,
}

public enum AuditResult
{
    SUCCESS,
    FAILURE,
}
