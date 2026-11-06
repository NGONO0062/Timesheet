namespace TimeSheet.Api.Domain.Access.Features;

using System.Net.Mail;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TimeSheet.Api.Databases;
using TimeSheet.Api.Domain.Users;
using TimeSheet.Api.Services.Audit;
using TimeSheet.Api.Services.Security;

/// <summary>
/// Connexion par e-mail et mot de passe (PROMPT.md §3, §16), reprise de auth.ts.
/// Limitation sur 15 minutes : 5 échecs pour une adresse depuis un même poste, 20 au total.
/// Un tiers ne peut donc pas bloquer le compte d'un collègue depuis son propre poste en 5 essais.
/// L'écran ne dit jamais lequel des deux champs est faux ; la raison reste au journal.
/// </summary>
public static class SignIn
{
    public const int MaxFailuresPerIp = 5;
    public const int MaxFailuresTotal = 20;
    public static readonly TimeSpan Window = TimeSpan.FromMinutes(15);

    public enum Outcome { Success, InvalidCredentials, TooManyAttempts }

    public sealed record Result(Outcome Outcome, Guid UserId = default, int SessionVersion = 0);

    public sealed record Command(string Email, string Password, string Ip) : IRequest<Result>;

    /// <summary>Profil de démonstration : sans mot de passe, seulement si DemoProfiles.Allowed.</summary>
    public sealed record DemoCommand(string Email) : IRequest<Result>;

    public sealed class Handler(TimeSheetDbContext db, IAuditWriter audit) : IRequestHandler<Command, Result>, IRequestHandler<DemoCommand, Result>
    {
        public async Task<Result> Handle(Command request, CancellationToken cancellationToken)
        {
            var email = User.NormalizeEmail(request.Email ?? "");
            var password = request.Password ?? "";
            if (!IsEmail(email) || password.Length is 0 or > 256) return new Result(Outcome.InvalidCredentials);

            // Fenêtre de sécurité en heure réelle (et non l'horloge de démonstration).
            var since = TimeProvider.System.GetUtcNow() - Window;
            var failures = db.AuditLog.Where(a => a.Action == "LOGIN_FAILURE" && a.ObjectLabel == email && a.RecordedAt >= since);
            var fromHere = await failures.CountAsync(a => EF.Functions.JsonContains(a.Metadata, $"{{\"ip\":\"{Escape(request.Ip)}\"}}"), cancellationToken);
            var total = await failures.CountAsync(cancellationToken);
            if (fromHere >= MaxFailuresPerIp || total >= MaxFailuresTotal)
            {
                await audit.AppendAsync("LOGIN_FAILURE", email, email, AuditResult.FAILURE, metadata: new { reason = "tentatives", ip = request.Ip }, cancellationToken: cancellationToken);
                return new Result(Outcome.TooManyAttempts);
            }

            var user = await db.Users.Include(u => u.Division).FirstOrDefaultAsync(u => u.Email == email, cancellationToken);
            if (user?.PasswordHash is null)
            {
                PasswordHasher.VerifyAgainstDummy(password);
                return await Fail(email, request.Ip, "compte-inconnu", null, null, cancellationToken);
            }
            if (!PasswordHasher.Verify(password, user.PasswordHash)) return await Fail(email, request.Ip, "mot-de-passe", user.Id, user.DivisionId, cancellationToken);
            if (!user.CanSignIn) return await Fail(email, request.Ip, "compte-inactif", user.Id, user.DivisionId, cancellationToken);

            await audit.AppendAsync("LOGIN_SUCCESS", user.FullName, email, AuditResult.SUCCESS, user.Id, user.DivisionId, cancellationToken: cancellationToken);
            return new Result(Outcome.Success, user.Id, user.SessionVersion);
        }

        public async Task<Result> Handle(DemoCommand request, CancellationToken cancellationToken)
        {
            var email = User.NormalizeEmail(request.Email ?? "");
            if (!DemoProfiles.Accounts.Any(a => a.Email == email)) return new Result(Outcome.InvalidCredentials);
            var user = await db.Users.Include(u => u.Division).FirstOrDefaultAsync(u => u.Email == email, cancellationToken);
            if (user is null || !user.CanSignIn) return new Result(Outcome.InvalidCredentials);
            await audit.AppendAsync("LOGIN_SUCCESS", user.FullName, email, AuditResult.SUCCESS, user.Id, user.DivisionId, new { mode = "profil-de-demonstration" }, cancellationToken);
            return new Result(Outcome.Success, user.Id, user.SessionVersion);
        }

        private async Task<Result> Fail(string email, string ip, string reason, Guid? userId, Guid? divisionId, CancellationToken cancellationToken)
        {
            await audit.AppendAsync("LOGIN_FAILURE", email, email, AuditResult.FAILURE, userId, divisionId, new { reason, ip }, cancellationToken);
            return new Result(Outcome.InvalidCredentials);
        }

        private static bool IsEmail(string email) => email.Length <= 254 && MailAddress.TryCreate(email, out var parsed) && parsed.Address == email;

        private static string Escape(string value) => value.Replace("\\", "\\\\").Replace("\"", "\\\"");
    }
}
