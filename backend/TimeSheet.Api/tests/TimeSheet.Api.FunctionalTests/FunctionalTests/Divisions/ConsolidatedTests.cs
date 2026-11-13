namespace TimeSheet.Api.FunctionalTests.FunctionalTests.Divisions;

using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using TimeSheet.Api.Domain.Access;
using TimeSheet.Api.Domain.Divisions;
using TimeSheet.Api.Domain.Projects;
using TimeSheet.Api.Domain.Teams;
using TimeSheet.Api.Domain.Timesheets;
using TimeSheet.Api.Domain.Users;
using TimeSheet.Api.FunctionalTests.TestUtilities;
using TimeSheet.Api.Services.Security;

/// <summary>Vue consolidée (jalon 4, écran 11) : accès, blocs, dérives, relances.</summary>
public class ConsolidatedTests : TestBase
{
    private const string Password = "Mot-de-passe-2026";
    private static readonly string Hash = PasswordHasher.Hash(Password);

    /// <summary>
    /// Équipe « Alpha » de Marc : Ana a soumis la semaine passée il y a dix jours (validation en
    /// retard, budget du projet dépassé) ; Ben n'a rien saisi (saisie manquante). Olga est owner.
    /// </summary>
    private sealed record Setup(User Olga, User Marc, User Ana, User Ben, IsoWeek Week);

    private static Task WithDb(Func<Databases.TimeSheetDbContext, Task> action) => ExecuteDbContextAsync(action);

    private static async Task<Setup> NewDivision()
    {
        var division = Division.Create($"Division {Guid.NewGuid():N}", $"cs-{Guid.NewGuid():N}", "DIR", "CS", status: DivisionStatus.ACTIVE);
        User Person(string first, Role role)
        {
            var u = User.Create(division.Id, $"{first.ToLowerInvariant()}-{Guid.NewGuid():N}@exemple.com", first, "Essai", role);
            u.SetPassword(Hash);
            return u;
        }
        var olga = Person("Olga", Role.OWNER);
        var marc = Person("Marc", Role.MANAGER);
        var ana = Person("Ana", Role.STAFF);
        var ben = Person("Ben", Role.STAFF);
        var now = DateTimeOffset.UtcNow;
        // Une semaine entière il y a deux semaines : son échéance est passée, la soumission date de dix jours.
        var week = WeekRules.CurrentWeek(now).Shift(-2);
        var project = Project.Create(division.Id, "CS-2026-01", "Projet budgété", new DateOnly(2000, 1, 1), null, 2, ProjectStatus.IN_PROGRESS, now, marc.Id);
        var activity = project.AddActivity("Analyse");
        await WithDb(async db =>
        {
            db.Divisions.Add(division);
            db.Users.AddRange(olga, marc);
            await db.SaveChangesAsync();
            var team = Team.Create(division.Id, "Alpha", marc.Id);
            db.Teams.Add(team);
            await db.SaveChangesAsync();
            foreach (var u in new[] { ana, ben })
            {
                u.AssignManager(marc.Id);
                u.AssignTeam(team.Id);
            }
            db.Users.AddRange(ana, ben);
            db.Projects.Add(project);
            await db.SaveChangesAsync();
            var sheet = Timesheet.Create(division.Id, ana.Id, week, now.AddDays(-11));
            sheet.SaveDraft(Enumerable.Range(0, 5).ToDictionary(i => week.Monday.AddDays(i), _ => activity.Id), null, now.AddDays(-11));
            sheet.Submit(ana.Id, now.AddDays(-10));
            db.Timesheets.Add(sheet);
            await db.SaveChangesAsync();
        });
        return new Setup(olga, marc, ana, ben, week);
    }

    private static async Task SignIn(User user) =>
        (await FactoryClient.PostAsJsonAsync("api/v1/auth/connexion", new { email = user.Email, password = Password })).StatusCode.Should().Be(HttpStatusCode.OK);

    private static string Q(IsoWeek w) => $"annee={w.Year}&semaine={w.Week}";

    [Fact]
    public async Task l_owner_voit_les_blocs_de_la_semaine_et_les_derives()
    {
        var s = await NewDivision();
        await SignIn(s.Olga);
        var head = await FactoryClient.GetFromJsonAsync<JsonElement>($"api/v1/division?{Q(s.Week)}");
        head.GetProperty("teams").GetInt32().Should().Be(1);
        head.GetProperty("people").GetInt32().Should().Be(2, "le manager de l'équipe et l'owner ne comptent pas");
        head.GetProperty("week").GetProperty("week").GetInt32().Should().Be(s.Week.Week);

        var block = await FactoryClient.GetFromJsonAsync<JsonElement>($"api/v1/division/semaine?{Q(s.Week)}");
        var row = block.GetProperty("rows")[0];
        (row.GetProperty("name").GetString(), row.GetProperty("entered").GetInt32(), row.GetProperty("fill").GetInt32(), row.GetProperty("under").GetBoolean())
            .Should().Be(("Alpha", 5, 50, true));
        block.GetProperty("trend").GetArrayLength().Should().Be(6);

        var drifts = (await FactoryClient.GetFromJsonAsync<JsonElement>($"api/v1/division/derives?{Q(s.Week)}")).EnumerateArray().ToList();
        drifts.Select(d => d.GetProperty("kind").GetString()).Distinct().Should().Equal("BUDGET", "UNDERFILL", "LATE_VALIDATION", "MISSING");
        drifts.Should().Contain(d => d.GetProperty("kind").GetString() == "MISSING" && d.GetProperty("label").GetString() == "Ben Essai");

        // Une semaine future est ramenée à la semaine courante.
        var future = WeekRules.CurrentWeek(DateTimeOffset.UtcNow).Shift(3);
        (await FactoryClient.GetFromJsonAsync<JsonElement>($"api/v1/division?{Q(future)}")).GetProperty("week").GetProperty("week").GetInt32()
            .Should().Be(WeekRules.CurrentWeek(DateTimeOffset.UtcNow).Week);
    }

    [Fact]
    public async Task les_relances_partent_par_e_mail_une_fois_le_retard_constate()
    {
        var s = await NewDivision();
        await SignIn(s.Olga);
        (await FactoryClient.PostAsync($"api/v1/division/relances/manager/{s.Marc.Id}", null)).StatusCode.Should().Be(HttpStatusCode.OK);
        RecordingMailSender.To(s.Marc.Email).Should().ContainSingle(m => m.Subject == "Fiches de l'équipe Alpha en attente de validation");

        (await FactoryClient.PostAsync($"api/v1/division/relances/personne/{s.Ben.Id}/{s.Week.Year}/{s.Week.Week}", null)).StatusCode.Should().Be(HttpStatusCode.OK);
        RecordingMailSender.To(s.Ben.Email).Should().ContainSingle(m => m.Subject == $"Semaine {s.Week.Week} à saisir");

        // Ana a soumis : rien à lui rappeler.
        var nothing = await FactoryClient.PostAsync($"api/v1/division/relances/personne/{s.Ana.Id}/{s.Week.Year}/{s.Week.Week}", null);
        nothing.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }

    [Fact]
    public async Task un_manager_n_a_pas_la_vue_division()
    {
        var s = await NewDivision();
        await SignIn(s.Marc);
        (await FactoryClient.GetAsync("api/v1/division")).StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await FactoryClient.PostAsync($"api/v1/division/relances/manager/{s.Marc.Id}", null)).StatusCode.Should().Be(HttpStatusCode.NotFound);
    }
}
