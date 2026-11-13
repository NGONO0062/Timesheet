namespace TimeSheet.Api.Services.Access;

using TimeSheet.Api.Domain.Access;
using TimeSheet.Api.Exceptions;

/// <summary>Portée d'une requête : la division de l'utilisateur connecté, jamais une autre.</summary>
public sealed record DivisionScope(Guid DivisionId, Guid UserId, Role Role, IReadOnlySet<Permission> Permissions);

/// <summary>
/// Utilisateur connecté, relu en base à chaque requête : un compte désactivé, une division
/// suspendue ou un mot de passe changé depuis l'ouverture de la session n'en produisent plus.
/// </summary>
public sealed record Viewer(
    Guid UserId,
    string FirstName,
    string LastName,
    string Email,
    Role Role,
    Guid? DivisionId,
    string? DivisionName,
    IReadOnlySet<Permission> Permissions)
{
    public string FullName => $"{FirstName} {LastName}";

    public bool Has(Permission permission) => Permissions.Contains(permission);

    /// <summary>Sans la permission, la ressource n'existe pas pour l'utilisateur (404, comme une page absente).</summary>
    public Viewer Require(Permission permission) => Has(permission) ? this : throw new NotFoundException("Ressource introuvable.");

    public Viewer RequirePlatformAdmin() => Role == Role.PLATFORM_ADMIN ? this : throw new NotFoundException("Ressource introuvable.");

    /// <summary>Contexte d'accès aux données de la division de l'utilisateur.</summary>
    public DivisionScope Scope => DivisionId is { } id ? new DivisionScope(id, UserId, Role, Permissions) : throw new NotFoundException("Ressource introuvable.");
}
