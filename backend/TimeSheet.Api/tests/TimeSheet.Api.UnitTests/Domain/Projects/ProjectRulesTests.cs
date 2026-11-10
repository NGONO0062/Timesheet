namespace TimeSheet.Api.UnitTests.Domain.Projects;

using TimeSheet.Api.Domain.Projects;

public class ProjectRulesTests
{
    private static ProjectInput Input(string? name = "Audit", DateOnly? start = null, DateOnly? end = null, string? status = "NOT_STARTED", int? budget = null, string[]? activities = null) =>
        new(name, start ?? new DateOnly(2026, 4, 6), end, status, budget, activities ?? ["Analyse"], []);

    [Fact]
    public void le_prochain_code_suit_le_dernier_de_l_annee()
    {
        ProjectRules.NextCode("CX", 2026, ["CX-2026-00", "CX-2026-06", "CX-2025-09", "AB-2026-12"]).Should().Be("CX-2026-07");
        ProjectRules.NextCode("CX", 2027, ["CX-2026-06"]).Should().Be("CX-2027-01");
        ProjectRules.Prefix("cx", "cx-expertise").Should().Be("CX");
        ProjectRules.Prefix(null, "boutiques").Should().Be("BOU");
    }

    [Fact]
    public void le_panneau_refuse_chaque_champ_invalide()
    {
        ProjectRules.Check(Input(name: "  ", start: null, activities: [" "])).Errors.Should().Contain(["name", "activities"]);
        ProjectRules.Check(Input(end: new DateOnly(2026, 4, 1))).Errors.Should().Equal("end");
        ProjectRules.Check(Input(budget: -1)).Errors.Should().Equal("budget");
        ProjectRules.Check(Input(status: "1")).Errors.Should().Equal("status");
        ProjectRules.Check(Input(status: "EN_COURS")).Errors.Should().Equal("status");
    }

    [Fact]
    public void une_saisie_valide_est_nettoyee()
    {
        var (value, errors) = ProjectRules.Check(Input(name: " Audit ", status: "IN_PROGRESS", budget: 30, activities: ["Analyse", " Analyse ", "Atelier"]));
        errors.Should().BeEmpty();
        value!.Name.Should().Be("Audit");
        value.Status.Should().Be(ProjectStatus.IN_PROGRESS);
        value.Activities.Should().Equal("Analyse", "Atelier");
    }

    [Fact]
    public void le_statut_ne_change_jamais_tout_seul()
    {
        var project = Project.Create(Guid.NewGuid(), "CX-2026-01", "Projet", new DateOnly(2026, 1, 5), new DateOnly(2026, 3, 27), 50, ProjectStatus.IN_PROGRESS, DateTimeOffset.UtcNow, null);
        project.EndDatePassed(new DateOnly(2026, 3, 27)).Should().BeFalse();
        project.EndDatePassed(new DateOnly(2026, 3, 30)).Should().BeTrue();
        project.Status.Should().Be(ProjectStatus.IN_PROGRESS);
        project.ChangeStatus(ProjectStatus.IN_PROGRESS, Guid.NewGuid(), DateTimeOffset.UtcNow).Should().BeFalse();
        project.ChangeStatus(ProjectStatus.DONE, Guid.NewGuid(), DateTimeOffset.UtcNow).Should().BeTrue();
        project.EndDatePassed(new DateOnly(2026, 3, 30)).Should().BeFalse();
    }
}
