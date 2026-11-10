namespace TimeSheet.Api.FunctionalTests.FunctionalTests.Admin;

using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using TimeSheet.Api.Domain.Access;
using TimeSheet.Api.Domain.Divisions;
using TimeSheet.Api.Domain.Projects;
using TimeSheet.Api.Domain.Teams;
using TimeSheet.Api.Domain.Timesheets;
using TimeSheet.Api.Domain.Users;
using TimeSheet.Api.FunctionalTests.TestUtilities;
using TimeSheet.Api.Services.Mail;
using TimeSheet.Api.Services.Security;

/// <summary>Administration de division (écran 12), Paramètres (écran 14), liens à usage unique (jalon 6).</summary>
public class AdministrationTests : TestBase
{
    private const string Password = "Mot-de-passe-2026";
    private static readonly string Hash = PasswordHasher.Hash(Password);

    private sealed record Setup(Guid DivisionId, User Ada, User Hugo, User Theo, string Tag);

    private static Task WithDb(Func<Databases.TimeSheetDbContext, Task> action) => ExecuteDbContextAsync(action);

    private static Task<T> WithDb<T>(Func<Databases.TimeSheetDbContext, Task<T>> action) => ExecuteDbContextAsync(action);

    /// <summary>Ada, admin de division ; Hugo, manager de son équipe ; Théo, staff de Hugo.</summary>
    private static async Task<Setup> NewDivision()
    {
        var tag = Guid.NewGuid().ToString("N")[..10];
        var division = Division.Create($"Division {tag}", $"adm-{tag}", "DIR", status: DivisionStatus.ACTIVE);
        User Person(string first, Role role)
        {
            var u = User.Create(division.Id, $"{first.ToLowerInvariant()}-{tag}@exemple.com", first, "Essai", role);
            u.SetPassword(Hash);
            return u;
        }
        var ada = Person("Ada", Role.DIVISION_ADMIN);
        var hugo = Person("Hugo", Role.MANAGER);
        var theo = Person("Theo", Role.STAFF);
        await WithDb(async db =>
        {
            db.Divisions.Add(division);
            db.DivisionSettings.Add(DivisionSettings.Defaults(division.Id));
            db.Users.AddRange(ada, hugo);
            await db.SaveChangesAsync();
            var team = Team.Create(division.Id, "Équipe", hugo.Id);
            db.Teams.Add(team);
            theo.AssignManager(hugo.Id);
            db.Users.Add(theo);
            await db.SaveChangesAsync();
        });
        return new Setup(division.Id, ada, hugo, theo, tag);
    }

    private static async Task SignIn(string email, string password = Password) =>
        (await FactoryClient.PostAsJsonAsync("api/v1/auth/connexion", new { email, password })).StatusCode.Should().Be(HttpStatusCode.OK);

    private static async Task<JsonElement> Body(HttpResponseMessage r) => await r.Content.ReadFromJsonAsync<JsonElement>();

    private static async Task<(string? Code, string[] Fields)> Rule(HttpResponseMessage r)
    {
        r.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
        var body = await Body(r);
        var fields = body.TryGetProperty("fields", out var f) ? f.EnumerateArray().Select(x => x.GetString()!).ToArray() : [];
        return (body.GetProperty("code").GetString(), fields);
    }

    private static string LinkIn(MailMessage mail, string path) => Regex.Match(mail.Text, $@"https?://\S+(/{path}/\S+)").Groups[1].Value;

    [Fact]
    public async Task utilisateurs_role_compte_invitation_et_premier_mot_de_passe()
    {
        var s = await NewDivision();
        await SignIn(s.Theo.Email);
        (await FactoryClient.GetAsync("api/v1/administration")).StatusCode.Should().Be(HttpStatusCode.NotFound);

        await SignIn(s.Ada.Email);
        var admin = await Body(await FactoryClient.GetAsync("api/v1/administration"));
        admin.GetProperty("divisionName").GetString().Should().Be($"Division {s.Tag}");
        admin.GetProperty("managers").EnumerateArray().Select(m => m.GetProperty("name").GetString()).Should().Equal("Hugo Essai");
        var users = await Body(await FactoryClient.GetAsync("api/v1/administration/utilisateurs"));
        users.GetProperty("rows").EnumerateArray().Select(r => r.GetProperty("name").GetString()).Should().Equal("Ada Essai", "Hugo Essai", "Theo Essai");
        users.GetProperty("rows")[0].GetProperty("isSelf").GetBoolean().Should().BeTrue();
        (await Body(await FactoryClient.GetAsync("api/v1/administration/utilisateurs?recherche=THEO"))).GetProperty("total").GetInt32().Should().Be(1);

        // Rôle et compte, sur la ligne : jamais sur son propre compte.
        (await Rule(await FactoryClient.PutAsJsonAsync($"api/v1/administration/utilisateurs/{s.Ada.Id}/role", new { role = "STAFF" }))).Code.Should().Be("self");
        var role = await Body(await FactoryClient.PutAsJsonAsync($"api/v1/administration/utilisateurs/{s.Theo.Id}/role", new { role = "MANAGER" }));
        role.GetProperty("previous").GetString().Should().Be("STAFF");
        await FactoryClient.PutAsJsonAsync($"api/v1/administration/utilisateurs/{s.Theo.Id}/role", new { role = "STAFF" });
        (await FactoryClient.PutAsJsonAsync($"api/v1/administration/utilisateurs/{s.Theo.Id}/compte", new { active = false })).StatusCode.Should().Be(HttpStatusCode.OK);
        (await FactoryClient.PostAsJsonAsync("api/v1/auth/connexion", new { email = s.Theo.Email, password = Password })).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        await SignIn(s.Ada.Email);
        await FactoryClient.PutAsJsonAsync($"api/v1/administration/utilisateurs/{s.Theo.Id}/compte", new { active = true });

        // Invitation : champs contrôlés, adresse unique, e-mail avec un lien d'une semaine.
        var email = $"nina-{s.Tag}@exemple.com";
        (await Rule(await FactoryClient.PostAsJsonAsync("api/v1/administration/utilisateurs", new { email = "x", firstName = "", lastName = "Invitée", role = "STAFF" })))
            .Fields.Should().Equal("email", "firstName");
        (await Rule(await FactoryClient.PostAsJsonAsync("api/v1/administration/utilisateurs", new { email = s.Hugo.Email, firstName = "Nina", lastName = "Invitée", role = "STAFF" })))
            .Fields.Should().Equal("emailTaken");
        var invite = new
        {
            email, firstName = "Nina", lastName = "Invitée", role = "STAFF", managerId = s.Hugo.Id,
            internship = new { kind = "PROFESSIONAL", direction = "DEC", department = "CX", service = "Parcours", start = "05/01/2026", end = "26/06/2026" },
        };
        (await FactoryClient.PostAsJsonAsync("api/v1/administration/utilisateurs", invite)).StatusCode.Should().Be(HttpStatusCode.OK);
        var mail = RecordingMailSender.To(email).Should().ContainSingle().Subject;
        mail.Subject.Should().Be($"Votre accès à TimeSheet · Division {s.Tag}");
        var row = (await Body(await FactoryClient.GetAsync("api/v1/administration/utilisateurs?recherche=Nina"))).GetProperty("rows")[0];
        row.GetProperty("invited").GetBoolean().Should().BeTrue();
        row.GetProperty("manager").GetString().Should().Be("Hugo Essai");
        row.GetProperty("internship").GetProperty("end").GetString().Should().Be("26/06/2026");

        // Nouvel envoi : l'ancien lien n'est plus valable.
        var first = LinkIn(mail, "invitation");
        var id = row.GetProperty("id").GetGuid();
        (await FactoryClient.PostAsync($"api/v1/administration/utilisateurs/{id}/invitation", null)).StatusCode.Should().Be(HttpStatusCode.OK);
        var link = LinkIn(RecordingMailSender.To(email).Last(), "invitation");
        (await FactoryClient.GetAsync($"api/v1/compte/liens{first}")).StatusCode.Should().Be(HttpStatusCode.NotFound);

        var peek = await Body(await FactoryClient.GetAsync($"api/v1/compte/liens{link}"));
        peek.GetProperty("firstName").GetString().Should().Be("Nina");
        (await Rule(await FactoryClient.PostAsJsonAsync($"api/v1/compte/liens{link}", new { next = "court1", confirm = "court1" }))).Fields.Should().Equal("passwordRules");
        (await FactoryClient.PostAsJsonAsync($"api/v1/compte/liens{link}", new { next = "Invitation-2026-ok", confirm = "Invitation-2026-ok" })).StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await Rule(await FactoryClient.PostAsJsonAsync($"api/v1/compte/liens{link}", new { next = "Invitation-2026-ok", confirm = "Invitation-2026-ok" }))).Code.Should().Be("expired");
        await SignIn(email, "Invitation-2026-ok");
        (await Body(await FactoryClient.GetAsync("api/v1/auth/moi"))).GetProperty("isIntern").GetBoolean().Should().BeTrue();

        var actions = await ExecuteDbContextAsync(db => db.AuditLog.Where(a => a.DivisionId == s.DivisionId).Select(a => a.Action).ToListAsync());
        actions.Should().Contain(["USER_ROLE_CHANGED", "USER_DEACTIVATED", "USER_ACTIVATED", "USER_INVITED", "INVITATION_ACCEPTED"]);
    }

    [Fact]
    public async Task permissions_workflow_et_regles_s_appliquent_a_la_division_seule()
    {
        var s = await NewDivision();
        var other = await NewDivision();
        await SignIn(s.Ada.Email);
        // Un utilisateur d'une autre division n'existe pas pour cet admin.
        (await Rule(await FactoryClient.PutAsJsonAsync($"api/v1/administration/utilisateurs/{other.Theo.Id}/role", new { role = "MANAGER" }))).Code.Should().Be("notFound");

        var matrix = (await Body(await FactoryClient.GetAsync("api/v1/administration"))).GetProperty("matrix").Deserialize<Dictionary<string, string[]>>()!;
        matrix["STAFF"] = [.. matrix["STAFF"], "VIEW_REPORTING"];
        matrix["DIVISION_ADMIN"] = [];
        (await FactoryClient.PutAsJsonAsync("api/v1/administration/permissions", new { matrix })).StatusCode.Should().Be(HttpStatusCode.NoContent);
        var saved = (await Body(await FactoryClient.GetAsync("api/v1/administration"))).GetProperty("matrix");
        saved.GetProperty("STAFF").EnumerateArray().Select(p => p.GetString()).Should().Equal("ENTER_TIME", "VIEW_REPORTING");
        saved.GetProperty("DIVISION_ADMIN").EnumerateArray().Select(p => p.GetString()).Should().Equal("ADMINISTER_DIVISION");

        (await Rule(await FactoryClient.PutAsJsonAsync("api/v1/administration/workflow", new { hrEmail = "rh", hrAutoSend = true, reminderAfterWorkingDays = 4, delegateToOwner = true })))
            .Fields.Should().Equal("hrEmail", "reminder");
        (await FactoryClient.PutAsJsonAsync("api/v1/administration/workflow", new { hrEmail = "RH@Exemple.cm", hrAutoSend = false, reminderAfterWorkingDays = 5, delegateToOwner = false }))
            .StatusCode.Should().Be(HttpStatusCode.NoContent);

        (await Rule(await FactoryClient.PutAsJsonAsync("api/v1/administration/regles",
            new { workingDays = Array.Empty<string>(), deadlineDay = "FRIDAY", deadlineTime = "18:00", fillAlertThreshold = "101", allowFutureWeeks = false, lockAfterValidation = true })))
            .Fields.Should().Equal("workingDays", "threshold");
        (await FactoryClient.PutAsJsonAsync("api/v1/administration/regles",
            new { workingDays = new[] { "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY" }, deadlineDay = "MONDAY", deadlineTime = "09:30", fillAlertThreshold = "70", allowFutureWeeks = true, lockAfterValidation = true }))
            .StatusCode.Should().Be(HttpStatusCode.NoContent);

        var settings = await ExecuteDbContextAsync(db => db.DivisionSettings.AsNoTracking().FirstAsync(x => x.DivisionId == s.DivisionId));
        settings.HrEmail.Should().Be("rh@exemple.cm");
        settings.WorkingDays.Should().Equal(DayOfWeek.Monday, DayOfWeek.Tuesday, DayOfWeek.Wednesday, DayOfWeek.Thursday);
        settings.DeadlineDay.Should().Be(DayOfWeek.Monday);
        settings.FillAlertThreshold.Should().Be(70);
        var untouched = await ExecuteDbContextAsync(db => db.DivisionSettings.AsNoTracking().FirstAsync(x => x.DivisionId == other.DivisionId));
        untouched.WorkingDays.Should().HaveCount(5);
        var label = await ExecuteDbContextAsync(db => db.AuditLog.Where(a => a.DivisionId == s.DivisionId && a.Action == "RULES_CHANGED").Select(a => a.ObjectLabel).SingleAsync());
        label.Should().Contain("Jours ouvrés : Lun, Mar, Mer, Jeu").And.Contain("Seuil d'alerte de remplissage : 70");

        // La permission accordée s'applique dès la requête suivante.
        await SignIn(s.Theo.Email);
        (await Body(await FactoryClient.GetAsync("api/v1/auth/moi"))).GetProperty("permissions").EnumerateArray().Select(p => p.GetString()).Should().Contain("VIEW_REPORTING");
        await SignIn(other.Theo.Email);
        (await Body(await FactoryClient.GetAsync("api/v1/auth/moi"))).GetProperty("permissions").EnumerateArray().Select(p => p.GetString()).Should().NotContain("VIEW_REPORTING");
    }

    [Fact]
    public async Task parametres_notifications_preferences_et_mot_de_passe()
    {
        var s = await NewDivision();
        await SignIn(s.Theo.Email);
        var me = await Body(await FactoryClient.GetAsync("api/v1/parametres"));
        me.GetProperty("manager").GetString().Should().Be("Hugo Essai");
        me.GetProperty("adminEmails").EnumerateArray().Select(e => e.GetString()).Should().Equal(s.Ada.Email);
        // Staff sans stage : pas de rappel de signature.
        me.GetProperty("notifications").EnumerateArray().Select(n => n.GetProperty("kind").GetString()).Should().Equal("fillReminder", "validated", "rejected");

        (await Rule(await FactoryClient.PutAsJsonAsync("api/v1/parametres/horaires", new { arrival = "8h", departure = "17:00" }))).Fields.Should().Equal("arrival");
        (await Rule(await FactoryClient.PutAsJsonAsync("api/v1/parametres/horaires", new { arrival = "17:00", departure = "08:00" }))).Code.Should().Be("order");
        (await FactoryClient.PutAsJsonAsync("api/v1/parametres/horaires", new { arrival = "08:30", departure = "17:30" })).StatusCode.Should().Be(HttpStatusCode.NoContent);

        var toggled = await Body(await FactoryClient.PutAsJsonAsync("api/v1/parametres/notifications/validated", new { enabled = false }));
        toggled.GetProperty("previous").GetBoolean().Should().BeTrue();
        (await FactoryClient.PutAsJsonAsync("api/v1/parametres/preferences", new { locale = "fr", defaultSignatureMode = "PASSWORD" })).StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await Body(await FactoryClient.GetAsync("api/v1/auth/moi"))).GetProperty("defaultSignatureMode").GetString().Should().Be("PASSWORD");

        // Fiche validée par Hugo : Théo a coupé cet e-mail, il ne part pas.
        var sheetId = await WithDb(async db =>
        {
            var project = Project.Create(s.DivisionId, $"P-{s.Tag}", "Projet", new DateOnly(2000, 1, 1), null, null, ProjectStatus.IN_PROGRESS, DateTimeOffset.UtcNow, s.Hugo.Id);
            var activity = project.AddActivity("Analyse");
            db.Projects.Add(project);
            var week = new IsoWeek(2026, 10);
            var sheet = Timesheet.Create(s.DivisionId, s.Theo.Id, week, DateTimeOffset.UtcNow);
            sheet.SaveDraft(Enumerable.Range(0, 5).ToDictionary(i => week.Monday.AddDays(i), _ => activity.Id), null, DateTimeOffset.UtcNow);
            sheet.Submit(s.Theo.Id, DateTimeOffset.UtcNow);
            db.Timesheets.Add(sheet);
            await db.SaveChangesAsync();
            return sheet.Id;
        });
        await SignIn(s.Hugo.Email);
        (await FactoryClient.PostAsJsonAsync($"api/v1/validation/{sheetId}/decision", new { decision = "VALIDATE" })).StatusCode.Should().Be(HttpStatusCode.OK);
        RecordingMailSender.To(s.Theo.Email).Should().BeEmpty();

        // Mot de passe : l'actuel est vérifié ; le changement ferme la session.
        await SignIn(s.Theo.Email);
        (await Rule(await FactoryClient.PostAsJsonAsync("api/v1/parametres/mot-de-passe", new { current = "", next = "x", confirm = "x" }))).Code.Should().Be("currentPassword");
        (await Rule(await FactoryClient.PostAsJsonAsync("api/v1/parametres/mot-de-passe", new { current = "faux", next = "Nouveau-2026-ok", confirm = "Nouveau-2026-ok" }))).Code.Should().Be("wrongPassword");
        (await Rule(await FactoryClient.PostAsJsonAsync("api/v1/parametres/mot-de-passe", new { current = Password, next = "Nouveau-2026-ok", confirm = "Autre-2026-ok" }))).Code.Should().Be("passwordConfirm");
        (await FactoryClient.PostAsJsonAsync("api/v1/parametres/mot-de-passe", new { current = Password, next = "Nouveau-2026-ok", confirm = "Nouveau-2026-ok" })).StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await FactoryClient.GetAsync("api/v1/auth/moi")).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        await SignIn(s.Theo.Email, "Nouveau-2026-ok");
    }

    [Fact]
    public async Task mot_de_passe_oublie_meme_reponse_pour_tous()
    {
        var s = await NewDivision();
        (await Rule(await FactoryClient.PostAsJsonAsync("api/v1/compte/mot-de-passe-oublie", new { email = "pas-une-adresse" }))).Fields.Should().Equal("email");
        (await FactoryClient.PostAsJsonAsync("api/v1/compte/mot-de-passe-oublie", new { email = $"inconnu-{s.Tag}@exemple.com" })).StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await FactoryClient.PostAsJsonAsync("api/v1/compte/mot-de-passe-oublie", new { email = s.Hugo.Email.ToUpperInvariant() })).StatusCode.Should().Be(HttpStatusCode.NoContent);
        // Une seule demande toutes les deux minutes.
        (await FactoryClient.PostAsJsonAsync("api/v1/compte/mot-de-passe-oublie", new { email = s.Hugo.Email })).StatusCode.Should().Be(HttpStatusCode.NoContent);
        var mail = RecordingMailSender.To(s.Hugo.Email).Should().ContainSingle().Subject;
        mail.Subject.Should().Be("Réinitialisation de votre mot de passe TimeSheet");
        var link = LinkIn(mail, "reinitialisation");
        (await FactoryClient.GetAsync($"api/v1/compte/liens/invitation{link["/reinitialisation".Length..]}")).StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await FactoryClient.PostAsJsonAsync($"api/v1/compte/liens{link}", new { next = "Chef-equipe-2026", confirm = "Chef-equipe-2026" })).StatusCode.Should().Be(HttpStatusCode.NoContent);
        await SignIn(s.Hugo.Email, "Chef-equipe-2026");
    }
}
