namespace TimeSheet.Api.UnitTests.Domain.Platform;

using TimeSheet.Api.Domain.Platform;

public class PlatformRulesTests
{
    [Fact]
    public void l_identifiant_est_propose_a_partir_du_nom()
    {
        PlatformRules.Slugify("Relation client B2B").Should().Be("relation-client-b2b");
        PlatformRules.Slugify("Division créée e2e").Should().Be("division-creee-e2e");
        PlatformRules.Slugify("  Expérience — boutiques !  ").Should().Be("experience-boutiques");
        PlatformRules.IsSlug("cx-expertise").Should().BeTrue();
        PlatformRules.IsSlug("ab").Should().BeFalse();
        PlatformRules.IsSlug("Avec-Majuscules").Should().BeFalse();
        PlatformRules.IsSlug("double--tiret").Should().BeFalse();
        PlatformRules.IsSlug("-debut").Should().BeFalse();
    }

    [Fact]
    public void identite_et_administrateur_sont_controles()
    {
        PlatformRules.CheckIdentity(new IdentityInput("Division", "division-x", "DEC")).Should().BeEmpty();
        PlatformRules.CheckIdentity(new IdentityInput(" ", "X", "")).Should().Equal("name", "slug", "direction");
        PlatformRules.SplitName("Nadia  Nouvelle Mbarga").Should().Be(("Nadia", "Nouvelle Mbarga"));
        PlatformRules.SplitName("Nadia").Should().BeNull();
        PlatformRules.CheckAdmin(new OnboardingAdminInput("Nadia Nouvelle", "nadia@exemple.com", "COPY")).Should().BeEmpty();
        PlatformRules.CheckAdmin(new OnboardingAdminInput("Nadia", "nadia", "AUTRE")).Should().Equal("fullName", "email", "config");
    }

    [Fact]
    public void le_journal_couvre_la_semaine_en_cours_par_defaut()
    {
        var thursday = new DateOnly(2026, 3, 19);
        PlatformRules.DefaultPeriod(thursday).Should().Be((new DateOnly(2026, 3, 16), new DateOnly(2026, 3, 20)));
        PlatformRules.DefaultPeriod(new DateOnly(2026, 3, 22)).Should().Be((new DateOnly(2026, 3, 16), new DateOnly(2026, 3, 22)));

        var (f, errors) = PlatformRules.ParseFilters(new AuditParams(null, "RULES", null, null, " seuil ", 0), thursday);
        errors.Should().BeEmpty();
        (f.FromText, f.ToText, f.Category, f.Q, f.Page).Should().Be(("16/03/2026", "20/03/2026", "RULES", "seuil", 1));
        // Jours de Douala (UTC+1) : du lundi 00:00 au samedi 00:00.
        f.From.Should().Be(new DateTimeOffset(2026, 3, 15, 23, 0, 0, TimeSpan.Zero));
        f.To.Should().Be(new DateTimeOffset(2026, 3, 20, 23, 0, 0, TimeSpan.Zero));
        PlatformRules.FileName(f).Should().Be("Journal_audit_2026-03-16_2026-03-20");

        var (bad, badErrors) = PlatformRules.ParseFilters(new AuditParams(null, "INCONNU", "31/02/2026", "20/03/2026", null, 2), thursday);
        badErrors.Should().ContainKey("from").WhoseValue.Should().Be("date");
        (bad.FromText, bad.Category).Should().Be(("31/02/2026", null));
        bad.From.Should().Be(f.From);
        PlatformRules.ParseFilters(new AuditParams(null, null, "20/03/2026", "16/03/2026", null, 1), thursday).Errors["to"].Should().Be("order");
    }

    [Fact]
    public void chaque_action_du_catalogue_a_son_libelle()
    {
        PlatformRules.Categories.Values.SelectMany(a => a).Should().OnlyContain(a => PlatformRules.ActionLabels.ContainsKey(a));
        PlatformRules.ActionLabel("TIMESHEET_SUBMITTED").Should().Be("Soumission de fiche");
    }
}
