namespace TimeSheet.Api.Databases.Seed;

using Microsoft.EntityFrameworkCore;
using TimeSheet.Api.Domain.Access;
using TimeSheet.Api.Domain.Divisions;
using TimeSheet.Api.Domain.Projects;
using TimeSheet.Api.Domain.Users;
using TimeSheet.Api.Services.Security;

/// <summary>
/// Données des tests de bout en bout qui écrivent (reprises de prisma/e2e-fixtures.ts) :
/// « Division de test », comptes *.e2e@exemple.com. Remise à zéro avant chaque exécution
/// (fiches supprimées, mots de passe et sessions réinitialisés). CX Expertise n'est jamais
/// modifiée par les tests. La division reste (le journal d'audit la référence).
/// </summary>
public static class E2eSeed
{
    public const string Slug = "division-de-test";

    public static async Task<string> RunAsync(TimeSheetDbContext db, string password, CancellationToken cancellationToken = default)
    {
        var division = await db.Divisions.FirstOrDefaultAsync(d => d.Slug == Slug, cancellationToken);
        if (division is null)
        {
            division = Division.Create("Division de test", Slug, "TEST", "Tests", "Tests", DivisionStatus.ACTIVE);
            db.Divisions.Add(division);
            db.DivisionSettings.Add(DivisionSettings.Defaults(division.Id));
            await db.SaveChangesAsync(cancellationToken);
        }

        var hash = PasswordHasher.Hash(password);
        async Task<User> Account(string email, string first, string last, Role role, Guid? managerId)
        {
            var user = await db.Users.FirstOrDefaultAsync(u => u.Email == email, cancellationToken);
            if (user is null)
            {
                user = User.Create(division.Id, email, first, last, role);
                db.Users.Add(user);
            }
            user.SetPassword(hash);
            user.SetActive(true);
            user.AssignManager(managerId);
            await db.SaveChangesAsync(cancellationToken);
            return user;
        }

        var manager = await Account("valideur.e2e@exemple.com", "Martin", "Valideur", Role.MANAGER, null);
        var staff = await Account("saisie.e2e@exemple.com", "Sara", "Saisie", Role.STAFF, manager.Id);

        if (!await db.Projects.AnyAsync(p => p.DivisionId == division.Id, cancellationToken))
        {
            var now = DateTimeOffset.UtcNow;
            var project = Project.Create(division.Id, "TEST-01", "Projet de test", new DateOnly(2026, 1, 1), new DateOnly(2026, 12, 31), 100, ProjectStatus.IN_PROGRESS, now, manager.Id);
            project.AddActivity("Analyse");
            project.AddActivity("Atelier");
            project.AddMember(staff.Id);
            var paused = Project.Create(division.Id, "TEST-02", "Projet en pause", new DateOnly(2026, 1, 1), null, null, ProjectStatus.ON_HOLD, now, manager.Id);
            paused.AddActivity("Rédaction");
            paused.AddMember(staff.Id);
            var absence = Project.Create(division.Id, "ABSENCE", "Absence", new DateOnly(2026, 1, 1), null, null, ProjectStatus.IN_PROGRESS, now, null, isSystem: true);
            absence.AddActivity("Absence");
            db.Projects.AddRange(project, paused, absence);
        }

        // Fiches de la division de test : on repart de zéro.
        db.Timesheets.RemoveRange(db.Timesheets.Where(t => t.DivisionId == division.Id));
        await db.SaveChangesAsync(cancellationToken);
        return "Division de test prête (valideur.e2e, saisie.e2e).";
    }
}
