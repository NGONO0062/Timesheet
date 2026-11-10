namespace TimeSheet.Api.FunctionalTests.FunctionalTests.Projects;

using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using TimeSheet.Api.Domain.Access;
using TimeSheet.Api.Domain.Divisions;
using TimeSheet.Api.Domain.Projects;
using TimeSheet.Api.Domain.Timesheets;
using TimeSheet.Api.Domain.Users;
using TimeSheet.Api.Services.Security;

/// <summary>Projets (jalon 4, écran 09) : portée, création, règles, statut, archivage.</summary>
public class ProjectsTests : TestBase
{
    private const string Password = "Mot-de-passe-2026";
    private static readonly string Hash = PasswordHasher.Hash(Password);

    /// <summary>
    /// Division « PR » : Marc (manager) pilote « Projet de Marc » où Ana a 2 jours soumis ;
    /// Nina (autre manager) pilote « Projet de Nina » avec son rattaché Léo ; Olga est owner.
    /// </summary>
    private sealed record Setup(User Marc, User Nina, User Olga, User Ana, User Leo, Guid MarcProject, Guid NinaProject, Guid UsedActivity);

    private static Task WithDb(Func<Databases.TimeSheetDbContext, Task> action) => ExecuteDbContextAsync(action);

    private static async Task<Setup> NewDivision()
    {
        var division = Division.Create($"Division {Guid.NewGuid():N}", $"pr-{Guid.NewGuid():N}", "DIR", "PR", status: DivisionStatus.ACTIVE);
        User Person(string first, Role role)
        {
            var u = User.Create(division.Id, $"{first.ToLowerInvariant()}-{Guid.NewGuid():N}@exemple.com", first, "Essai", role);
            u.SetPassword(Hash);
            return u;
        }
        var marc = Person("Marc", Role.MANAGER);
        var nina = Person("Nina", Role.MANAGER);
        var olga = Person("Olga", Role.OWNER);
        var ana = Person("Ana", Role.STAFF);
        var leo = Person("Léo", Role.STAFF);
        var now = DateTimeOffset.UtcNow;
        var marcProject = Project.Create(division.Id, "PR-2026-01", "Projet de Marc", new DateOnly(2026, 1, 1), null, 10, ProjectStatus.IN_PROGRESS, now, marc.Id);
        var used = marcProject.AddActivity("Analyse");
        marcProject.AddActivity("Atelier");
        var ninaProject = Project.Create(division.Id, "PR-2026-02", "Projet de Nina", new DateOnly(2026, 1, 1), null, null, ProjectStatus.IN_PROGRESS, now, nina.Id);
        ninaProject.AddActivity("Rédaction");

        await WithDb(async db =>
        {
            db.Divisions.Add(division);
            db.Users.AddRange(marc, nina, olga);
            await db.SaveChangesAsync();
            ana.AssignManager(marc.Id);
            leo.AssignManager(nina.Id);
            db.Users.AddRange(ana, leo);
            marcProject.AddMember(ana.Id);
            ninaProject.AddMember(leo.Id);
            db.Projects.AddRange(marcProject, ninaProject);
            await db.SaveChangesAsync();
            var week = WeekRules.CurrentWeek(now).Shift(-1);
            var sheet = Timesheet.Create(division.Id, ana.Id, week, now);
            sheet.SaveDraft(new Dictionary<DateOnly, Guid> { [week.Monday] = used.Id, [week.Monday.AddDays(1)] = used.Id }, null, now);
            sheet.Submit(ana.Id, now);
            db.Timesheets.Add(sheet);
            await db.SaveChangesAsync();
        });
        return new Setup(marc, nina, olga, ana, leo, marcProject.Id, ninaProject.Id, used.Id);
    }

    private static async Task SignIn(User user) =>
        (await FactoryClient.PostAsJsonAsync("api/v1/auth/connexion", new { email = user.Email, password = Password })).StatusCode.Should().Be(HttpStatusCode.OK);

    private static async Task<JsonElement> Json(HttpResponseMessage response) => await response.Content.ReadFromJsonAsync<JsonElement>();

    private static object Body(string name = "Audit réclamations", string status = "NOT_STARTED", string[]? activities = null, Guid[]? members = null, string start = "2026-04-06", string? end = "2026-06-26", int? budget = 30) =>
        new { name, start, end, status, budget, activities = activities ?? ["Analyse"], memberIds = members ?? [] };

    [Fact]
    public async Task le_manager_voit_ses_projets_avec_les_jours_consommes()
    {
        var s = await NewDivision();
        await SignIn(s.Marc);
        var list = await FactoryClient.GetFromJsonAsync<JsonElement>("api/v1/projets");
        var projects = list.GetProperty("projects").EnumerateArray().ToList();
        projects.Select(p => p.GetProperty("name").GetString()).Should().Equal("Projet de Marc");
        projects[0].GetProperty("consumed").GetInt32().Should().Be(2);
        projects[0].GetProperty("budget").GetInt32().Should().Be(10);
        list.GetProperty("team").EnumerateArray().Select(t => t.GetProperty("name").GetString()).Should().Equal("Ana Essai");

        // Le projet de Nina n'existe pas pour Marc ; l'owner voit les deux.
        (await FactoryClient.PutAsJsonAsync($"api/v1/projets/{s.NinaProject}/statut", new { status = "DONE" })).StatusCode.Should().Be(HttpStatusCode.NotFound);
        await SignIn(s.Olga);
        (await FactoryClient.GetFromJsonAsync<JsonElement>("api/v1/projets")).GetProperty("projects").GetArrayLength().Should().Be(2);
        await SignIn(s.Ana);
        (await FactoryClient.GetAsync("api/v1/projets")).StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task creation_avec_code_suivant_et_controle_des_champs()
    {
        var s = await NewDivision();
        await SignIn(s.Marc);
        var invalid = await FactoryClient.PostAsJsonAsync("api/v1/projets", Body(name: " ", activities: [], end: "2026-04-01"));
        invalid.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
        (await Json(invalid)).GetProperty("fields").EnumerateArray().Select(f => f.GetString()).Should().BeEquivalentTo(["name", "end", "activities"]);

        (await Json(await FactoryClient.PostAsJsonAsync("api/v1/projets", Body(members: [s.Leo.Id])))).GetProperty("code").GetString().Should().Be("members");

        var created = await Json(await FactoryClient.PostAsJsonAsync("api/v1/projets", Body(members: [s.Ana.Id], status: "IN_PROGRESS")));
        created.GetProperty("code").GetString().Should().Be("PR-2026-03");
        var audit = await ExecuteDbContextAsync(db => db.AuditLog.CountAsync(a => a.Action == "PROJECT_CREATED" && a.ActorId == s.Marc.Id));
        audit.Should().Be(1);
    }

    [Fact]
    public async Task une_activite_qui_porte_des_jours_ne_se_retire_pas()
    {
        var s = await NewDivision();
        await SignIn(s.Marc);
        var refused = await FactoryClient.PutAsJsonAsync($"api/v1/projets/{s.MarcProject}", Body(name: "Projet de Marc", activities: ["Atelier"], members: [s.Ana.Id], status: "IN_PROGRESS", start: "2026-01-01", end: null));
        var body = await Json(refused);
        body.GetProperty("code").GetString().Should().Be("activityInUse");
        body.GetProperty("value").GetString().Should().Be("Analyse");

        var saved = await FactoryClient.PutAsJsonAsync($"api/v1/projets/{s.MarcProject}", Body(name: "Projet de Marc v2", activities: ["Analyse", "Synthèse"], members: [], status: "IN_PROGRESS", start: "2026-01-01", end: null));
        saved.StatusCode.Should().Be(HttpStatusCode.OK);
        var project = (await FactoryClient.GetFromJsonAsync<JsonElement>("api/v1/projets")).GetProperty("projects")[0];
        project.GetProperty("name").GetString().Should().Be("Projet de Marc v2");
        project.GetProperty("activities").EnumerateArray().Select(a => a.GetString()).Should().Equal("Analyse", "Synthèse");
        project.GetProperty("memberIds").GetArrayLength().Should().Be(0);
    }

    [Fact]
    public async Task statut_immediat_avec_l_ancien_pour_annuler_puis_archivage()
    {
        var s = await NewDivision();
        await SignIn(s.Marc);
        var changed = await Json(await FactoryClient.PutAsJsonAsync($"api/v1/projets/{s.MarcProject}/statut", new { status = "ON_HOLD" }));
        changed.GetProperty("previous").GetString().Should().Be("IN_PROGRESS");
        (await FactoryClient.PutAsJsonAsync($"api/v1/projets/{s.MarcProject}/statut", new { status = "PAUSE" })).StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);

        // En pause : Ana ne peut plus y saisir.
        (await FactoryClient.PutAsJsonAsync($"api/v1/projets/{s.MarcProject}/archive", new { archived = true })).StatusCode.Should().Be(HttpStatusCode.OK);
        var project = (await FactoryClient.GetFromJsonAsync<JsonElement>("api/v1/projets")).GetProperty("projects")[0];
        project.GetProperty("status").GetString().Should().Be("ON_HOLD");
        project.GetProperty("archived").GetBoolean().Should().BeTrue();
        var actions = await ExecuteDbContextAsync(db => db.AuditLog.Where(a => a.ActorId == s.Marc.Id).Select(a => a.Action).ToListAsync());
        actions.Should().Contain(["PROJECT_STATUS_CHANGED", "PROJECT_ARCHIVED"]);
    }
}
