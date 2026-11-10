namespace TimeSheet.Api.Domain.Users.Features;

using MediatR;
using Microsoft.EntityFrameworkCore;
using TimeSheet.Api.Databases;
using TimeSheet.Api.Domain.Access;
using TimeSheet.Api.Domain.Admin;
using TimeSheet.Api.Exceptions;
using TimeSheet.Api.Services;
using TimeSheet.Api.Services.Audit;
using TimeSheet.Api.Services.Mail;
using TimeSheet.Api.Services.Security;

/// <summary>
/// Liens à usage unique (PROMPT.md §19, repris de lib/data/tokens.ts). Heure réelle, jamais
/// l'horloge de démonstration : la durée de vie d'un lien est une fenêtre de sécurité.
/// </summary>
public interface IPasswordLinks : ITimeSheetApiScopedService
{
    /// <summary>Nouveau lien ; les liens encore valides du même type pour ce compte sont annulés. Renvoie le jeton en clair.</summary>
    Task<string> IssueAsync(Guid userId, TokenKind kind, CancellationToken cancellationToken);

    Task<PasswordToken?> FindAsync(string? token, TokenKind kind, CancellationToken cancellationToken);
}

public sealed class PasswordLinks(TimeSheetDbContext db) : IPasswordLinks
{
    public async Task<string> IssueAsync(Guid userId, TokenKind kind, CancellationToken cancellationToken)
    {
        var now = TimeProvider.System.GetUtcNow();
        foreach (var old in await db.PasswordTokens.Where(t => t.UserId == userId && t.Kind == kind && t.UsedAt == null).ToListAsync(cancellationToken)) old.Use(now);
        var (token, plain) = PasswordToken.Issue(userId, kind, now);
        db.PasswordTokens.Add(token);
        await db.SaveChangesAsync(cancellationToken);
        return plain;
    }

    public async Task<PasswordToken?> FindAsync(string? token, TokenKind kind, CancellationToken cancellationToken)
    {
        if (!PasswordToken.LooksValid(token)) return null;
        var hash = PasswordToken.Digest(token!);
        var row = await db.PasswordTokens.FirstOrDefaultAsync(t => t.TokenHash == hash, cancellationToken);
        return row is not null && row.IsUsable(kind, TimeProvider.System.GetUtcNow()) ? row : null;
    }
}

/// <summary>Invitation (écran 12) : compte sans mot de passe, lien d'une semaine pour le choisir.</summary>
public interface IInvitations : ITimeSheetApiScopedService
{
    Task SendAsync(User user, string inviter, CancellationToken cancellationToken);
}

public sealed class Invitations(TimeSheetDbContext db, IPasswordLinks links, IMailSender mail, IConfiguration configuration) : IInvitations
{
    public async Task SendAsync(User user, string inviter, CancellationToken cancellationToken)
    {
        var division = await db.Divisions.AsNoTracking().Where(d => d.Id == user.DivisionId).Select(d => d.Name).FirstAsync(cancellationToken);
        var token = await links.IssueAsync(user.Id, TokenKind.INVITATION, cancellationToken);
        await mail.SendAsync(MailTemplates.Invitation(user.Email, user.FirstName, division, inviter, Accounts.AppUrl(configuration, $"/invitation/{token}")), cancellationToken);
    }
}

public sealed record LinkAccount(string FirstName, string Email);

/// <summary>Pages publiques : mot de passe oublié, choix du mot de passe depuis un lien.</summary>
public static class Accounts
{
    /// <summary>Une demande de réinitialisation toutes les deux minutes au plus, par compte.</summary>
    public static readonly TimeSpan ResetInterval = TimeSpan.FromMinutes(2);

    internal static string AppUrl(IConfiguration configuration, string path) => $"{(configuration["APP_URL"] ?? "http://localhost:5173").TrimEnd('/')}{path}";

    public static TokenKind? ParseKind(string? kind) => kind switch
    {
        "invitation" => TokenKind.INVITATION,
        "reinitialisation" => TokenKind.RESET,
        _ => null,
    };

    public sealed record ResetCommand(string? Email) : IRequest<Unit>;

    /// <summary>Même réponse que le compte existe ou non ; l'e-mail ne part que pour un compte actif qui a un mot de passe.</summary>
    public sealed class ResetHandler(TimeSheetDbContext db, IPasswordLinks links, IMailSender mail, IConfiguration configuration) : IRequestHandler<ResetCommand, Unit>
    {
        public async Task<Unit> Handle(ResetCommand request, CancellationToken cancellationToken)
        {
            if (!AdminRules.IsEmail(request.Email)) throw new RuleException("invalid", ["email"]);
            var email = User.NormalizeEmail(request.Email!);
            var user = await db.Users.Include(u => u.Division).FirstOrDefaultAsync(u => u.Email == email, cancellationToken);
            if (user is null || !user.CanSignIn || user.PasswordHash is null) return Unit.Value;
            var since = TimeProvider.System.GetUtcNow() - ResetInterval;
            if (await db.PasswordTokens.AnyAsync(t => t.UserId == user.Id && t.Kind == TokenKind.RESET && t.CreatedAt > since, cancellationToken)) return Unit.Value;
            var token = await links.IssueAsync(user.Id, TokenKind.RESET, cancellationToken);
            await mail.SendAsync(MailTemplates.Reset(user.Email, user.FirstName, AppUrl(configuration, $"/reinitialisation/{token}")), cancellationToken);
            return Unit.Value;
        }
    }

    public sealed record PeekQuery(TokenKind Kind, string Token) : IRequest<LinkAccount>;

    /// <summary>Compte du lien, s'il est encore valable ; sinon 404 (« Ce lien n'est plus valable »).</summary>
    public sealed class PeekHandler(TimeSheetDbContext db, IPasswordLinks links) : IRequestHandler<PeekQuery, LinkAccount>
    {
        public async Task<LinkAccount> Handle(PeekQuery request, CancellationToken cancellationToken)
        {
            var row = await links.FindAsync(request.Token, request.Kind, cancellationToken) ?? throw new NotFoundException("Lien expiré.");
            var user = await db.Users.AsNoTracking().Include(u => u.Division).FirstAsync(u => u.Id == row.UserId, cancellationToken);
            if (!user.Active) throw new NotFoundException("Lien expiré.");
            return new LinkAccount(user.FirstName, user.Email);
        }
    }

    public sealed record SetPasswordCommand(TokenKind Kind, string Token, string? Next, string? Confirm) : IRequest<Unit>;

    /// <summary>Choix du mot de passe : le lien est consommé ; toute session ouverte avec l'ancien mot de passe est fermée.</summary>
    public sealed class SetPasswordHandler(TimeSheetDbContext db, IPasswordLinks links, IAuditWriter audit) : IRequestHandler<SetPasswordCommand, Unit>
    {
        public async Task<Unit> Handle(SetPasswordCommand request, CancellationToken cancellationToken)
        {
            if (AdminRules.CheckNewPassword(request.Next, request.Confirm) is { } problem) throw new RuleException("invalid", [problem]);
            var row = await links.FindAsync(request.Token, request.Kind, cancellationToken) ?? throw new RuleException("expired");
            var user = await db.Users.FirstAsync(u => u.Id == row.UserId, cancellationToken);
            if (!user.Active) throw new RuleException("expired");
            // Deux envois simultanés du même lien : un seul le consomme.
            var now = TimeProvider.System.GetUtcNow();
            var consumed = await db.PasswordTokens.Where(t => t.Id == row.Id && t.UsedAt == null).ExecuteUpdateAsync(s => s.SetProperty(t => t.UsedAt, now), cancellationToken);
            if (consumed == 0) throw new RuleException("expired");
            user.SetPassword(PasswordHasher.Hash(request.Next!));
            await db.SaveChangesAsync(cancellationToken);
            await audit.AppendAsync(request.Kind == TokenKind.INVITATION ? "INVITATION_ACCEPTED" : "PASSWORD_RESET", user.FullName, user.Email, AuditResult.SUCCESS, user.Id, user.DivisionId,
                cancellationToken: cancellationToken);
            return Unit.Value;
        }
    }
}
