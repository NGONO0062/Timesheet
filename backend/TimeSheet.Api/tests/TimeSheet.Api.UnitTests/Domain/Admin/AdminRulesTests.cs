namespace TimeSheet.Api.UnitTests.Domain.Admin;

using TimeSheet.Api.Domain.Access;
using TimeSheet.Api.Domain.Admin;
using TimeSheet.Api.Domain.Users;

public class AdminRulesTests
{
    private static readonly Guid Manager = Guid.NewGuid();

    private static UserInput User(string role = "STAFF", InternshipInput? internship = null, Guid? manager = null) =>
        new("nina@exemple.com", "Nina", "Invitée", role, manager, internship);

    [Fact]
    public void la_matrice_ne_garde_que_les_ecarts_et_la_permission_verrouillee_reste()
    {
        var matrix = AdminRules.MatrixOf([]);
        matrix[Role.STAFF].Should().Equal(Permission.ENTER_TIME);
        AdminRules.OverridesFor(matrix).Should().BeEmpty();

        var changed = new Dictionary<Role, Permission[]>(matrix)
        {
            [Role.STAFF] = [Permission.ENTER_TIME, Permission.VIEW_REPORTING],
            // Retirer la permission verrouillée n'a aucun effet.
            [Role.DIVISION_ADMIN] = [Permission.MANAGE_PROJECTS, Permission.VIEW_REPORTING, Permission.VIEW_DIVISION],
        };
        var overrides = AdminRules.OverridesFor(changed);
        overrides.Should().Equal(new MatrixOverride(Role.STAFF, Permission.VIEW_REPORTING, true));
        AdminRules.MatrixOf(overrides)[Role.DIVISION_ADMIN].Should().Contain(Permission.ADMINISTER_DIVISION);
    }

    [Fact]
    public void workflow_et_regles_de_saisie_sont_controles()
    {
        AdminRules.CheckWorkflow(new WorkflowInput("rh@exemple.cm", true, 3, true)).Should().BeEmpty();
        AdminRules.CheckWorkflow(new WorkflowInput("rh", true, 4, true)).Should().Equal("hrEmail", "reminder");

        AdminRules.CheckRules(new RulesInput(["MONDAY", "FRIDAY"], "FRIDAY", "18:00", "80", false, true)).Should().BeEmpty();
        AdminRules.CheckRules(new RulesInput([], "SUNDAY", "25:00", "101", false, true)).Should().Equal("workingDays", "deadline", "threshold");
        AdminRules.CheckRules(new RulesInput(["MONDAY"], "MONDAY", "09:00", "7,5", false, true)).Should().Equal("threshold");
    }

    [Fact]
    public void le_journal_dit_ce_qui_a_change_dans_les_regles()
    {
        var before = new RulesInput(["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"], "FRIDAY", "18:00", "80", false, true);
        var after = before with { WorkingDays = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY"], FillAlertThreshold = "70" };
        AdminRules.DescribeRules(before, after).Should().Equal("Jours ouvrés : Lun, Mar, Mer, Jeu", "Seuil d'alerte de remplissage : 70 %");
        AdminRules.DescribeRules(before, before).Should().BeEmpty();
    }

    [Fact]
    public void utilisateur_et_stage_sont_controles()
    {
        AdminRules.CheckUser(User(manager: Manager), [Manager]).Should().BeEmpty();
        AdminRules.CheckUser(new UserInput("x", " ", "", "PLATFORM_ADMIN", Guid.NewGuid(), null), [Manager]).Should().Equal("email", "firstName", "lastName", "role", "manager");
        // À la modification, l'adresse n'est pas revérifiée (elle ne change pas).
        AdminRules.CheckUser(new UserInput(null, "A", "B", "STAFF", null, null), [], checkEmail: false).Should().BeEmpty();

        var stage = new InternshipInput("PROFESSIONAL", "DEC", "CX", "Parcours", "05/01/2026", "26/06/2026");
        AdminRules.CheckUser(User(internship: stage), []).Should().BeEmpty();
        AdminRules.CheckUser(User("MANAGER", stage), []).Should().Equal("internRole");
        AdminRules.CheckUser(User(internship: stage with { Kind = "STAGE", Direction = "", End = "04/01/2026" }), []).Should().Equal("internKind", "internDirection", "internEnd");
        AdminRules.CheckUser(User(internship: stage with { Start = "2026-01-05" }), []).Should().Equal("internStart");
    }

    [Fact]
    public void pages_de_cinq_utilisateurs()
    {
        AdminRules.PageOf(21, 1).Should().Be(new PageInfo(1, 5, 1, 5, 0));
        AdminRules.PageOf(21, 5).Should().Be(new PageInfo(5, 5, 21, 21, 20));
        AdminRules.PageOf(21, 9).Page.Should().Be(5);
        AdminRules.PageOf(0, 1).Should().Be(new PageInfo(1, 1, 0, 0, 0));
    }

    [Fact]
    public void politique_du_mot_de_passe()
    {
        AdminRules.CheckNewPassword("court1", "court1").Should().Be("passwordRules");
        AdminRules.CheckNewPassword("sanschiffresici", "sanschiffresici").Should().Be("passwordRules");
        AdminRules.CheckNewPassword("Reglages-2026-neuf", "Reglages-2026-autre").Should().Be("passwordConfirm");
        AdminRules.CheckNewPassword("Reglages-2026-neuf", "Reglages-2026-neuf").Should().BeNull();
    }

    [Fact]
    public void lien_a_usage_unique_stocke_par_son_empreinte()
    {
        var now = DateTimeOffset.UtcNow;
        var (token, plain) = PasswordToken.Issue(Guid.NewGuid(), TokenKind.RESET, now);
        PasswordToken.LooksValid(plain).Should().BeTrue();
        token.TokenHash.Should().Be(PasswordToken.Digest(plain)).And.NotContain(plain);
        token.IsUsable(TokenKind.RESET, now.AddMinutes(59)).Should().BeTrue();
        token.IsUsable(TokenKind.RESET, now.AddMinutes(61)).Should().BeFalse();
        token.IsUsable(TokenKind.INVITATION, now).Should().BeFalse();
        token.Use(now);
        token.IsUsable(TokenKind.RESET, now).Should().BeFalse();
        PasswordToken.LooksValid("../../etc/passwd").Should().BeFalse();
    }

    [Fact]
    public void preferences_de_notification()
    {
        var user = TimeSheet.Api.Domain.Users.User.Create(Guid.NewGuid(), "a@exemple.com", "A", "B", Role.STAFF);
        user.Wants(NotificationKind.Validated).Should().BeTrue();
        user.SetNotification(NotificationKind.Validated, false).Should().BeTrue();
        user.Wants(NotificationKind.Validated).Should().BeFalse();
        user.Wants(NotificationKind.Rejected).Should().BeTrue();
    }
}
