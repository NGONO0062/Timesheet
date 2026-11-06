namespace TimeSheet.Api.FunctionalTests.FunctionalTests.Auth;

using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using TimeSheet.Api.Domain.Access;
using TimeSheet.Api.Domain.Divisions;
using TimeSheet.Api.Domain.Users;
using TimeSheet.Api.FunctionalTests.TestUtilities;
using TimeSheet.Api.Services.Security;

/// <summary>Connexion, session et cloisonnement (jalon 1), sur une division créée pour chaque test.</summary>
public class AuthTests : TestBase
{
    private const string Password = "Mot-de-passe-2026";
    private static readonly string Hash = PasswordHasher.Hash(Password);

    private sealed record Account(Division Division, User User);

    private static async Task<Account> NewAccount(Role role = Role.STAFF, bool active = true)
    {
        var division = Division.Create($"Division {Guid.NewGuid():N}", $"test-{Guid.NewGuid():N}", "TEST", status: DivisionStatus.ACTIVE);
        var user = User.Create(division.Id, $"test-{Guid.NewGuid():N}@exemple.com", "Test", "Compte", role);
        user.SetPassword(Hash);
        user.SetActive(active);
        await ExecuteDbContextAsync(db =>
        {
            db.Divisions.Add(division);
            db.Users.Add(user);
            return db.SaveChangesAsync();
        });
        return new Account(division, user);
    }

    /// <summary>Modification directe en base (les surcharges Task / ValueTask de TestBase sont ambiguës).</summary>
    private static Task WithDb(Func<Databases.TimeSheetDbContext, Task> action) => ExecuteDbContextAsync(action);

    private static Task<HttpResponseMessage> PostSignIn(string email, string password) =>
        FactoryClient.PostAsJsonAsync(ApiRoutes.Auth.Login(), new { email, password });

    private static async Task<string?> ErrorOf(HttpResponseMessage response) =>
        (await response.Content.ReadFromJsonAsync<Dictionary<string, string>>())?.GetValueOrDefault("error");

    [Fact]
    public async Task sans_session_moi_repond_401()
    {
        (await FactoryClient.GetAsync(ApiRoutes.Auth.Me())).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task connexion_puis_moi_avec_les_permissions_effectives()
    {
        var account = await NewAccount(Role.MANAGER);
        var response = await PostSignIn(account.User.Email.ToUpperInvariant(), Password);
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        response.Headers.GetValues("Set-Cookie").Single().Should().Contain("httponly").And.Contain("samesite=strict");

        var me = await FactoryClient.GetFromJsonAsync<Dictionary<string, object>>(ApiRoutes.Auth.Me());
        me!["role"].ToString().Should().Be("MANAGER");
        me["permissions"].ToString().Should().Contain("VALIDATE_TEAM");
    }

    [Fact]
    public async Task le_message_ne_dit_pas_quel_champ_est_faux()
    {
        var account = await NewAccount();
        var wrongPassword = await PostSignIn(account.User.Email, "faux-mot-de-passe");
        var unknownEmail = await PostSignIn($"inconnu-{Guid.NewGuid():N}@exemple.com", Password);
        wrongPassword.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        (await ErrorOf(wrongPassword)).Should().Be("identifiants");
        (await ErrorOf(unknownEmail)).Should().Be("identifiants");
    }

    [Fact]
    public async Task cinq_echecs_depuis_un_poste_bloquent_l_adresse()
    {
        var account = await NewAccount();
        for (var i = 0; i < Domain.Access.Features.SignIn.MaxFailuresPerIp; i++) await PostSignIn(account.User.Email, "faux");
        var blocked = await PostSignIn(account.User.Email, Password);
        blocked.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        (await ErrorOf(blocked)).Should().Be("tentatives");
    }

    [Fact]
    public async Task un_compte_desactive_ne_se_connecte_pas()
    {
        var account = await NewAccount(active: false);
        (await ErrorOf(await PostSignIn(account.User.Email, Password))).Should().Be("identifiants");
    }

    [Fact]
    public async Task une_division_suspendue_coupe_la_session_ouverte()
    {
        var account = await NewAccount();
        (await PostSignIn(account.User.Email, Password)).StatusCode.Should().Be(HttpStatusCode.OK);
        await WithDb(async db =>
        {
            var division = await db.Divisions.SingleAsync(d => d.Id == account.Division.Id);
            division.SetStatus(DivisionStatus.SUSPENDED);
            await db.SaveChangesAsync();
        });
        (await FactoryClient.GetAsync(ApiRoutes.Auth.Me())).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task un_mot_de_passe_change_ferme_les_sessions_ouvertes()
    {
        var account = await NewAccount();
        (await PostSignIn(account.User.Email, Password)).StatusCode.Should().Be(HttpStatusCode.OK);
        await WithDb(async db =>
        {
            var user = await db.Users.SingleAsync(u => u.Id == account.User.Id);
            user.SetPassword(PasswordHasher.Hash("Nouveau-mot-de-passe-2026"));
            await db.SaveChangesAsync();
        });
        (await FactoryClient.GetAsync(ApiRoutes.Auth.Me())).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task la_deconnexion_ferme_la_session()
    {
        var account = await NewAccount();
        await PostSignIn(account.User.Email, Password);
        (await FactoryClient.PostAsync(ApiRoutes.Auth.Logout(), null)).StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await FactoryClient.GetAsync(ApiRoutes.Auth.Me())).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task les_profils_de_demonstration_sont_fermes_par_defaut()
    {
        var demo = await FactoryClient.PostAsJsonAsync(ApiRoutes.Auth.Login().Replace("connexion", "connexion-demo"), new { email = "aicha.ndongo@exemple.com" });
        demo.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task le_journal_d_audit_refuse_modification_et_suppression()
    {
        var account = await NewAccount();
        await PostSignIn(account.User.Email, "faux");
        var update = () => ExecuteDbContextAsync(db => db.Database.ExecuteSqlRawAsync("""UPDATE "AuditLog" SET "ActorLabel" = 'x'"""));
        var delete = () => ExecuteDbContextAsync(db => db.Database.ExecuteSqlRawAsync("""DELETE FROM "AuditLog" """));
        await update.Should().ThrowAsync<Exception>().WithMessage("*ajout seul*");
        await delete.Should().ThrowAsync<Exception>().WithMessage("*ajout seul*");
    }

    [Fact]
    public async Task les_reponses_portent_les_en_tetes_de_securite()
    {
        var response = await FactoryClient.GetAsync(ApiRoutes.Health);
        response.Headers.GetValues("X-Frame-Options").Should().ContainSingle("DENY");
        response.Headers.GetValues("X-Content-Type-Options").Should().ContainSingle("nosniff");
    }
}
