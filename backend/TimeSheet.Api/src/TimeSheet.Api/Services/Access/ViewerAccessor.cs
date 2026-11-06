namespace TimeSheet.Api.Services.Access;

using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using TimeSheet.Api.Databases;
using TimeSheet.Api.Domain.Access;
using TimeSheet.Api.Exceptions;

public interface IViewerAccessor : ITimeSheetApiScopedService
{
    /// <summary>Utilisateur connecté, ou null (pas de session, compte bloqué, session périmée).</summary>
    Task<Viewer?> FindAsync(ClaimsPrincipal? principal, CancellationToken cancellationToken = default);

    /// <summary>Utilisateur de la requête en cours ; sans lui, 401.</summary>
    Task<Viewer> RequireAsync(CancellationToken cancellationToken = default);
}

public sealed class ViewerAccessor(TimeSheetDbContext db, IHttpContextAccessor http) : IViewerAccessor
{
    /// <summary>Numéro de session porté par le cookie (claim « sv »).</summary>
    public const string SessionVersionClaim = "sv";

    private Viewer? _cached;
    private bool _loaded;

    public async Task<Viewer?> FindAsync(ClaimsPrincipal? principal, CancellationToken cancellationToken = default)
    {
        var id = principal?.FindFirstValue(ClaimTypes.NameIdentifier);
        var version = principal?.FindFirstValue(SessionVersionClaim);
        if (!Guid.TryParse(id, out var userId) || !int.TryParse(version, out var sessionVersion)) return null;

        var user = await db.Users.AsNoTracking()
            .Include(u => u.Division!).ThenInclude(d => d.Permissions)
            .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);
        if (user is null || !user.CanSignIn || user.SessionVersion != sessionVersion) return null;
        if (user.Role != Role.PLATFORM_ADMIN && user.DivisionId is null) return null;

        var permissions = PermissionRules.Effective(user.Role, user.Division?.Overrides);
        // Stage (fiche de présence RH) : repris au jalon 5.
        return new Viewer(user.Id, user.FirstName, user.LastName, user.Email, user.Role, user.DivisionId, user.Division?.Name, permissions, IsIntern: false);
    }

    public async Task<Viewer> RequireAsync(CancellationToken cancellationToken = default)
    {
        if (!_loaded)
        {
            _cached = await FindAsync(http.HttpContext?.User, cancellationToken);
            _loaded = true;
        }
        return _cached ?? throw new ForbiddenAccessException();
    }
}
