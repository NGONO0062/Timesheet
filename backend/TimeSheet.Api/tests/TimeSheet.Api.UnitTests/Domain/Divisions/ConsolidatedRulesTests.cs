namespace TimeSheet.Api.UnitTests.Domain.Divisions;

using TimeSheet.Api.Domain.Divisions;
using TimeSheet.Api.Domain.Timesheets;

public class ConsolidatedRulesTests
{
    private static readonly IsoWeek W11 = new(2026, 11), W12 = new(2026, 12);
    private static readonly TeamInfo Parcours = new(Guid.NewGuid(), "Parcours", Guid.NewGuid(), "Samuel Etoga");
    private static readonly TeamInfo Data = new(Guid.NewGuid(), "Data CX", Guid.NewGuid(), "Olivier Manga");
    private static readonly Member Ana = new(Guid.NewGuid(), "Ana", Parcours.Id, Parcours.ManagerId, "Samuel Etoga");
    private static readonly Member Ben = new(Guid.NewGuid(), "Ben", Parcours.Id, Parcours.ManagerId, "Samuel Etoga");
    private static readonly Member Carl = new(Guid.NewGuid(), "Carl", Data.Id, Data.ManagerId, "Olivier Manga");
    private static readonly Member Dan = new(Guid.NewGuid(), "Dan", null, null, null);

    [Fact]
    public void le_tableau_trie_les_equipes_et_compte_les_personnes_sans_equipe()
    {
        var states = new[]
        {
            new PersonWeek(Ana.Id, W12, 5, TimesheetStatus.VALIDATED),
            new PersonWeek(Ben.Id, W12, 4, TimesheetStatus.SUBMITTED),
            new PersonWeek(Carl.Id, W12, 2, TimesheetStatus.DRAFT),
            new PersonWeek(Ana.Id, W11, 5, TimesheetStatus.VALIDATED),
        };
        var (rows, total) = ConsolidatedRules.TeamTable([Data, Parcours], [Ana, Ben, Carl, Dan], states, W12, 5, 80);
        rows.Select(r => (r.Name, r.Persons, r.Entered, r.Fill, r.Submitted, r.Validated, r.Under)).Should().Equal(
            ("Parcours", 2, 9, 90, 2, 1, false),
            ("Data CX", 1, 2, 40, 0, 0, true),
            ("Sans équipe", 1, 0, 0, 0, 0, true));
        (total.Persons, total.Entered, total.Capacity, total.Fill).Should().Be((4, 11, 20, 55));
    }

    [Fact]
    public void la_tendance_evide_la_semaine_courante()
    {
        var states = new[] { new PersonWeek(Ana.Id, W11, 5, TimesheetStatus.VALIDATED), new PersonWeek(Ana.Id, W12, 2, TimesheetStatus.DRAFT) };
        ConsolidatedRules.Trend([W11, W12], states, 2, [5, 5], W12).Should().Equal(new TrendPoint(2026, 11, 50, false), new TrendPoint(2026, 12, 20, true));
    }

    [Fact]
    public void les_derives_suivent_l_ordre_de_la_planche()
    {
        var project = Guid.NewGuid();
        var rows = new[] { new TeamRow(Data.Id.ToString(), "Data CX", "Olivier Manga", 4, 12, 20, 60, 3, 0, true), new TeamRow(ConsolidatedRules.NoTeam, "Sans équipe", null, 1, 0, 5, 0, 0, 0, true) };
        var deadline = new DateTimeOffset(2026, 3, 13, 17, 0, 0, TimeSpan.Zero);
        var drifts = ConsolidatedRules.Sort(
            ConsolidatedRules.MissingDrifts([Ana, Ben], [new PersonWeek(Ana.Id, W11, 2, TimesheetStatus.DRAFT), new PersonWeek(Ben.Id, W11, 5, TimesheetStatus.SUBMITTED)], [W11], [5], [deadline], deadline.AddDays(1))
                .Concat(ConsolidatedRules.LateDrifts([(Data.ManagerId!.Value, "Olivier Manga", "Data CX", true), (Data.ManagerId.Value, "Olivier Manga", "Data CX", true), (Parcours.ManagerId!.Value, "Samuel Etoga", "Parcours", false)], 3))
                .Concat(ConsolidatedRules.UnderfillDrifts(rows, W12, 80))
                .Concat(ConsolidatedRules.BudgetDrifts([(project, "Baromètre", 99, 50, "Samuel Etoga"), (Guid.NewGuid(), "Veille", 10, 20, null)])));

        drifts.Select(d => (d.Kind, d.Label)).Should().Equal(("BUDGET", "Baromètre"), ("UNDERFILL", "Data CX"), ("LATE_VALIDATION", "Data CX"), ("MISSING", "Ana"));
        drifts[0].Consumed.Should().Be(99);
        drifts[2].Count.Should().Be(2);
        drifts[3].Missing.Should().Be(3);
        ConsolidatedRules.FillRate(7, 8).Should().Be(88);
        ConsolidatedRules.FillRate(5, 0).Should().Be(0);
    }
}
