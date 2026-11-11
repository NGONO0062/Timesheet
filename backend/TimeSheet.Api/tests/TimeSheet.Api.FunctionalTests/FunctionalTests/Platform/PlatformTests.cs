namespace TimeSheet.Api.FunctionalTests.FunctionalTests.Platform;

using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using TimeSheet.Api.Domain.Access;
using TimeSheet.Api.Domain.Divisions;
using TimeSheet.Api.Domain.Users;
using TimeSheet.Api.FunctionalTests.TestUtilities;
using TimeSheet.Api.Services.Security;

/// <summary>Administration plateforme (écran 13, jalon 7) : onboarding, état d'une division, journal d'audit.</summary>
public class PlatformTests : TestBase
{
    private const string Password = "Mot-de-passe-2026";
    private static readonly string Hash = PasswordHasher.Hash(Password);

    private static Task WithDb(Func<Databases.TimeSheetDbContext, Task> action) => ExecuteDbContextAsync(action);

    /// <summary>Un admin plateforme, et un admin de division (qui n'a pas accès à la plateforme).</summary>
    private static async Task<(User Platform, User DivisionAdmin, string Tag)> Accounts()
    {
        var tag = Guid.NewGuid().ToString("N")[..10];
        var platform = User.Create(null, $"plateforme-{tag}@exemple.com", "Rose", "Essai", Role.PLATFORM_ADMIN);
        platform.SetPassword(Hash);
        var division = Division.Create($"Division {tag}", $"pf-{tag}", "DIR", status: DivisionStatus.ACTIVE);
        var admin = User.Create(division.Id, $"admin-{tag}@exemple.com", "Paul", "Essai", Role.DIVISION_ADMIN);
        admin.SetPassword(Hash);
        await WithDb(async db =>
        {
            db.Divisions.Add(division);
            db.DivisionSettings.Add(DivisionSettings.Defaults(division.Id));
            db.Users.AddRange(platform, admin);
            await db.SaveChangesAsync();
        });
        return (platform, admin, tag);
    }

    private static async Task SignIn(User user) =>
        (await FactoryClient.PostAsJsonAsync("api/v1/auth/connexion", new { email = user.Email, password = Password })).StatusCode.Should().Be(HttpStatusCode.OK);

    private static async Task<JsonElement> Body(HttpResponseMessage r)
    {
        r.IsSuccessStatusCode.Should().BeTrue(await r.Content.ReadAsStringAsync());
        return await r.Content.ReadFromJsonAsync<JsonElement>();
    }

    private static async Task<(string? Code, string[] Fields, string? Value)> Rule(HttpResponseMessage r)
    {
        r.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
        var body = await r.Content.ReadFromJsonAsync<JsonElement>();
        var fields = body.TryGetProperty("fields", out var f) ? f.EnumerateArray().Select(x => x.GetString()!).ToArray() : [];
        var value = body.TryGetProperty("value", out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;
        return (body.GetProperty("code").GetString(), fields, value);
    }

    [Fact]
    public async Task onboarding_en_cinq_etapes_puis_suspension()
    {
        var (platform, divisionAdmin, tag) = await Accounts();
        await SignIn(divisionAdmin);
        (await FactoryClient.GetAsync("api/v1/plateforme/divisions")).StatusCode.Should().Be(HttpStatusCode.NotFound);

        await SignIn(platform);
        // Étape 1 : identité contrôlée, identifiant unique.
        (await Rule(await FactoryClient.PostAsJsonAsync("api/v1/plateforme/onboarding", new { name = "", slug = "X", direction = "DEC" }))).Fields.Should().Equal("name", "slug");
        (await Rule(await FactoryClient.PostAsJsonAsync("api/v1/plateforme/onboarding", new { name = "Doublon", slug = $"pf-{tag}", direction = "DEC" }))).Fields.Should().Equal("slugTaken");
        var created = await Body(await FactoryClient.PostAsJsonAsync("api/v1/plateforme/onboarding", new { name = $"Nouvelle {tag}", slug = $"nouvelle-{tag}", direction = "DEC" }));
        var id = created.GetProperty("id").GetGuid();
        created.GetProperty("step").GetInt32().Should().Be(2);

        // La création ne part pas tant que les étapes ne sont pas faites.
        (await Rule(await FactoryClient.PostAsync($"api/v1/plateforme/onboarding/{id}/creation", null))).Should().Be(("incomplete", Array.Empty<string>(), "2"));

        // Étape 2 : administrateur (adresse unique), configuration vierge.
        var email = $"nadia-{tag}@exemple.com";
        (await Rule(await FactoryClient.PutAsJsonAsync($"api/v1/plateforme/onboarding/{id}/administrateur", new { fullName = "Nadia", email = divisionAdmin.Email, config = "COPY" })))
            .Fields.Should().Equal("fullName");
        (await Rule(await FactoryClient.PutAsJsonAsync($"api/v1/plateforme/onboarding/{id}/administrateur", new { fullName = "Nadia Nouvelle", email = divisionAdmin.Email, config = "COPY" })))
            .Fields.Should().Equal("emailTaken");
        (await Body(await FactoryClient.PutAsJsonAsync($"api/v1/plateforme/onboarding/{id}/administrateur", new { fullName = "Nadia Nouvelle", email, config = "BLANK" })))
            .GetProperty("step").GetInt32().Should().Be(3);

        // Étape 3 : le délai de relance est contrôlé ; Staff reçoit le reporting.
        var onboarding = await Body(await FactoryClient.GetAsync($"api/v1/plateforme/onboarding/{id}"));
        onboarding.GetProperty("admin").GetProperty("email").GetString().Should().Be(email);
        onboarding.GetProperty("config").GetString().Should().Be("BLANK");
        var matrix = onboarding.GetProperty("matrix").Deserialize<Dictionary<string, string[]>>()!;
        matrix["STAFF"] = [.. matrix["STAFF"], "VIEW_REPORTING"];
        var workflow = new { reminderAfterWorkingDays = 4, delegateToOwner = true };
        (await Rule(await FactoryClient.PutAsJsonAsync($"api/v1/plateforme/onboarding/{id}/roles", new { matrix, workflow }))).Fields.Should().Equal("reminder");
        (await Body(await FactoryClient.PutAsJsonAsync($"api/v1/plateforme/onboarding/{id}/roles", new { matrix, workflow = workflow with { reminderAfterWorkingDays = 5 } })))
            .GetProperty("step").GetInt32().Should().Be(4);

        // Étape 4 : règles de saisie.
        (await Body(await FactoryClient.PutAsJsonAsync($"api/v1/plateforme/onboarding/{id}/regles",
            new { workingDays = new[] { "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY" }, deadlineDay = "FRIDAY", deadlineTime = "18:00", fillAlertThreshold = "75", allowFutureWeeks = false, lockAfterValidation = true })))
            .GetProperty("step").GetInt32().Should().Be(5);

        // Étape 5 : la division devient active, l'invitation part à l'administrateur.
        var done = await Body(await FactoryClient.PostAsync($"api/v1/plateforme/onboarding/{id}/creation", null));
        done.GetProperty("email").GetString().Should().Be(email);
        RecordingMailSender.To(email).Should().ContainSingle().Which.Subject.Should().Be($"Votre accès à TimeSheet · Nouvelle {tag}");
        (await FactoryClient.GetAsync($"api/v1/plateforme/onboarding/{id}")).StatusCode.Should().Be(HttpStatusCode.NotFound);

        var row = (await Body(await FactoryClient.GetAsync("api/v1/plateforme/divisions"))).EnumerateArray().Single(d => d.GetProperty("id").GetGuid() == id);
        row.GetProperty("status").GetString().Should().Be("ACTIVE");
        row.GetProperty("admin").GetString().Should().Be("Nadia Nouvelle");
        row.GetProperty("users").GetInt32().Should().Be(1);
        var settings = await ExecuteDbContextAsync(db => db.DivisionSettings.AsNoTracking().FirstAsync(s => s.DivisionId == id));
        (settings.ReminderAfterWorkingDays, settings.FillAlertThreshold).Should().Be((5, 75));

        // Suspension, puis « Annuler » : l'ancien état est renvoyé.
        var suspended = await Body(await FactoryClient.PutAsJsonAsync($"api/v1/plateforme/divisions/{id}/etat", new { status = "SUSPENDED" }));
        suspended.GetProperty("previous").GetString().Should().Be("ACTIVE");
        (await Body(await FactoryClient.GetAsync($"api/v1/plateforme/divisions/{id}"))).GetProperty("status").GetString().Should().Be("SUSPENDED");
        await FactoryClient.PutAsJsonAsync($"api/v1/plateforme/divisions/{id}/etat", new { status = "ACTIVE" });

        var actions = await ExecuteDbContextAsync(db => db.AuditLog.Where(a => a.DivisionId == id).Select(a => a.Action).ToListAsync());
        actions.Should().Contain(["DIVISION_UPDATED", "DIVISION_CREATED", "USER_INVITED", "DIVISION_SUSPENDED", "DIVISION_ACTIVATED"]);
    }

    [Fact]
    public async Task journal_filtre_pagine_et_exporte()
    {
        var (platform, divisionAdmin, tag) = await Accounts();
        await SignIn(divisionAdmin);
        (await FactoryClient.GetAsync("api/v1/plateforme/journal/export?format=csv")).StatusCode.Should().Be(HttpStatusCode.NotFound);

        await SignIn(platform);
        var divisionId = await ExecuteDbContextAsync(db => db.Divisions.Where(d => d.Slug == $"pf-{tag}").Select(d => d.Id).SingleAsync());
        var douala = DateTimeOffset.UtcNow.AddHours(1); // jour de Douala (UTC+1)
        var day = douala.ToString("dd/MM/yyyy", System.Globalization.CultureInfo.InvariantCulture);
        var query = $"division={divisionId}&du={day}&au={day}";

        // Connexion de l'admin de division réussie, puis un échec : l'acteur de l'échec est inconnu.
        await FactoryClient.PostAsJsonAsync("api/v1/auth/connexion", new { email = divisionAdmin.Email, password = "faux" });
        await SignIn(platform);
        var log = await Body(await FactoryClient.GetAsync($"api/v1/plateforme/journal?{query}&type=LOGIN"));
        log.GetProperty("total").GetInt32().Should().Be(2);
        var rows = log.GetProperty("rows").EnumerateArray().ToList();
        rows[0].GetProperty("action").GetString().Should().Be("LOGIN_FAILURE");
        rows[0].GetProperty("actor").ValueKind.Should().Be(JsonValueKind.Null);
        rows[0].GetProperty("result").GetString().Should().Be("FAILURE");
        rows[1].GetProperty("actor").GetString().Should().Be("Paul Essai");
        rows[1].GetProperty("actorRole").GetString().Should().Be("DIVISION_ADMIN");
        rows[1].GetProperty("actionLabel").GetString().Should().Be("Connexion");

        (await Body(await FactoryClient.GetAsync($"api/v1/plateforme/journal?{query}&type=LOGIN&q=introuvable"))).GetProperty("total").GetInt32().Should().Be(0);
        var invalid = await Body(await FactoryClient.GetAsync($"api/v1/plateforme/journal?division={divisionId}&du=31/02/2026"));
        invalid.GetProperty("errors").GetProperty("from").GetString().Should().Be("date");
        invalid.GetProperty("from").GetString().Should().Be("31/02/2026");

        var csv = await FactoryClient.GetAsync($"api/v1/plateforme/journal/export?{query}&type=LOGIN&format=csv");
        csv.StatusCode.Should().Be(HttpStatusCode.OK);
        var iso = douala.ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture);
        csv.Content.Headers.ContentDisposition!.FileName.Should().Be($"Journal_audit_{iso}_{iso}.csv");
        var text = await csv.Content.ReadAsStringAsync();
        text.Should().Contain("Date et heure;Acteur;Rôle;Division;Action;Objet;Résultat").And.Contain("Compte non identifié").And.Contain("Admin division");
        (await FactoryClient.GetAsync($"api/v1/plateforme/journal/export?{query}&format=doc")).StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }
}
