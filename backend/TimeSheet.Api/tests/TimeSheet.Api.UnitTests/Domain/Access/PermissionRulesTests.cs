namespace TimeSheet.Api.UnitTests.Domain.Access;

using TimeSheet.Api.Domain.Access;
using TimeSheet.Api.Domain.Divisions;
using TimeSheet.Api.Domain.Users;

public class PermissionRulesTests
{
    [Fact]
    public void un_staff_ne_peut_que_saisir()
    {
        PermissionRules.Effective(Role.STAFF).Should().BeEquivalentTo([Permission.ENTER_TIME]);
    }

    [Fact]
    public void l_admin_plateforme_n_a_aucune_permission_de_division()
    {
        PermissionRules.Effective(Role.PLATFORM_ADMIN).Should().BeEmpty();
    }

    [Fact]
    public void les_reglages_de_la_division_accordent_et_retirent()
    {
        var overrides = new[]
        {
            new MatrixOverride(Role.STAFF, Permission.VIEW_REPORTING, true),
            new MatrixOverride(Role.MANAGER, Permission.MANAGE_PROJECTS, false),
        };
        PermissionRules.Effective(Role.STAFF, overrides).Should().Contain(Permission.VIEW_REPORTING);
        PermissionRules.Effective(Role.MANAGER, overrides).Should().NotContain(Permission.MANAGE_PROJECTS);
    }

    [Fact]
    public void l_admin_de_division_garde_toujours_l_administration()
    {
        var overrides = new[] { new MatrixOverride(Role.DIVISION_ADMIN, Permission.ADMINISTER_DIVISION, false) };
        PermissionRules.Effective(Role.DIVISION_ADMIN, overrides).Should().Contain(Permission.ADMINISTER_DIVISION);
    }

    [Fact]
    public void la_division_ignore_le_retrait_d_une_permission_verrouillee()
    {
        var division = Division.Create("Test", "test", "TEST", status: DivisionStatus.ACTIVE);
        division.SetPermission(Role.DIVISION_ADMIN, Permission.ADMINISTER_DIVISION, false);
        division.SetPermission(Role.STAFF, Permission.VIEW_REPORTING, true);
        division.Overrides.Should().ContainSingle().Which.Should().Be(new MatrixOverride(Role.STAFF, Permission.VIEW_REPORTING, true));
    }
}

public class UserTests
{
    [Fact]
    public void l_adresse_est_normalisee()
    {
        User.Create(Guid.NewGuid(), "  Aicha.Ndongo@Exemple.COM ", "Aïcha", "Ndongo", Role.STAFF).Email.Should().Be("aicha.ndongo@exemple.com");
    }

    [Fact]
    public void seul_l_admin_plateforme_est_sans_division()
    {
        var sansDivision = () => User.Create(null, "a@exemple.com", "A", "B", Role.STAFF);
        sansDivision.Should().Throw<ArgumentException>();
        var plateformeAvecDivision = () => User.Create(Guid.NewGuid(), "a@exemple.com", "A", "B", Role.PLATFORM_ADMIN);
        plateformeAvecDivision.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void un_nouveau_mot_de_passe_ferme_les_sessions()
    {
        var user = User.Create(Guid.NewGuid(), "a@exemple.com", "A", "B", Role.STAFF);
        var before = user.SessionVersion;
        user.SetPassword("$argon2id$…");
        user.SessionVersion.Should().Be(before + 1);
    }
}
