namespace TimeSheet.Api.FunctionalTests.FunctionalTests.Entry;

using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using TimeSheet.Api.Domain.Access;
using TimeSheet.Api.Domain.Divisions;
using TimeSheet.Api.Domain.Projects;
using TimeSheet.Api.Domain.Timesheets;
using TimeSheet.Api.Domain.Users;
using TimeSheet.Api.Services.Security;

/// <summary>Saisie par jour (jalon 2) : lecture, brouillon, soumission, règles refusées.</summary>
public class EntryTests : TestBase
{
    private const string Password = "Mot-de-passe-2026";
    private static readonly string Hash = PasswordHasher.Hash(Password);

    private sealed record Setup(User Staff, Guid Open, Guid Closed, IsoWeek Current);

    /// <summary>Division neuve : un manager, un staff membre d'un projet en cours et d'un projet en pause.</summary>
    private static async Task<Setup> NewDivision(bool withManager = true)
    {
        var division = Division.Create($"Division {Guid.NewGuid():N}", $"test-{Guid.NewGuid():N}", "TEST", status: DivisionStatus.ACTIVE);
        var manager = User.Create(division.Id, $"m-{Guid.NewGuid():N}@exemple.com", "Marc", "Manager", Role.MANAGER);
        var staff = User.Create(division.Id, $"s-{Guid.NewGuid():N}@exemple.com", "Sara", "Staff", Role.STAFF);
        staff.SetPassword(Hash);
        var start = new DateOnly(2000, 1, 1);
        var open = Project.Create(division.Id, "T-1", "Projet ouvert", start, null, null, ProjectStatus.IN_PROGRESS, DateTimeOffset.UtcNow, null);
        var openActivity = open.AddActivity("Analyse");
        open.AddMember(staff.Id);
        var paused = Project.Create(division.Id, "T-2", "Projet en pause", start, null, null, ProjectStatus.ON_HOLD, DateTimeOffset.UtcNow, null);
        var closedActivity = paused.AddActivity("Atelier");
        paused.AddMember(staff.Id);
        await WithDb(async db =>
        {
            db.Divisions.Add(division);
            db.Users.Add(manager);
            await db.SaveChangesAsync();
            if (withManager) staff.AssignManager(manager.Id);
            db.Users.Add(staff);
            db.Projects.AddRange(open, paused);
            await db.SaveChangesAsync();
        });
        var login = await FactoryClient.PostAsJsonAsync("api/v1/auth/connexion", new { email = staff.Email, password = Password });
        login.StatusCode.Should().Be(HttpStatusCode.OK);
        return new Setup(staff, openActivity.Id, closedActivity.Id, WeekRules.CurrentWeek(DateTimeOffset.UtcNow));
    }

    private static Task WithDb(Func<Databases.TimeSheetDbContext, Task> action) => ExecuteDbContextAsync(action);

    private static string Path(IsoWeek w, string suffix = "") => $"api/v1/saisie/{w.Year}/{w.Week}{suffix}";

    private static object Days(IsoWeek w, Guid key, int count) => new { days = Enumerable.Range(0, count).Select(i => new { date = w.Monday.AddDays(i), key }).ToArray() };

    private static async Task<string?> CodeOf(HttpResponseMessage response)
    {
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        return json.TryGetProperty("code", out var code) ? code.GetString() : null;
    }

    [Fact]
    public async Task la_semaine_propose_les_projets_ouverts_seulement()
    {
        var s = await NewDivision();
        var week = await FactoryClient.GetFromJsonAsync<JsonElement>(Path(s.Current));
        var keys = week.GetProperty("choices").EnumerateArray().Select(c => c.GetProperty("key").GetGuid()).ToList();
        keys.Should().Contain(s.Open).And.NotContain(s.Closed);
        week.GetProperty("days").GetArrayLength().Should().Be(5);
        week.GetProperty("editable").GetBoolean().Should().BeTrue();
    }

    [Fact]
    public async Task brouillon_puis_soumission_d_une_semaine_complete()
    {
        var s = await NewDivision();
        var week = s.Current.Shift(-1);
        (await FactoryClient.PutAsJsonAsync(Path(week), Days(week, s.Open, 2))).StatusCode.Should().Be(HttpStatusCode.OK);

        var incomplete = await FactoryClient.PostAsJsonAsync(Path(week, "/soumission"), Days(week, s.Open, 4));
        incomplete.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
        (await CodeOf(incomplete)).Should().Be("incomplete");

        var submitted = await FactoryClient.PostAsJsonAsync(Path(week, "/soumission"), Days(week, s.Open, 5));
        submitted.StatusCode.Should().Be(HttpStatusCode.OK);
        var after = await FactoryClient.GetFromJsonAsync<JsonElement>(Path(week));
        after.GetProperty("status").GetString().Should().Be("SUBMITTED");
        after.GetProperty("editable").GetBoolean().Should().BeFalse();

        // Soumise : plus modifiable.
        var locked = await FactoryClient.PutAsJsonAsync(Path(week), Days(week, s.Open, 5));
        (await CodeOf(locked)).Should().Be("notEditable");
    }

    [Fact]
    public async Task un_projet_qui_n_est_pas_en_cours_est_refuse()
    {
        var s = await NewDivision();
        var response = await FactoryClient.PutAsJsonAsync(Path(s.Current), Days(s.Current, s.Closed, 1));
        (await CodeOf(response)).Should().Be("invalidChoice");
    }

    [Fact]
    public async Task la_semaine_suivante_est_fermee_par_defaut()
    {
        var s = await NewDivision();
        var next = s.Current.Shift(1);
        (await CodeOf(await FactoryClient.PutAsJsonAsync(Path(next), Days(next, s.Open, 1)))).Should().Be("futureWeek");
    }

    [Fact]
    public async Task sans_validateur_la_soumission_est_refusee()
    {
        var s = await NewDivision(withManager: false);
        var week = s.Current.Shift(-1);
        (await CodeOf(await FactoryClient.PostAsJsonAsync(Path(week, "/soumission"), Days(week, s.Open, 5)))).Should().Be("noValidator");
    }

    [Fact]
    public async Task le_tableau_de_bord_liste_la_semaine_manquante()
    {
        var s = await NewDivision();
        // Une fiche validée il y a trois semaines fixe l'arrivée ; les deux semaines suivantes manquent.
        var old = s.Current.Shift(-3);
        await WithDb(async db =>
        {
            var sheet = Timesheet.Create(db.Users.Single(u => u.Id == s.Staff.Id).DivisionId!.Value, s.Staff.Id, old, DateTimeOffset.UtcNow);
            sheet.SaveDraft(Enumerable.Range(0, 5).ToDictionary(i => old.Monday.AddDays(i), _ => s.Open), null, DateTimeOffset.UtcNow);
            db.Timesheets.Add(sheet);
            await db.SaveChangesAsync();
        });
        var dashboard = await FactoryClient.GetFromJsonAsync<JsonElement>("api/v1/tableau-de-bord");
        var todo = dashboard.GetProperty("todo").EnumerateArray().Select(t => t.GetProperty("week").GetProperty("week").GetInt32()).ToList();
        todo.Should().Contain(s.Current.Shift(-1).Week).And.Contain(s.Current.Shift(-2).Week);
        dashboard.GetProperty("current").GetProperty("week").GetProperty("week").GetInt32().Should().Be(s.Current.Week);
    }

    [Fact]
    public async Task une_semaine_en_cours_rejetee_est_a_faire_avec_sa_journee_signalee()
    {
        var s = await NewDivision();
        var now = DateTimeOffset.UtcNow;
        await WithDb(async db =>
        {
            var sheet = Timesheet.Create(db.Users.Single(u => u.Id == s.Staff.Id).DivisionId!.Value, s.Staff.Id, s.Current, now.AddMinutes(-10));
            sheet.SaveDraft(Enumerable.Range(0, 5).ToDictionary(i => s.Current.Monday.AddDays(i), _ => s.Open), null, now.AddMinutes(-10));
            sheet.Submit(s.Staff.Id, now.AddMinutes(-5));
            sheet.Reject(db.Users.Single(u => u.Id == s.Staff.Id).ManagerId!.Value, now, "Lundi à revoir.", [s.Current.Monday]);
            db.Timesheets.Add(sheet);
            await db.SaveChangesAsync();
        });
        var dashboard = await FactoryClient.GetFromJsonAsync<JsonElement>("api/v1/tableau-de-bord");
        var todo = dashboard.GetProperty("todo").EnumerateArray().First();
        todo.GetProperty("kind").GetString().Should().Be("rejected");
        todo.GetProperty("week").GetProperty("week").GetInt32().Should().Be(s.Current.Week);
        dashboard.GetProperty("current").GetProperty("days")[0].GetProperty("flagged").GetBoolean().Should().BeTrue();
    }

    [Fact]
    public async Task la_semaine_propose_de_reprendre_la_derniere_semaine_saisie()
    {
        var s = await NewDivision();
        // Rien de saisi avant : rien à reprendre.
        (await FactoryClient.GetFromJsonAsync<JsonElement>(Path(s.Current))).GetProperty("copyFrom").ValueKind.Should().Be(JsonValueKind.Null);

        // Il y a deux semaines : lundi à mercredi sur le projet ouvert, jeudi sur le projet en
        // pause, vendredi en absence. La semaine dernière : rien.
        var source = s.Current.Shift(-2);
        var absence = Guid.Empty;
        await WithDb(async db =>
        {
            var off = Project.Create(s.Staff.DivisionId!.Value, "ABSENCE", "Absence", new DateOnly(2000, 1, 1), null, null, ProjectStatus.IN_PROGRESS, DateTimeOffset.UtcNow, null, isSystem: true);
            absence = off.AddActivity("Absence").Id;
            db.Projects.Add(off);
            var sheet = Timesheet.Create(s.Staff.DivisionId.Value, s.Staff.Id, source, DateTimeOffset.UtcNow);
            sheet.SaveDraft(new Dictionary<DateOnly, Guid>
            {
                [source.Monday] = s.Open, [source.Monday.AddDays(1)] = s.Open, [source.Monday.AddDays(2)] = s.Open,
                [source.Monday.AddDays(3)] = s.Closed, [source.Monday.AddDays(4)] = absence,
            }, null, DateTimeOffset.UtcNow);
            db.Timesheets.Add(sheet);
            await db.SaveChangesAsync();
        });

        var week = await FactoryClient.GetFromJsonAsync<JsonElement>(Path(s.Current));
        (week.GetProperty("copyFrom").GetProperty("year").GetInt32(), week.GetProperty("copyFrom").GetProperty("week").GetInt32()).Should().Be((source.Year, source.Week));
        week.GetProperty("days").EnumerateArray().Select(d => d.GetProperty("previous").ValueKind == JsonValueKind.Null ? (Guid?)null : d.GetProperty("previous").GetGuid())
            .Should().Equal(s.Open, s.Open, s.Open, null, null);
        week.GetProperty("choices").EnumerateArray().Single(c => c.GetProperty("key").GetGuid() == absence).GetProperty("absence").GetBoolean().Should().BeTrue();

        // La semaine reprise elle-même ne propose pas de se reprendre.
        (await FactoryClient.GetFromJsonAsync<JsonElement>(Path(source))).GetProperty("copyFrom").ValueKind.Should().Be(JsonValueKind.Null);
    }
}
