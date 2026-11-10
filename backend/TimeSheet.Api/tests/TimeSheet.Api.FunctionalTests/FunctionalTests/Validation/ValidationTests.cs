namespace TimeSheet.Api.FunctionalTests.FunctionalTests.Validation;

using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using TimeSheet.Api.Domain.Access;
using TimeSheet.Api.Domain.Divisions;
using TimeSheet.Api.Domain.Projects;
using TimeSheet.Api.Domain.Timesheets;
using TimeSheet.Api.Domain.Users;
using TimeSheet.Api.FunctionalTests.TestUtilities;
using TimeSheet.Api.Services.Security;

/// <summary>Validation (jalon 3) : file, portée, décisions, journées signalées, e-mails, relances.</summary>
public class ValidationTests : TestBase
{
    private const string Password = "Mot-de-passe-2026";
    private static readonly string Hash = PasswordHasher.Hash(Password);

    /// <summary>
    /// Division neuve : Marc (manager) valide Ana et Ben ; Nina (manager désactivée) a Cléo ;
    /// Olga est owner. Ana et Ben ont une semaine soumise, Cléo aussi.
    /// </summary>
    private sealed record Setup(User Manager, User Owner, User Ana, User Ben, User Cleo, Guid AnaSheet, Guid BenSheet, Guid CleoSheet, IsoWeek Week);

    private static async Task<Setup> NewDivision(DateTimeOffset? submittedAt = null)
    {
        var division = Division.Create($"Division {Guid.NewGuid():N}", $"test-{Guid.NewGuid():N}", "TEST", status: DivisionStatus.ACTIVE);
        User Person(string first, Role role)
        {
            var u = User.Create(division.Id, $"{first.ToLowerInvariant()}-{Guid.NewGuid():N}@exemple.com", first, "Essai", role);
            u.SetPassword(Hash);
            return u;
        }
        var manager = Person("Marc", Role.MANAGER);
        var inactive = Person("Nina", Role.MANAGER);
        inactive.SetActive(false);
        var owner = Person("Olga", Role.OWNER);
        var ana = Person("Ana", Role.STAFF);
        var ben = Person("Ben", Role.STAFF);
        var cleo = Person("Cléo", Role.STAFF);

        var start = new DateOnly(2000, 1, 1);
        var project = Project.Create(division.Id, "T-1", "Projet de test", start, null, null, ProjectStatus.IN_PROGRESS, DateTimeOffset.UtcNow, null);
        var activity = project.AddActivity("Analyse").Id;
        var absence = Project.Create(division.Id, "ABSENCE", "Absence", start, null, null, ProjectStatus.IN_PROGRESS, DateTimeOffset.UtcNow, null, isSystem: true);
        var off = absence.AddActivity("Absence").Id;

        var week = WeekRules.CurrentWeek(DateTimeOffset.UtcNow).Shift(-1);
        var at = submittedAt ?? DateTimeOffset.UtcNow;
        Timesheet Sheet(User user, bool withAbsence = false)
        {
            var sheet = Timesheet.Create(division.Id, user.Id, week, at.AddMinutes(-5));
            sheet.SaveDraft(Enumerable.Range(0, 5).ToDictionary(i => week.Monday.AddDays(i), i => withAbsence && i == 4 ? off : activity), null, at);
            sheet.Submit(user.Id, at);
            return sheet;
        }

        Timesheet anaSheet = null!, benSheet = null!, cleoSheet = null!;
        await WithDb(async db =>
        {
            db.Divisions.Add(division);
            db.Users.AddRange(manager, inactive, owner);
            await db.SaveChangesAsync();
            ana.AssignManager(manager.Id);
            ben.AssignManager(manager.Id);
            cleo.AssignManager(inactive.Id);
            db.Users.AddRange(ana, ben, cleo);
            db.Projects.AddRange(project, absence);
            await db.SaveChangesAsync();
            anaSheet = Sheet(ana);
            benSheet = Sheet(ben, withAbsence: true);
            cleoSheet = Sheet(cleo);
            db.Timesheets.AddRange(anaSheet, benSheet, cleoSheet);
            await db.SaveChangesAsync();
        });
        return new Setup(manager, owner, ana, ben, cleo, anaSheet.Id, benSheet.Id, cleoSheet.Id, week);
    }

    private static Task WithDb(Func<Databases.TimeSheetDbContext, Task> action) => ExecuteDbContextAsync(action);

    private static async Task SignIn(User user)
    {
        var response = await FactoryClient.PostAsJsonAsync("api/v1/auth/connexion", new { email = user.Email, password = Password });
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    private static async Task<string?> CodeOf(HttpResponseMessage response)
    {
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        return json.TryGetProperty("code", out var code) ? code.GetString() : null;
    }

    private static Task<JsonElement> Queue(string query = "periode=tout") => FactoryClient.GetFromJsonAsync<JsonElement>($"api/v1/validation?{query}");

    private static List<Guid> Ids(JsonElement queue) => queue.GetProperty("rows").EnumerateArray().Select(r => r.GetProperty("id").GetGuid()).ToList();

    [Fact]
    public async Task le_manager_voit_les_fiches_de_ses_rattaches_seulement()
    {
        var s = await NewDivision();
        await SignIn(s.Manager);
        var queue = await Queue();
        Ids(queue).Should().BeEquivalentTo([s.AnaSheet, s.BenSheet]);
        queue.GetProperty("counts").GetProperty("submitted").GetInt32().Should().Be(2);
        queue.GetProperty("people").GetArrayLength().Should().Be(2);

        // Étiquettes d'attention : Ben a une journée d'absence.
        var ben = queue.GetProperty("rows").EnumerateArray().Single(r => r.GetProperty("id").GetGuid() == s.BenSheet);
        ben.GetProperty("hasAbsence").GetBoolean().Should().BeTrue();
        ben.GetProperty("filled").GetInt32().Should().Be(5);
        ben.GetProperty("expected").GetInt32().Should().Be(5);

        // Hors de la portée : la fiche n'existe pas.
        (await FactoryClient.GetAsync($"api/v1/validation/{s.CleoSheet}")).StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await FactoryClient.GetAsync($"api/v1/validation/{s.AnaSheet}")).StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task l_owner_voit_toute_sa_division_et_le_staff_rien()
    {
        var s = await NewDivision();
        await SignIn(s.Owner);
        Ids(await Queue()).Should().BeEquivalentTo([s.AnaSheet, s.BenSheet, s.CleoSheet]);

        await SignIn(s.Ana);
        (await FactoryClient.GetAsync("api/v1/validation")).StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task validation_groupee_mails_et_fiche_deja_traitee()
    {
        var s = await NewDivision();
        await SignIn(s.Manager);
        var response = await FactoryClient.PostAsJsonAsync("api/v1/validation/decisions", new { ids = new[] { s.AnaSheet, s.BenSheet, s.CleoSheet }, decision = "VALIDATE" });
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<JsonElement>();
        result.GetProperty("done").GetInt32().Should().Be(2);
        result.GetProperty("skipped").GetInt32().Should().Be(1, "la fiche de Cléo est hors de la portée de Marc");

        RecordingMailSender.To(s.Ana.Email).Should().ContainSingle(m => m.Subject == $"Semaine {s.Week.Week} validée");
        var again = await (await FactoryClient.PostAsJsonAsync("api/v1/validation/decisions", new { ids = new[] { s.AnaSheet }, decision = "VALIDATE" })).Content.ReadFromJsonAsync<JsonElement>();
        again.GetProperty("done").GetInt32().Should().Be(0);

        var validated = await Queue("periode=tout&statut=VALIDATED");
        Ids(validated).Should().BeEquivalentTo([s.AnaSheet, s.BenSheet]);
        var audit = await ExecuteDbContextAsync(db => db.AuditLog.CountAsync(a => a.Action == "TIMESHEET_VALIDATED" && a.ActorId == s.Manager.Id));
        audit.Should().Be(2);
    }

    [Fact]
    public async Task rejet_avec_motif_et_journee_signalee()
    {
        var s = await NewDivision();
        await SignIn(s.Manager);
        var path = $"api/v1/validation/{s.AnaSheet}/decision";
        (await CodeOf(await FactoryClient.PostAsJsonAsync(path, new { decision = "REJECT", reason = "  " }))).Should().Be("reasonMissing");
        (await CodeOf(await FactoryClient.PostAsJsonAsync(path, new { decision = "VALIDATE", flagged = new[] { s.Week.Monday } }))).Should().Be("flagsNotAllowed");

        var response = await FactoryClient.PostAsJsonAsync(path, new { decision = "REJECT", reason = "Lundi : réunion annulée.", flagged = new[] { s.Week.Monday } });
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("next").GetGuid().Should().Be(s.BenSheet);
        (await CodeOf(await FactoryClient.PostAsJsonAsync(path, new { decision = "VALIDATE" }))).Should().Be("alreadyDecided");
        RecordingMailSender.To(s.Ana.Email).Should().ContainSingle(m => m.Subject == $"Semaine {s.Week.Week} rejetée : à corriger" && m.Text.Contains("Lundi : réunion annulée."));

        // Côté collaboratrice : fiche rouverte, journée signalée, motif.
        await SignIn(s.Ana);
        var week = await FactoryClient.GetFromJsonAsync<JsonElement>($"api/v1/saisie/{s.Week.Year}/{s.Week.Week}");
        week.GetProperty("status").GetString().Should().Be("REJECTED");
        week.GetProperty("editable").GetBoolean().Should().BeTrue();
        week.GetProperty("days")[0].GetProperty("flagged").GetBoolean().Should().BeTrue();
        week.GetProperty("decision").GetProperty("reason").GetString().Should().Be("Lundi : réunion annulée.");
    }

    [Fact]
    public async Task le_detail_donne_la_position_et_l_historique()
    {
        var s = await NewDivision();
        await SignIn(s.Manager);
        var review = await FactoryClient.GetFromJsonAsync<JsonElement>($"api/v1/validation/{s.BenSheet}");
        review.GetProperty("name").GetString().Should().Be("Ben Essai");
        review.GetProperty("days").GetArrayLength().Should().Be(5);
        review.GetProperty("choices").GetArrayLength().Should().Be(2);
        review.GetProperty("history").EnumerateArray().Select(e => e.GetProperty("type").GetString()).Should().Equal("SUBMITTED", "CREATED");
        var position = review.GetProperty("position");
        position.GetProperty("count").GetInt32().Should().Be(2);
        position.GetProperty("previous").GetGuid().Should().Be(s.AnaSheet);
    }

    [Fact]
    public async Task la_relance_part_une_fois_vers_le_validateur_ou_l_owner()
    {
        var s = await NewDivision(submittedAt: DateTimeOffset.UtcNow.AddDays(-10));
        (await FactoryClient.PostAsync("api/v1/taches/relances", null)).StatusCode.Should().Be(HttpStatusCode.Unauthorized);

        async Task<int> Run()
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, "api/v1/taches/relances");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", RecordingMailSender.TasksSecret);
            var response = await FactoryClient.SendAsync(request);
            response.StatusCode.Should().Be(HttpStatusCode.OK);
            return (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("relances").GetInt32();
        }

        (await Run()).Should().BeGreaterThanOrEqualTo(3);
        RecordingMailSender.To(s.Manager.Email).Should().HaveCount(2).And.Contain(m => m.Subject.StartsWith("Fiche de Ana Essai en attente depuis le "));
        // Manager de Cléo désactivé : la division délègue à l'owner.
        RecordingMailSender.To(s.Owner.Email).Should().ContainSingle(m => m.Subject.StartsWith("Fiche de Cléo Essai"));

        await Run();
        RecordingMailSender.To(s.Manager.Email).Should().HaveCount(2, "une seule relance par soumission");
        var events = await ExecuteDbContextAsync(db => db.Timesheets.Where(t => t.Id == s.AnaSheet).SelectMany(t => t.Events).CountAsync(e => e.Type == "REMINDER_SENT"));
        events.Should().Be(1);
    }

    [Fact]
    public async Task sans_manager_actif_la_fiche_part_chez_l_owner()
    {
        var s = await NewDivision();
        await SignIn(s.Cleo);
        var week = await FactoryClient.GetFromJsonAsync<JsonElement>($"api/v1/saisie/{s.Week.Year}/{s.Week.Week}");
        week.GetProperty("validator").GetString().Should().Be("Olga Essai");
    }
}
