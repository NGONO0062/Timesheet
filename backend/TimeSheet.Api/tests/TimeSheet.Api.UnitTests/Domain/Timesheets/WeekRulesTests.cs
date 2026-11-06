namespace TimeSheet.Api.UnitTests.Domain.Timesheets;

using TimeSheet.Api.Domain.Timesheets;

public class WeekRulesTests
{
    private static readonly IsoWeek W12 = new(2026, 12);

    [Fact]
    public void la_semaine_12_de_2026_commence_le_lundi_16_mars()
    {
        W12.Monday.Should().Be(new DateOnly(2026, 3, 16));
        W12.Shift(-1).Should().Be(new IsoWeek(2026, 11));
        new IsoWeek(2026, 1).Shift(-1).Should().Be(new IsoWeek(2025, 1).Shift(51));
    }

    [Fact]
    public void la_semaine_courante_se_lit_a_douala()
    {
        // Dimanche 22 mars, 23:30 UTC : déjà lundi 23 à Douala (semaine 13).
        WeekRules.CurrentWeek(new DateTimeOffset(2026, 3, 22, 23, 30, 0, TimeSpan.Zero)).Should().Be(new IsoWeek(2026, 13));
    }

    [Fact]
    public void l_echeance_du_vendredi_18h_a_douala()
    {
        WeekRules.Deadline(W12, DayOfWeek.Friday, "18:00").Should().Be(new DateTimeOffset(2026, 3, 20, 17, 0, 0, TimeSpan.Zero));
        // Lundi : l'échéance tombe la semaine d'après.
        WeekRules.Deadline(W12, DayOfWeek.Monday, "09:00").Should().Be(new DateTimeOffset(2026, 3, 23, 8, 0, 0, TimeSpan.Zero));
    }

    [Fact]
    public void manquante_apres_l_echeance_si_absente_ou_en_brouillon()
    {
        var deadline = WeekRules.Deadline(W12, DayOfWeek.Friday, "18:00");
        var after = deadline.AddMinutes(1);
        WeekRules.Display(null, deadline, after).Should().Be(DisplayStatus.MISSING);
        WeekRules.Display(TimesheetStatus.DRAFT, deadline, after).Should().Be(DisplayStatus.MISSING);
        WeekRules.Display(TimesheetStatus.SUBMITTED, deadline, after).Should().Be(DisplayStatus.SUBMITTED);
        WeekRules.Display(null, deadline, deadline.AddMinutes(-1)).Should().Be(DisplayStatus.DRAFT);
    }

    [Fact]
    public void modifiable_en_brouillon_et_apres_rejet_seulement()
    {
        WeekRules.IsEditable(TimesheetStatus.DRAFT, true).Should().BeTrue();
        WeekRules.IsEditable(TimesheetStatus.REJECTED, true).Should().BeTrue();
        WeekRules.IsEditable(TimesheetStatus.SUBMITTED, false).Should().BeFalse();
        WeekRules.IsEditable(TimesheetStatus.VALIDATED, true).Should().BeFalse();
        WeekRules.IsEditable(TimesheetStatus.VALIDATED, false).Should().BeTrue();
    }

    [Fact]
    public void jours_ouvres_selon_la_division()
    {
        WeekRules.WorkingDays(W12, [DayOfWeek.Monday, DayOfWeek.Friday]).Should().Equal(new DateOnly(2026, 3, 16), new DateOnly(2026, 3, 20));
    }

    [Fact]
    public void une_nouvelle_soumission_efface_les_signalements()
    {
        var sheet = Timesheet.Create(Guid.NewGuid(), Guid.NewGuid(), W12, DateTimeOffset.UtcNow);
        var activity = Guid.NewGuid();
        var days = Enumerable.Range(0, 5).ToDictionary(i => W12.Monday.AddDays(i), _ => activity);
        sheet.SaveDraft(days, null, DateTimeOffset.UtcNow);
        sheet.Submit(sheet.UserId, DateTimeOffset.UtcNow);
        sheet.Reject(Guid.NewGuid(), DateTimeOffset.UtcNow, "Motif", [W12.Monday.AddDays(3)]);
        sheet.Days.Count(d => d.Flagged).Should().Be(1);

        // Le signalement reste au brouillon suivant, puis tombe à la soumission.
        sheet.SaveDraft(days, null, DateTimeOffset.UtcNow);
        sheet.Days.Count(d => d.Flagged).Should().Be(1);
        sheet.Submit(sheet.UserId, DateTimeOffset.UtcNow);
        sheet.Days.Should().NotContain(d => d.Flagged);
        sheet.SubmissionCount.Should().Be(2);
    }
}
