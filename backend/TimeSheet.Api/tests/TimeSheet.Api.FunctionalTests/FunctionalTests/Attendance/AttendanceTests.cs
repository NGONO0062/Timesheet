namespace TimeSheet.Api.FunctionalTests.FunctionalTests.Attendance;

using System.Net;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using TimeSheet.Api.Domain.Access;
using TimeSheet.Api.Domain.Attendance;
using TimeSheet.Api.Domain.Divisions;
using TimeSheet.Api.Domain.Projects;
using TimeSheet.Api.Domain.Timesheets;
using TimeSheet.Api.Domain.Users;
using TimeSheet.Api.FunctionalTests.TestUtilities;
using TimeSheet.Api.Services.Security;

/// <summary>Fiche de présence (jalon 5, écran 06) : génération, signatures, renvoi, PDF signé, envoi aux RH.</summary>
public class AttendanceTests : TestBase
{
    private const string Password = "Mot-de-passe-2026";
    private static readonly string Hash = PasswordHasher.Hash(Password);

    /// <summary>
    /// Ana, stagiaire de Marc : semaines 6 à 8 de 2026 validées, semaine 9 soumise. Nina manage une
    /// autre équipe. Adresse des RH renseignée, envoi automatique.
    /// </summary>
    private sealed record Setup(User Marc, User Nina, User Ana, Guid Week9, string Hr);

    private static Task WithDb(Func<Databases.TimeSheetDbContext, Task> action) => ExecuteDbContextAsync(action);

    private static async Task<Setup> NewDivision()
    {
        var division = Division.Create($"Division {Guid.NewGuid():N}", $"fp-{Guid.NewGuid():N}", "DIR", "FP", status: DivisionStatus.ACTIVE);
        User Person(string first, Role role)
        {
            var u = User.Create(division.Id, $"{first.ToLowerInvariant()}-{Guid.NewGuid():N}@exemple.com", first, "Essai", role);
            u.SetPassword(Hash);
            return u;
        }
        var marc = Person("Marc", Role.MANAGER);
        var nina = Person("Nina", Role.MANAGER);
        var ana = Person("Ana", Role.STAFF);
        var hr = $"rh-{Guid.NewGuid():N}@exemple.com";
        var now = DateTimeOffset.UtcNow;
        var project = Project.Create(division.Id, "FP-2026-01", "Projet", new DateOnly(2000, 1, 1), null, null, ProjectStatus.IN_PROGRESS, now, marc.Id);
        var activity = project.AddActivity("Analyse");
        var week9 = Guid.Empty;
        await WithDb(async db =>
        {
            db.Divisions.Add(division);
            db.DivisionSettings.Add(DivisionSettings.Defaults(division.Id).WithHr(hr, autoSend: true));
            db.Users.AddRange(marc, nina);
            await db.SaveChangesAsync();
            ana.AssignManager(marc.Id);
            db.Users.Add(ana);
            db.Internships.Add(Internship.Create(ana.Id, InternshipKind.ACADEMIC, "DEC", "FP", "Tests", new DateOnly(2026, 1, 5), new DateOnly(2026, 6, 26)));
            db.Projects.Add(project);
            await db.SaveChangesAsync();
            for (var w = 6; w <= 9; w++)
            {
                var iso = new IsoWeek(2026, w);
                var sheet = Timesheet.Create(division.Id, ana.Id, iso, now);
                sheet.SaveDraft(Enumerable.Range(0, 5).ToDictionary(i => iso.Monday.AddDays(i), _ => activity.Id), null, now);
                sheet.Submit(ana.Id, now);
                if (w < 9) sheet.Validate(marc.Id, now);
                else week9 = sheet.Id;
                db.Timesheets.Add(sheet);
            }
            await db.SaveChangesAsync();
        });
        return new Setup(marc, nina, ana, week9, hr);
    }

    private static async Task SignIn(User user) =>
        (await FactoryClient.PostAsJsonAsync("api/v1/auth/connexion", new { email = user.Email, password = Password })).StatusCode.Should().Be(HttpStatusCode.OK);

    private static async Task<string?> CodeOf(HttpResponseMessage response) =>
        (await response.Content.ReadFromJsonAsync<JsonElement>()).TryGetProperty("code", out var c) ? c.GetString() : null;

    private static async Task<JsonElement> Get(string path) => await FactoryClient.GetFromJsonAsync<JsonElement>(path);

    [Fact]
    public async Task circuit_complet_de_la_generation_a_l_envoi_aux_rh()
    {
        var s = await NewDivision();

        // La validation de la dernière semaine de février génère la fiche et prévient la stagiaire.
        await SignIn(s.Marc);
        (await FactoryClient.PostAsJsonAsync($"api/v1/validation/{s.Week9}/decision", new { decision = "VALIDATE" })).StatusCode.Should().Be(HttpStatusCode.OK);
        RecordingMailSender.To(s.Ana.Email).Should().Contain(m => m.Subject == "Fiche de présence de février 2026 à signer");

        await SignIn(s.Ana);
        (await Get("api/v1/fiches-presence")).EnumerateArray().Select(m => (m.GetProperty("month").GetInt32(), m.GetProperty("status").GetString())).Should().Equal((2, "GENERATED"));
        var sheet = await Get("api/v1/fiches-presence/2026/2");
        var id = sheet.GetProperty("id").GetGuid();
        sheet.GetProperty("html").GetString().Should().Contain("FICHE DE PRESENCE STAGIAIRE").And.Contain("Lundi 02/02");
        sheet.GetProperty("fileName").GetString().Should().Be("Fiche_presence_2026-02_ESSAI.pdf");
        sheet.GetProperty("canSign").GetBoolean().Should().BeTrue();

        // Signature par mot de passe : vérifié de nouveau côté serveur.
        (await CodeOf(await FactoryClient.PostAsJsonAsync($"api/v1/fiches-presence/{id}/signature", new { method = "PASSWORD", password = "faux" }))).Should().Be("wrongPassword");
        var signed = await FactoryClient.PostAsJsonAsync($"api/v1/fiches-presence/{id}/signature", new { method = "PASSWORD", password = Password });
        signed.StatusCode.Should().Be(HttpStatusCode.OK);
        RecordingMailSender.To(s.Marc.Email).Should().Contain(m => m.Subject == "Fiche de présence de Ana Essai à signer (février 2026)");

        // Renvoi : motif obligatoire, la signature est annulée (jamais supprimée).
        await SignIn(s.Marc);
        (await Get("api/v1/fiches-presence/a-signer")).GetProperty("toSign").GetInt32().Should().Be(1);
        (await CodeOf(await FactoryClient.PostAsJsonAsync($"api/v1/fiches-presence/a-signer/{id}/renvoi", new { reason = " " }))).Should().Be("reason");
        (await FactoryClient.PostAsJsonAsync($"api/v1/fiches-presence/a-signer/{id}/renvoi", new { reason = "Le 13 février était un jour d'absence." })).StatusCode.Should().Be(HttpStatusCode.OK);
        var cancelled = await ExecuteDbContextAsync(db => db.Signatures.CountAsync(x => x.AttendanceSheetId == id && x.CancelledAt != null));
        cancelled.Should().Be(1);

        // Nouvelle signature, par tracé.
        await SignIn(s.Ana);
        (await Get("api/v1/fiches-presence/2026/2")).GetProperty("rejectionReason").GetString().Should().Be("Le 13 février était un jour d'absence.");
        (await CodeOf(await FactoryClient.PostAsJsonAsync($"api/v1/fiches-presence/{id}/signature", new { method = "DRAWN", drawing = "M 1 1 L 2" }))).Should().Be("drawing");
        (await FactoryClient.PostAsJsonAsync($"api/v1/fiches-presence/{id}/signature", new { method = "DRAWN", drawing = "M 20 60 L 80 30 L 140 70" })).StatusCode.Should().Be(HttpStatusCode.OK);

        // Contre-signature : PDF signé, stocké avec son empreinte, envoyé aux RH.
        await SignIn(s.Marc);
        var countersigned = await FactoryClient.PostAsJsonAsync($"api/v1/fiches-presence/a-signer/{id}/signature", new { method = "PASSWORD", password = Password, observation = "Stage suivi avec assiduité." });
        countersigned.StatusCode.Should().Be(HttpStatusCode.OK);
        (await countersigned.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("sentTo").GetString().Should().Be(s.Hr);
        var hrMail = RecordingMailSender.To(s.Hr).Should().ContainSingle().Subject;
        hrMail.Subject.Should().Be("Fiche de présence · Ana Essai · février 2026");
        hrMail.Attachments!.Single().FileName.Should().Be("Fiche_presence_2026-02_ESSAI.pdf");

        var detail = await Get($"api/v1/fiches-presence/a-signer/{id}");
        detail.GetProperty("status").GetString().Should().Be("SENT");
        detail.GetProperty("html").GetString().Should().Contain("Marc Essai").And.Contain("Stage suivi avec assiduité.");
        var pdf = await FactoryClient.GetByteArrayAsync($"api/v1/fiches-presence/{id}/pdf");
        Convert.ToHexStringLower(SHA256.HashData(pdf)).Should().Be(detail.GetProperty("supervisorSignature").GetProperty("sha256").GetString());

        var actions = await ExecuteDbContextAsync(db => db.AuditLog.Where(a => a.ObjectLabel == "Février 2026 · Ana Essai").Select(a => a.Action).ToListAsync());
        actions.Should().Contain(["ATTENDANCE_GENERATED", "ATTENDANCE_SIGNED", "ATTENDANCE_REJECTED", "ATTENDANCE_SENT"]);
    }

    [Fact]
    public async Task portee_et_limitation_des_tentatives()
    {
        var s = await NewDivision();
        await SignIn(s.Marc);
        await FactoryClient.PostAsJsonAsync($"api/v1/validation/{s.Week9}/decision", new { decision = "VALIDATE" });
        await SignIn(s.Ana);
        var id = (await Get("api/v1/fiches-presence/2026/2")).GetProperty("id").GetGuid();
        (await FactoryClient.GetAsync("api/v1/fiches-presence/a-signer")).StatusCode.Should().Be(HttpStatusCode.NotFound);

        // Pas encore signée par la stagiaire : la fiche n'existe pas pour le superviseur.
        await SignIn(s.Marc);
        (await FactoryClient.GetAsync($"api/v1/fiches-presence/a-signer/{id}")).StatusCode.Should().Be(HttpStatusCode.NotFound);
        // Une autre manager ne voit ni la fiche ni son PDF.
        await SignIn(s.Nina);
        (await FactoryClient.GetAsync($"api/v1/fiches-presence/{id}/pdf")).StatusCode.Should().Be(HttpStatusCode.NotFound);

        // Cinq mots de passe faux : la signature par mot de passe est bloquée.
        await SignIn(s.Ana);
        var codes = new List<string?>();
        for (var i = 0; i < 6; i++) codes.Add(await CodeOf(await FactoryClient.PostAsJsonAsync($"api/v1/fiches-presence/{id}/signature", new { method = "PASSWORD", password = "faux" })));
        codes.Should().Equal("wrongPassword", "wrongPassword", "wrongPassword", "wrongPassword", "throttled", "throttled");
        (await CodeOf(await FactoryClient.PostAsJsonAsync($"api/v1/fiches-presence/{id}/signature", new { method = "PASSWORD", password = Password }))).Should().Be("throttled");
    }
}
