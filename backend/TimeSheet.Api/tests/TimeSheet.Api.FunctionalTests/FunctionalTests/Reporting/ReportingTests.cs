namespace TimeSheet.Api.FunctionalTests.FunctionalTests.Reporting;

using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using TimeSheet.Api.Domain.Access;
using TimeSheet.Api.Domain.Divisions;
using TimeSheet.Api.Domain.Projects;
using TimeSheet.Api.Domain.Timesheets;
using TimeSheet.Api.Domain.Users;
using TimeSheet.Api.Services.Security;

/// <summary>Reporting (jalon 4, écran 10) : périmètre, chiffres, exports.</summary>
public class ReportingTests : TestBase
{
    private const string Password = "Mot-de-passe-2026";
    private static readonly string Hash = PasswordHasher.Hash(Password);

    /// <summary>Marc (manager) : Ana a validé 5 jours la semaine passée ; Léo (équipe de Nina) en a 5 aussi.</summary>
    private sealed record Setup(User Marc, User Ana, User Leo, IsoWeek Week);

    private static Task WithDb(Func<Databases.TimeSheetDbContext, Task> action) => ExecuteDbContextAsync(action);

    private static async Task<Setup> NewDivision()
    {
        var division = Division.Create($"Division {Guid.NewGuid():N}", $"rp-{Guid.NewGuid():N}", "DIR", "RP", status: DivisionStatus.ACTIVE);
        User Person(string first, Role role)
        {
            var u = User.Create(division.Id, $"{first.ToLowerInvariant()}-{Guid.NewGuid():N}@exemple.com", first, "Essai", role);
            u.SetPassword(Hash);
            return u;
        }
        var marc = Person("Marc", Role.MANAGER);
        var nina = Person("Nina", Role.MANAGER);
        var ana = Person("Ana", Role.STAFF);
        var leo = Person("Léo", Role.STAFF);
        var now = DateTimeOffset.UtcNow;
        var week = WeekRules.CurrentWeek(now).Shift(-1);
        var project = Project.Create(division.Id, "RP-2026-01", "Projet commun", new DateOnly(2000, 1, 1), null, null, ProjectStatus.IN_PROGRESS, now, marc.Id);
        var analyse = project.AddActivity("Analyse");
        await WithDb(async db =>
        {
            db.Divisions.Add(division);
            db.Users.AddRange(marc, nina);
            await db.SaveChangesAsync();
            ana.AssignManager(marc.Id);
            leo.AssignManager(nina.Id);
            db.Users.AddRange(ana, leo);
            db.Projects.Add(project);
            await db.SaveChangesAsync();
            foreach (var u in new[] { ana, leo })
            {
                var sheet = Timesheet.Create(division.Id, u.Id, week, now);
                sheet.SaveDraft(Enumerable.Range(0, 5).ToDictionary(i => week.Monday.AddDays(i), _ => analyse.Id), null, now);
                sheet.Submit(u.Id, now);
                sheet.Validate(marc.Id, now);
                db.Timesheets.Add(sheet);
            }
            await db.SaveChangesAsync();
        });
        (await FactoryClient.PostAsJsonAsync("api/v1/auth/connexion", new { email = marc.Email, password = Password })).StatusCode.Should().Be(HttpStatusCode.OK);
        return new Setup(marc, ana, leo, week);
    }

    private static string Q(IsoWeek w) => $"de={w.Year}-{w.Week}&a={w.Year}-{w.Week}";

    [Fact]
    public async Task le_rapport_du_manager_ne_compte_que_son_equipe()
    {
        var s = await NewDivision();
        var report = await FactoryClient.GetFromJsonAsync<JsonElement>($"api/v1/reporting?{Q(s.Week)}");
        report.GetProperty("people").EnumerateArray().Select(p => p.GetProperty("name").GetString()).Should().Equal("Ana Essai");
        var kpis = report.GetProperty("kpis");
        kpis.GetProperty("entered").GetInt32().Should().Be(5);
        kpis.GetProperty("capacity").GetInt32().Should().Be(5);
        kpis.GetProperty("validated").GetInt32().Should().Be(1);
        var entity = report.GetProperty("entities")[0];
        entity.GetProperty("label").GetString().Should().Be("Projet commun");
        entity.GetProperty("total").GetInt32().Should().Be(5);

        // Léo n'est pas dans le périmètre : le filtre est ignoré.
        var other = await FactoryClient.GetFromJsonAsync<JsonElement>($"api/v1/reporting?{Q(s.Week)}&personne={s.Leo.Id}");
        other.GetProperty("personId").ValueKind.Should().Be(JsonValueKind.Null);
        other.GetProperty("kpis").GetProperty("entered").GetInt32().Should().Be(5);
    }

    [Fact]
    public async Task les_exports_reprennent_les_memes_chiffres()
    {
        var s = await NewDivision();
        var csv = await FactoryClient.GetAsync($"api/v1/reporting/export?format=csv&{Q(s.Week)}");
        csv.StatusCode.Should().Be(HttpStatusCode.OK);
        csv.Content.Headers.ContentDisposition!.FileNameStar.Should().Be($"Reporting_{s.Week.Year}-S{s.Week.Week}_{s.Week.Year}-S{s.Week.Week}.csv");
        var text = Encoding.UTF8.GetString(await csv.Content.ReadAsByteArrayAsync());
        text.Should().Contain($"Projet;Code;Membres;S{s.Week.Week};Total;Part").And.Contain("Projet commun;RP-2026-01;0;5;5;100").And.Contain("Total;;;5;5;100");

        var xlsx = await FactoryClient.GetAsync($"api/v1/reporting/export?format=xlsx&{Q(s.Week)}");
        (await xlsx.Content.ReadAsByteArrayAsync()).Take(2).Should().Equal((byte)'P', (byte)'K');

        var pdf = await FactoryClient.GetAsync($"api/v1/reporting/export?format=pdf&{Q(s.Week)}");
        pdf.Content.Headers.ContentType!.MediaType.Should().Be("application/pdf");
        Encoding.ASCII.GetString((await pdf.Content.ReadAsByteArrayAsync()).Take(5).ToArray()).Should().Be("%PDF-");

        (await FactoryClient.GetAsync($"api/v1/reporting/export?format=doc&{Q(s.Week)}")).StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }
}
