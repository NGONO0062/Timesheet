namespace TimeSheet.Api.FunctionalTests.FunctionalTests.Tasks;

using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using TimeSheet.Api.Domain.Access;
using TimeSheet.Api.Domain.Divisions;
using TimeSheet.Api.Domain.Projects;
using TimeSheet.Api.Domain.Users;
using TimeSheet.Api.Services.Security;

/// <summary>Tableau Kanban d'un projet (écran 15, jalon 8) : portée, écritures, lecture seule.</summary>
public class BoardTests : TestBase
{
    private const string Password = "Mot-de-passe-2026";
    private static readonly string Hash = PasswordHasher.Hash(Password);

    private sealed record Setup(User Manager, User Member, User Outsider, User Admin, Guid Open, Guid Done, Guid Other);

    private static Task WithDb(Func<Databases.TimeSheetDbContext, Task> action) => ExecuteDbContextAsync(action);

    /// <summary>
    /// Hugo gère « Ouvert » (membre : Théo) ; « Terminé » compte Théo aussi ; « Autre » n'a que
    /// Zoé, qui ne dépend pas de Hugo. Ada, admin d'une autre division.
    /// </summary>
    private static async Task<Setup> NewDivision()
    {
        var tag = Guid.NewGuid().ToString("N")[..10];
        var division = Division.Create($"Division {tag}", $"kb-{tag}", "DIR", status: DivisionStatus.ACTIVE);
        var elsewhere = Division.Create($"Ailleurs {tag}", $"kb-ailleurs-{tag}", "DIR", status: DivisionStatus.ACTIVE);
        User Person(Division d, string first, Role role)
        {
            var u = User.Create(d.Id, $"{first.ToLowerInvariant()}-{tag}@exemple.com", first, "Essai", role);
            u.SetPassword(Hash);
            return u;
        }
        var hugo = Person(division, "Hugo", Role.MANAGER);
        var theo = Person(division, "Theo", Role.STAFF);
        var zoe = Person(division, "Zoe", Role.STAFF);
        var ada = Person(elsewhere, "Ada", Role.DIVISION_ADMIN);
        var now = DateTimeOffset.UtcNow;
        var open = Project.Create(division.Id, "KB-01", "Ouvert", new DateOnly(2026, 1, 1), null, null, ProjectStatus.IN_PROGRESS, now, hugo.Id);
        var done = Project.Create(division.Id, "KB-02", "Terminé", new DateOnly(2026, 1, 1), null, null, ProjectStatus.DONE, now, hugo.Id);
        var other = Project.Create(division.Id, "KB-03", "Autre", new DateOnly(2026, 1, 1), null, null, ProjectStatus.IN_PROGRESS, now, null);
        await WithDb(async db =>
        {
            db.Divisions.AddRange(division, elsewhere);
            db.Users.AddRange(hugo, zoe, ada);
            await db.SaveChangesAsync();
            theo.AssignManager(hugo.Id);
            db.Users.Add(theo);
            open.AddMember(theo.Id);
            done.AddMember(theo.Id);
            other.AddMember(zoe.Id);
            db.Projects.AddRange(open, done, other);
            await db.SaveChangesAsync();
        });
        return new Setup(hugo, theo, zoe, ada, open.Id, done.Id, other.Id);
    }

    private static async Task SignIn(User user) =>
        (await FactoryClient.PostAsJsonAsync("api/v1/auth/connexion", new { email = user.Email, password = Password })).StatusCode.Should().Be(HttpStatusCode.OK);

    private static async Task<JsonElement> Body(HttpResponseMessage r)
    {
        r.IsSuccessStatusCode.Should().BeTrue(await r.Content.ReadAsStringAsync());
        return await r.Content.ReadFromJsonAsync<JsonElement>();
    }

    private static async Task<string?> Code(HttpResponseMessage r)
    {
        r.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
        var body = await r.Content.ReadFromJsonAsync<JsonElement>();
        return body.TryGetProperty("fields", out var f) && f.GetArrayLength() > 0 ? f[0].GetString() : body.GetProperty("code").GetString();
    }

    [Fact]
    public async Task le_membre_cree_deplace_renomme_et_supprime_puis_annule()
    {
        var s = await NewDivision();
        await SignIn(s.Member);
        var projects = (await Body(await FactoryClient.GetAsync("api/v1/kanban/projets"))).EnumerateArray().Select(p => p.GetProperty("code").GetString()).ToList();
        projects.Should().Equal("KB-01", "KB-02");

        (await Code(await FactoryClient.PostAsJsonAsync($"api/v1/kanban/projets/{s.Open}/taches", new { title = "  " }))).Should().Be("titleEmpty");
        var first = await Body(await FactoryClient.PostAsJsonAsync($"api/v1/kanban/projets/{s.Open}/taches", new { title = "Préparer   l'atelier" }));
        first.GetProperty("title").GetString().Should().Be("Préparer l'atelier");
        var id = first.GetProperty("id").GetGuid();
        await FactoryClient.PostAsJsonAsync($"api/v1/kanban/projets/{s.Open}/taches", new { title = "Deuxième" });

        var moved = await Body(await FactoryClient.PutAsJsonAsync($"api/v1/kanban/taches/{id}/colonne", new { status = "IN_PROGRESS" }));
        (moved.GetProperty("previousStatus").GetString(), moved.GetProperty("previousPosition").GetInt32()).Should().Be(("BACKLOG", 0));
        await FactoryClient.PutAsJsonAsync($"api/v1/kanban/taches/{id}/titre", new { title = "Atelier de cadrage" });
        await FactoryClient.PutAsJsonAsync($"api/v1/kanban/taches/{id}/suppression", new { deleted = true });
        var board = await Body(await FactoryClient.GetAsync($"api/v1/kanban/projets/{s.Open}"));
        board.GetProperty("tasks").EnumerateArray().Select(t => t.GetProperty("title").GetString()).Should().Equal("Deuxième");
        // « Annuler » : la tâche revient, puis à sa place d'origine.
        await FactoryClient.PutAsJsonAsync($"api/v1/kanban/taches/{id}/suppression", new { deleted = false });
        await FactoryClient.PutAsJsonAsync($"api/v1/kanban/taches/{id}/colonne", new { status = "BACKLOG", position = 0 });
        board = await Body(await FactoryClient.GetAsync($"api/v1/kanban/projets/{s.Open}"));
        var task = board.GetProperty("tasks").EnumerateArray().Single(t => t.GetProperty("id").GetGuid() == id);
        (task.GetProperty("status").GetString(), task.GetProperty("position").GetInt32(), task.GetProperty("title").GetString(), task.GetProperty("createdBy").GetString())
            .Should().Be(("BACKLOG", 0, "Atelier de cadrage", "Theo Essai"));
        board.GetProperty("editable").GetBoolean().Should().BeTrue();

        // Projet terminé : lisible, en lecture seule.
        var done = await Body(await FactoryClient.GetAsync($"api/v1/kanban/projets/{s.Done}"));
        (done.GetProperty("editable").GetBoolean(), done.GetProperty("readOnlyReason").GetString()).Should().Be((false, "done"));
        (await Code(await FactoryClient.PostAsJsonAsync($"api/v1/kanban/projets/{s.Done}/taches", new { title = "Interdit" }))).Should().Be("readOnly");
    }

    [Fact]
    public async Task portee_membres_managers_et_divisions()
    {
        var s = await NewDivision();
        await SignIn(s.Member);
        var created = await Body(await FactoryClient.PostAsJsonAsync($"api/v1/kanban/projets/{s.Open}/taches", new { title = "Carte" }));
        var id = created.GetProperty("id").GetGuid();
        (await FactoryClient.GetAsync($"api/v1/kanban/projets/{s.Other}")).StatusCode.Should().Be(HttpStatusCode.NotFound);

        // Le manager voit les projets qu'il gère (ou qui comptent un rattaché), pas « Autre ».
        await SignIn(s.Manager);
        var codes = (await Body(await FactoryClient.GetAsync("api/v1/kanban/projets"))).EnumerateArray().Select(p => p.GetProperty("code").GetString()).ToList();
        codes.Should().Equal("KB-01", "KB-02");
        (await FactoryClient.PutAsJsonAsync($"api/v1/kanban/taches/{id}/colonne", new { status = "DONE" })).StatusCode.Should().Be(HttpStatusCode.OK);

        // Zoé ne voit que « Autre » ; une tâche d'un autre projet n'existe pas pour elle.
        await SignIn(s.Outsider);
        (await FactoryClient.PutAsJsonAsync($"api/v1/kanban/taches/{id}/titre", new { title = "Piratée" })).StatusCode.Should().Be(HttpStatusCode.NotFound);

        // Une autre division : rien.
        await SignIn(s.Admin);
        (await FactoryClient.GetAsync($"api/v1/kanban/projets/{s.Open}")).StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await FactoryClient.PutAsJsonAsync($"api/v1/kanban/taches/{id}/suppression", new { deleted = true })).StatusCode.Should().Be(HttpStatusCode.NotFound);
    }
}
