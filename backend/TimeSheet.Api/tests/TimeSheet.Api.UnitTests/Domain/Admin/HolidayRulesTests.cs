namespace TimeSheet.Api.UnitTests.Domain.Admin;

using TimeSheet.Api.Domain.Admin;

/// <summary>Jours fériés d'une division (écran 12, bloc « Jours fériés »).</summary>
public class HolidayRulesTests
{
    [Fact]
    public void la_date_se_saisit_en_jj_mm_aaaa_et_doit_exister()
    {
        HolidayRules.ParseDate("01/05/2026").Should().Be(new DateOnly(2026, 5, 1));
        HolidayRules.ParseDate(" 1/5/2026 ").Should().Be(new DateOnly(2026, 5, 1));
        HolidayRules.ParseDate("29/02/2028").Should().Be(new DateOnly(2028, 2, 29));
        HolidayRules.ParseDate("29/02/2026").Should().BeNull();
        HolidayRules.ParseDate("2026-05-01").Should().BeNull();
        HolidayRules.ParseDate("01/05/1999").Should().BeNull();
        HolidayRules.ParseDate("01/05/2101").Should().BeNull();
        HolidayRules.ParseDate(null).Should().BeNull();
    }

    [Fact]
    public void le_libelle_est_nettoye_et_limite_a_80_caracteres()
    {
        HolidayRules.CleanLabel("  Fête   du Travail ").Should().Be("Fête du Travail");
        HolidayRules.CleanLabel("   ").Should().BeNull();
        HolidayRules.CleanLabel(null).Should().BeNull();
        HolidayRules.CleanLabel(new string('a', 80)).Should().HaveLength(80);
        HolidayRules.CleanLabel(new string('a', 81)).Should().BeNull();
    }

    [Fact]
    public void les_champs_en_erreur_sont_nommes()
    {
        HolidayRules.Check(new HolidayInput("01/05/2026", "Fête du Travail")).Should().BeEmpty();
        HolidayRules.Check(new HolidayInput("31/04/2026", "")).Should().Equal("holidayDate", "holidayLabel");
        HolidayRules.Check(new HolidayInput("01/05/2026", " ")).Should().Equal("holidayLabel");
    }

    [Fact]
    public void les_annees_proposees_sont_celles_des_jours_feries_l_annee_en_cours_et_la_suivante()
    {
        HolidayRules.Years([], 2026).Should().Equal(2026, 2027);
        HolidayRules.Years([new DateOnly(2025, 12, 25), new DateOnly(2026, 1, 1), new DateOnly(2029, 5, 1)], 2026).Should().Equal(2025, 2026, 2027, 2029);
    }
}
