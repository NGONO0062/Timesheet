namespace TimeSheet.Api.Databases.Seed;

using Microsoft.EntityFrameworkCore;
using TimeSheet.Api.Domain.Access;
using TimeSheet.Api.Domain.Attendance;
using TimeSheet.Api.Domain.Divisions;
using TimeSheet.Api.Domain.Projects;
using TimeSheet.Api.Domain.Timesheets;
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

        // Fiches, puis projets de la division de test : on repart de zéro (les tests en créent,
        // en archivent et changent leur statut).
        db.AttendanceSheets.RemoveRange(db.AttendanceSheets.Where(s => s.DivisionId == division.Id));
        db.Timesheets.RemoveRange(db.Timesheets.Where(t => t.DivisionId == division.Id));
        await db.SaveChangesAsync(cancellationToken);
        // Fiche de présence signée : envoyée aux RH, sans attendre (écran 06).
        (await db.DivisionSettings.FirstAsync(s => s.DivisionId == division.Id, cancellationToken)).WithHr("rh.e2e@exemple.com", autoSend: true);
        db.Projects.RemoveRange(db.Projects.Where(p => p.DivisionId == division.Id));
        await db.SaveChangesAsync(cancellationToken);

        var now = DateTimeOffset.UtcNow;
        var project = Project.Create(division.Id, "TEST-01", "Projet de test", new DateOnly(2026, 1, 1), new DateOnly(2026, 12, 31), 100, ProjectStatus.IN_PROGRESS, now, manager.Id);
        project.AddActivity("Analyse");
        project.AddActivity("Atelier");
        project.AddMember(staff.Id);
        var paused = Project.Create(division.Id, "TEST-02", "Projet en pause", new DateOnly(2026, 1, 1), null, null, ProjectStatus.ON_HOLD, now, manager.Id);
        paused.AddActivity("Rédaction");
        paused.AddMember(staff.Id);
        var done = Project.Create(division.Id, "TEST-03", "Projet terminé", new DateOnly(2026, 1, 5), new DateOnly(2026, 2, 27), 20, ProjectStatus.DONE, now, manager.Id);
        done.AddActivity("Tests utilisateurs");
        var absenceProject = Project.Create(division.Id, "ABSENCE", "Absence", new DateOnly(2026, 1, 1), null, null, ProjectStatus.IN_PROGRESS, now, null, isSystem: true);
        absenceProject.AddActivity("Absence");
        db.Projects.AddRange(project, paused, done, absenceProject);
        await db.SaveChangesAsync(cancellationToken);

        // File de Martin Valideur (écrans 07 et 08) : semaine 12 soumise par Alice, Bruno et
        // Chloé (avant l'horloge de démonstration, jeudi 19 mars), semaine 11 par David.
        var analyse = await (from a in db.Activities join p in db.Projects on a.ProjectId equals p.Id
                             where p.DivisionId == division.Id && p.Code == "TEST-01" && a.Name == "Analyse" select a.Id).FirstAsync(cancellationToken);
        var off = await (from a in db.Activities join p in db.Projects on a.ProjectId equals p.Id
                         where p.DivisionId == division.Id && p.IsSystem select a.Id).FirstAsync(cancellationToken);
        var testProject = await db.Projects.Include(p => p.Members).FirstAsync(p => p.DivisionId == division.Id && p.Code == "TEST-01", cancellationToken);
        var douala = TimeSpan.FromHours(1);
        foreach (var (first, week, submitted, absence) in new[]
                 {
                     ("Alice", 12, new DateTimeOffset(2026, 3, 18, 17, 0, 0, douala).ToUniversalTime(), false),
                     ("Bruno", 12, new DateTimeOffset(2026, 3, 18, 17, 10, 0, douala).ToUniversalTime(), true),
                     ("Chloé", 12, new DateTimeOffset(2026, 3, 18, 17, 20, 0, douala).ToUniversalTime(), false),
                     ("David", 11, new DateTimeOffset(2026, 3, 13, 16, 30, 0, douala).ToUniversalTime(), false),
                 })
        {
            var email = $"{first.ToLowerInvariant().Replace('é', 'e')}.e2e@exemple.com";
            var user = await Account(email, first, "Essai", Role.STAFF, manager.Id);
            testProject.AddMember(user.Id);
            var iso = new IsoWeek(2026, week);
            var sheet = Timesheet.Create(division.Id, user.Id, iso, submitted.AddHours(-2));
            sheet.SaveDraft(Enumerable.Range(0, 5).ToDictionary(i => iso.Monday.AddDays(i), i => absence && i == 4 ? off : analyse), null, submitted.AddHours(-2));
            sheet.Submit(user.Id, submitted);
            db.Timesheets.Add(sheet);
        }
        await db.SaveChangesAsync(cancellationToken);

        // Tableau des tâches (écran 15) : David voit le projet terminé (lecture seule) et un projet
        // à lui pour le test sur mobile, qui tourne en parallèle de celui du bureau (TEST-01).
        var david = await db.Users.FirstAsync(u => u.Email == "david.e2e@exemple.com", cancellationToken);
        (await db.Projects.Include(p => p.Members).FirstAsync(p => p.DivisionId == division.Id && p.Code == "TEST-03", cancellationToken)).AddMember(david.Id);
        var watch = Project.Create(division.Id, "TEST-04", "Veille et formation", new DateOnly(2026, 1, 1), new DateOnly(2026, 12, 31), null, ProjectStatus.IN_PROGRESS, now, manager.Id);
        var reading = watch.AddActivity("Lecture");
        watch.AddMember(david.Id);
        // Raccourcis de saisie (écran 03) : Rémi a saisi la semaine 11 (quatre jours de lecture,
        // vendredi en absence) ; la semaine 12 la reprend. Sans manager : il n'entre dans aucune
        // file ni aucun compteur des autres tests.
        var remi = await Account("reprise.e2e@exemple.com", "Rémi", "Reprise", Role.STAFF, null);
        watch.AddMember(remi.Id);
        db.Projects.Add(watch);
        var week11 = new IsoWeek(2026, 11);
        var remiSheet = Timesheet.Create(division.Id, remi.Id, week11, now);
        remiSheet.SaveDraft(Enumerable.Range(0, 5).ToDictionary(i => week11.Monday.AddDays(i), i => i == 4 ? off : reading.Id), null, now);
        db.Timesheets.Add(remiSheet);
        await db.SaveChangesAsync(cancellationToken);

        // Fiche de présence (écran 06) : Inès Stage, stagiaire de Martin (horaires 08:30 – 17:30),
        // les quatre semaines de février 2026 validées, la fiche générée le 9 mars, à signer.
        var ines = await Account("stagiaire.e2e@exemple.com", "Inès", "Stage", Role.STAFF, manager.Id);
        ines.SetUsualHours("08:30", "17:30");
        testProject.AddMember(ines.Id);
        if (!await db.Internships.AnyAsync(i => i.UserId == ines.Id, cancellationToken))
            db.Internships.Add(Internship.Create(ines.Id, InternshipKind.ACADEMIC, "DEC", "Tests", "Recette", new DateOnly(2026, 1, 5), new DateOnly(2026, 6, 26)));
        for (var week = 6; week <= 9; week++)
        {
            var iso = new IsoWeek(2026, week);
            var friday = new DateTimeOffset(iso.Monday.AddDays(4).ToDateTime(new TimeOnly(16, 0)), douala).ToUniversalTime();
            var sheet = Timesheet.Create(division.Id, ines.Id, iso, friday.AddHours(-1));
            sheet.SaveDraft(Enumerable.Range(0, 5).ToDictionary(i => iso.Monday.AddDays(i), _ => analyse), null, friday.AddHours(-1));
            sheet.Submit(ines.Id, friday);
            sheet.Validate(manager.Id, friday.AddDays(3));
            db.Timesheets.Add(sheet);
        }
        db.AttendanceSheets.Add(AttendanceSheet.Generate(division.Id, ines.Id, 2026, 2, new DateTimeOffset(2026, 3, 9, 8, 0, 0, douala).ToUniversalTime()));
        await db.SaveChangesAsync(cancellationToken);
        await AdminDivisionAsync(db, hash, cancellationToken);
        return "Division de test prête (valideur.e2e, saisie.e2e, alice/bruno/chloe/david.e2e, stagiaire.e2e) ; division d'administration de test (admin.e2e, chef.e2e, regle.e2e, cible.e2e, reglages.e2e, stage.e2e).";
    }

    public const string AdminSlug = "e2e-administration";

    /// <summary>
    /// Administration et Paramètres (jalon 6) : une seconde division, pour que le changement des
    /// règles de saisie ou des permissions ne gêne pas les autres tests, qui tournent en parallèle.
    /// Créée une fois (les tests de bout en bout repartent d'une base neuve, `--seed-fresh`).
    /// </summary>
    private static async Task AdminDivisionAsync(TimeSheetDbContext db, string hash, CancellationToken cancellationToken)
    {
        if (await db.Divisions.AnyAsync(d => d.Slug == AdminSlug, cancellationToken)) return;
        var division = Division.Create("Division d'administration de test", AdminSlug, "TEST", status: DivisionStatus.ACTIVE);
        db.Divisions.Add(division);
        db.DivisionSettings.Add(DivisionSettings.Defaults(division.Id).WithHr("rh.e2e@exemple.com", autoSend: true));
        await db.SaveChangesAsync(cancellationToken);

        User Account(string email, string first, string last, Role role)
        {
            var user = User.Create(division.Id, email, first, last, role);
            user.SetPassword(hash);
            db.Users.Add(user);
            return user;
        }
        Account("admin.e2e@exemple.com", "Adèle", "Admin", Role.DIVISION_ADMIN);
        var chef = Account("chef.e2e@exemple.com", "Hugo", "Chef", Role.MANAGER);
        await db.SaveChangesAsync(cancellationToken);
        var team = Domain.Teams.Team.Create(division.Id, "Équipe test", chef.Id);
        db.Teams.Add(team);
        // Rita : saisie de la semaine 12 (règles appliquées) ; Théo : rôle et compte changés ;
        // Sacha : écran Paramètres ; Inès : déclarée stagiaire par l'admin.
        var members = new[]
        {
            Account("regle.e2e@exemple.com", "Rita", "Règle", Role.STAFF),
            Account("cible.e2e@exemple.com", "Théo", "Cible", Role.STAFF),
            Account("reglages.e2e@exemple.com", "Sacha", "Réglages", Role.STAFF),
            Account("stage.e2e@exemple.com", "Inès", "Stage", Role.STAFF),
        };
        await db.SaveChangesAsync(cancellationToken);
        foreach (var m in members)
        {
            m.AssignManager(chef.Id);
            m.AssignTeam(team.Id);
        }
        var project = Project.Create(division.Id, "ADM-2026-01", "Projet d'administration", new DateOnly(2026, 1, 1), new DateOnly(2026, 12, 31), null, ProjectStatus.IN_PROGRESS, DateTimeOffset.UtcNow, chef.Id);
        project.AddActivity("Analyse");
        foreach (var m in members.Take(3)) project.AddMember(m.Id);
        db.Projects.Add(project);
        await db.SaveChangesAsync(cancellationToken);
    }
}
