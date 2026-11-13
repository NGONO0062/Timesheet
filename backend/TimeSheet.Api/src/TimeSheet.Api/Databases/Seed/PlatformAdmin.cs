namespace TimeSheet.Api.Databases.Seed;

using Microsoft.EntityFrameworkCore;
using TimeSheet.Api.Domain.Access;
using TimeSheet.Api.Domain.Admin;
using TimeSheet.Api.Domain.Users;
using TimeSheet.Api.Domain.Users.Features;
using TimeSheet.Api.Services.Audit;

/// <summary>
/// Première mise en service (docs/exploitation.md, repris de prisma/creer-admin-plateforme.ts) :
/// crée le compte de l'admin plateforme, sans mot de passe, et renvoie un lien d'invitation à
/// usage unique (7 jours) pour le choisir. Aucun écran ne crée ce compte.
///
///   dotnet TimeSheet.Api.dll --admin-plateforme prenom.nom@orange.cm "Prénom" "Nom"
/// </summary>
public static class PlatformAdmin
{
    public static async Task<string> CreateAsync(TimeSheetDbContext db, IPasswordLinks links, IAuditWriter audit, string appUrl, string? email, string? firstName, string? lastName, CancellationToken cancellationToken = default)
    {
        if (!AdminRules.IsEmail(email) || string.IsNullOrWhiteSpace(firstName) || string.IsNullOrWhiteSpace(lastName))
            throw new InvalidOperationException("Usage : --admin-plateforme adresse@domaine \"Prénom\" \"Nom\"");
        var address = User.NormalizeEmail(email!);
        if (await db.Users.AnyAsync(u => u.Email == address, cancellationToken)) throw new InvalidOperationException($"Un compte existe déjà avec l'adresse {address}.");
        var user = User.Create(null, address, firstName!, lastName!, Role.PLATFORM_ADMIN);
        db.Users.Add(user);
        await db.SaveChangesAsync(cancellationToken);
        var token = await links.IssueAsync(user.Id, TokenKind.INVITATION, cancellationToken);
        await audit.AppendAsync("USER_INVITED", "Mise en service", $"{user.FullName} · {address}", AuditResult.SUCCESS, metadata: new { role = "PLATFORM_ADMIN" }, cancellationToken: cancellationToken);
        return $"Admin plateforme créé : {user.FullName} <{address}>.\nLien pour choisir le mot de passe (7 jours, usage unique) : {appUrl.TrimEnd('/')}/invitation/{token}";
    }
}
