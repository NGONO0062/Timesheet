namespace TimeSheet.Api.UnitTests.Domain.Projects;

using TimeSheet.Api.Domain.Projects;

/// <summary>Fiche projet : budget consommé, délai écoulé, points d'attention.</summary>
public class ProjectSheetRulesTests
{
    private static readonly DateOnly Start = new(2026, 1, 1);
    private static readonly DateOnly End = new(2026, 4, 10); // 100 jours, bornes comprises
    private static readonly DateOnly Day50 = new(2026, 2, 19);

    [Fact]
    public void la_part_du_budget_peut_depasser_100_et_n_existe_pas_sans_budget()
    {
        ProjectSheetRules.BudgetPercent(12, 30).Should().Be(40);
        ProjectSheetRules.BudgetPercent(33, 30).Should().Be(110);
        ProjectSheetRules.BudgetPercent(1, 3).Should().Be(33);
        ProjectSheetRules.BudgetPercent(5, null).Should().BeNull();
        ProjectSheetRules.BudgetPercent(5, 0).Should().BeNull();
    }

    [Fact]
    public void la_part_du_delai_va_de_0_a_100_et_n_existe_pas_sans_date_de_fin()
    {
        ProjectSheetRules.ElapsedPercent(Start, End, Day50).Should().Be(50);
        ProjectSheetRules.ElapsedPercent(Start, End, Start).Should().Be(1);
        ProjectSheetRules.ElapsedPercent(Start, End, Start.AddDays(-10)).Should().Be(0);
        ProjectSheetRules.ElapsedPercent(Start, End, End.AddDays(30)).Should().Be(100);
        ProjectSheetRules.ElapsedPercent(Start, null, Day50).Should().BeNull();
    }

    [Fact]
    public void un_projet_dans_les_clous_n_a_pas_de_point_d_attention()
    {
        // 50 % du délai, 55 % du budget, une journée la veille.
        ProjectSheetRules.Attention(ProjectStatus.IN_PROGRESS, 55, 100, Start, End, Day50, Day50.AddDays(-1)).Should().BeEmpty();
        // Sans budget ni date de fin, et une journée récente : rien à dire.
        ProjectSheetRules.Attention(ProjectStatus.IN_PROGRESS, 55, null, Start, null, Day50, Day50.AddDays(-1)).Should().BeEmpty();
    }

    [Fact]
    public void budget_depasse_date_de_fin_depassee_budget_en_avance_projet_sans_activite()
    {
        var recent = Day50.AddDays(-1);
        ProjectSheetRules.Attention(ProjectStatus.IN_PROGRESS, 101, 100, Start, End, Day50, recent).Should().Equal("overBudget");
        // 70 % du budget pour 50 % du délai : 20 points d'écart, le seuil.
        ProjectSheetRules.Attention(ProjectStatus.IN_PROGRESS, 70, 100, Start, End, Day50, recent).Should().Equal("budgetAhead");
        ProjectSheetRules.Attention(ProjectStatus.IN_PROGRESS, 69, 100, Start, End, Day50, recent).Should().BeEmpty();
        // Date de fin dépassée : le délai est à 100 %, on ne parle plus d'avance.
        ProjectSheetRules.Attention(ProjectStatus.IN_PROGRESS, 60, 100, Start, End, End.AddDays(1), End).Should().Equal("endPassed");
        // Aucune journée depuis trois semaines, ou jamais depuis le début.
        ProjectSheetRules.Attention(ProjectStatus.IN_PROGRESS, 40, 100, Start, End, Day50, Day50.AddDays(-21)).Should().Equal("quiet");
        ProjectSheetRules.Attention(ProjectStatus.IN_PROGRESS, 40, 100, Start, End, Day50, Day50.AddDays(-20)).Should().BeEmpty();
        ProjectSheetRules.Attention(ProjectStatus.IN_PROGRESS, 0, 100, Start, End, Start.AddDays(21), null).Should().Equal("quiet");
        // Tout à la fois, du plus grave au moins grave.
        ProjectSheetRules.Attention(ProjectStatus.IN_PROGRESS, 120, 100, Start, End, End.AddDays(30), End.AddDays(-5)).Should().Equal("overBudget", "endPassed", "quiet");
    }

    [Fact]
    public void un_projet_qui_n_est_pas_en_cours_ne_garde_que_le_budget_depasse()
    {
        foreach (var status in new[] { ProjectStatus.NOT_STARTED, ProjectStatus.ON_HOLD, ProjectStatus.DONE })
        {
            ProjectSheetRules.Attention(status, 70, 100, Start, End, End.AddDays(30), null).Should().BeEmpty();
            ProjectSheetRules.Attention(status, 120, 100, Start, End, End.AddDays(30), null).Should().Equal("overBudget");
        }
    }
}
