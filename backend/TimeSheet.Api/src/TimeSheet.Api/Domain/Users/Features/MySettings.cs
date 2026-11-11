namespace TimeSheet.Api.Domain.Users.Features;

using MediatR;
using Microsoft.EntityFrameworkCore;
using TimeSheet.Api.Databases;
using TimeSheet.Api.Domain.Access;
using TimeSheet.Api.Domain.Admin;
using TimeSheet.Api.Exceptions;
using TimeSheet.Api.Services.Access;
using TimeSheet.Api.Services.Audit;
using TimeSheet.Api.Services.Security;

public sealed record NotificationDto(string Kind, bool Enabled);

/// <summary>Écran 14 : profil, notifications utiles au rôle, langue de l'interface.</summary>
public sealed record SettingsDto(
    string Name,
    string Email,
    string Role,
    string? Division,
    string? Manager,
    IReadOnlyList<string> AdminEmails,
    IReadOnlyList<NotificationDto> Notifications,
    string Locale);

public sealed record PasswordInput(string? Current, string? Next, string? Confirm);

/// <summary>
/// Paramètres de l'utilisateur connecté (PROMPT.md §9.11, écran 14, repris de lib/data/settings.ts).
/// Chaque requête ne lit et n'écrit que la ligne de cet utilisateur : l'admin plateforme,
/// sans division, y a accès comme les autres rôles.
/// </summary>
public static class MySettings
{
    /// <summary>Mot de passe actuel : 5 échecs en 15 minutes au plus (heure réelle).</summary>
    public const int PasswordAttempts = 5;
    public static readonly TimeSpan PasswordWindow = TimeSpan.FromMinutes(15);
    private const string PasswordAction = "PASSWORD_CHANGED";

    public static readonly (NotificationKind Kind, string Key)[] Kinds =
    [
        (NotificationKind.FillReminder, "fillReminder"),
        (NotificationKind.Validated, "validated"),
        (NotificationKind.Rejected, "rejected"),
    ];

    public static NotificationKind? ParseKind(string? key) => Kinds.Where(k => k.Key == key).Select(k => (NotificationKind?)k.Kind).FirstOrDefault();

    /// <summary>Notifications utiles : rappel de saisie et décisions, pour qui saisit.</summary>
    public static bool Relevant(NotificationKind kind, Viewer viewer) => viewer.Has(Permission.ENTER_TIME);

    private static async Task<User> MeAsync(TimeSheetDbContext db, Viewer viewer, CancellationToken cancellationToken) =>
        await db.Users.FirstOrDefaultAsync(u => u.Id == viewer.UserId, cancellationToken) ?? throw new NotFoundException("Compte introuvable.");

    public sealed record Query : IRequest<SettingsDto>;

    public sealed class Handler(TimeSheetDbContext db, IViewerAccessor viewers) : IRequestHandler<Query, SettingsDto>
    {
        public async Task<SettingsDto> Handle(Query request, CancellationToken cancellationToken)
        {
            var viewer = await viewers.RequireAsync(cancellationToken);
            var user = await db.Users.AsNoTracking().Include(u => u.Division).FirstAsync(u => u.Id == viewer.UserId, cancellationToken);
            var manager = user.ManagerId is { } m ? await db.Users.AsNoTracking().Where(u => u.Id == m).Select(u => u.FirstName + " " + u.LastName).FirstOrDefaultAsync(cancellationToken) : null;
            // « Signaler une erreur » écrit aux administrateurs actifs de la division.
            var admins = user.DivisionId is { } d
                ? await db.Users.AsNoTracking().Where(u => u.DivisionId == d && u.Role == Role.DIVISION_ADMIN && u.Active).OrderBy(u => u.Email).Select(u => u.Email).ToListAsync(cancellationToken)
                : [];
            return new SettingsDto(
                user.FullName, user.Email, user.Role.ToString(), user.Division?.Name, manager,
                admins,
                Kinds.Where(k => Relevant(k.Kind, viewer)).Select(k => new NotificationDto(k.Key, user.Wants(k.Kind))).ToList(),
                user.Locale);
        }
    }

    public sealed record NotificationCommand(string? Kind, bool Enabled) : IRequest<bool>;

    /// <summary>Une notification, tout de suite ; renvoie l'ancienne valeur pour « Annuler ».</summary>
    public sealed class NotificationHandler(TimeSheetDbContext db, IViewerAccessor viewers) : IRequestHandler<NotificationCommand, bool>
    {
        public async Task<bool> Handle(NotificationCommand request, CancellationToken cancellationToken)
        {
            var viewer = await viewers.RequireAsync(cancellationToken);
            var kind = ParseKind(request.Kind) ?? throw new RuleException("kind");
            var previous = (await MeAsync(db, viewer, cancellationToken)).SetNotification(kind, request.Enabled);
            await db.SaveChangesAsync(cancellationToken);
            return previous;
        }
    }

    public sealed record PasswordCommand(PasswordInput Input) : IRequest<Unit>;

    /// <summary>
    /// Changement de mot de passe : l'actuel est vérifié, chaque échec est journalisé. Toutes les
    /// sessions du compte sont fermées, celle-ci comprise (le contrôleur retire le cookie).
    /// </summary>
    public sealed class PasswordHandler(TimeSheetDbContext db, IViewerAccessor viewers, IAuditWriter audit) : IRequestHandler<PasswordCommand, Unit>
    {
        public async Task<Unit> Handle(PasswordCommand request, CancellationToken cancellationToken)
        {
            var viewer = await viewers.RequireAsync(cancellationToken);
            var input = request.Input;
            if (string.IsNullOrEmpty(input.Current)) throw new RuleException("currentPassword", ["current"]);
            var user = await MeAsync(db, viewer, cancellationToken);
            var since = TimeProvider.System.GetUtcNow() - PasswordWindow;
            var failures = await db.AuditLog.CountAsync(a => a.Action == PasswordAction && a.Result == AuditResult.FAILURE && a.ActorId == user.Id && a.RecordedAt >= since, cancellationToken);
            if (failures >= PasswordAttempts) throw new RuleException("throttled");
            if (input.Current.Length > 200 || user.PasswordHash is null || !PasswordHasher.Verify(input.Current, user.PasswordHash))
            {
                await audit.AppendAsync(PasswordAction, user.FullName, user.Email, AuditResult.FAILURE, user.Id, user.DivisionId, new { reason = "mot-de-passe-actuel" }, cancellationToken);
                throw new RuleException(failures + 1 >= PasswordAttempts ? "throttled" : "wrongPassword", ["current"]);
            }
            if (AdminRules.CheckNewPassword(input.Next, input.Confirm) is { } problem) throw new RuleException(problem, [problem == "passwordRules" ? "next" : "confirm"]);
            if (input.Next == input.Current) throw new RuleException("samePassword", ["next"]);
            user.SetPassword(PasswordHasher.Hash(input.Next!));
            await db.SaveChangesAsync(cancellationToken);
            await audit.AppendAsync(PasswordAction, user.FullName, user.Email, AuditResult.SUCCESS, user.Id, user.DivisionId, cancellationToken: cancellationToken);
            return Unit.Value;
        }
    }
}
