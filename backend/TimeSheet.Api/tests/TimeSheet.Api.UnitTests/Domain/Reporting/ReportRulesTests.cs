namespace TimeSheet.Api.UnitTests.Domain.Reporting;

using System.IO.Compression;
using System.Text;
using TimeSheet.Api.Domain.Reporting;
using TimeSheet.Api.Domain.Timesheets;
using TimeSheet.Api.Services.Export;
using TimeSheet.Api.Services.Mail;

public class ReportRulesTests
{
    private static readonly IsoWeek W10 = new(2026, 10), W11 = new(2026, 11), W12 = new(2026, 12);
    private static readonly ReportPerson Ana = new(Guid.NewGuid(), "Ana Essai", "Parcours"), Ben = new(Guid.NewGuid(), "Ben Essai", null);
    private static readonly Guid P1 = Guid.NewGuid(), P2 = Guid.NewGuid();

    private static ReportEntry E(IsoWeek w, ReportPerson p, Guid project, string activity) =>
        new(w, p.Id, project, project == P1 ? "CX-01" : "CX-02", project == P1 ? "Refonte" : "Baromètre", activity);

    [Fact]
    public void la_periode_par_defaut_couvre_trois_semaines_et_se_remet_dans_l_ordre()
    {
        ReportRules.Period(null, null, W12).Should().Be((W10, W12));
        ReportRules.Period("2026-12", "2026-10", W12).Should().Be((W10, W12));
        ReportRules.Period("2026-60", "x", W12).Should().Be((W10, W12));
        ReportRules.WeeksBetween(W10, W12).Should().Equal(W10, W11, W12);
        ReportRules.ParseAxis("person").Should().Be(ReportAxis.person);
        ReportRules.ParseAxis("1").Should().Be(ReportAxis.project);
    }

    [Fact]
    public void les_jours_se_regroupent_par_projet_personne_ou_activite()
    {
        var entries = new[] { E(W10, Ana, P1, "Atelier"), E(W10, Ana, P1, "Atelier"), E(W11, Ben, P1, "Analyse"), E(W11, Ben, P2, "Analyse") };
        var weeks = new[] { W10, W11 };
        var members = new Dictionary<Guid, int> { [P1] = 4, [P2] = 3 };

        var projects = ReportRules.Group(ReportAxis.project, entries, weeks, [Ana, Ben], members);
        projects.Select(p => (p.Label, p.Sub, p.Count, p.Total)).Should().Equal(("Refonte", "CX-01", 4, 3), ("Baromètre", "CX-02", 3, 1));
        projects[0].ByWeek.Should().Equal(2, 1);

        ReportRules.Group(ReportAxis.person, entries, weeks, [Ana, Ben], members).Select(p => (p.Label, p.Sub)).Should().Equal(("Ana Essai", "Parcours"), ("Ben Essai", ""));
        var activities = ReportRules.Group(ReportAxis.activity, entries, weeks, [Ana, Ben], members);
        activities.Select(a => (a.Label, a.Count, a.Total)).Should().Equal(("Analyse", 2, 2), ("Atelier", 1, 2));
    }

    [Fact]
    public void au_dela_de_quatre_entites_les_suivantes_forment_autres()
    {
        var entities = Enumerable.Range(1, 6).Select(i => new ReportEntity($"k{i}", $"Projet {i}", "", 0, [i], i)).ToList();
        var series = ReportRules.AssignSeries(entities);
        series.Select(s => (s.Label, s.Index)).Should().Equal(("Projet 6", 0), ("Projet 5", 1), ("Projet 4", 2), ("Autres", 3));
        series[3].Keys.Should().BeEquivalentTo(["k3", "k2", "k1"]);
        ReportRules.AssignSeries(entities.Take(2).ToList()).Select(s => s.Index).Should().Equal(0, 1);
    }

    [Fact]
    public void les_indicateurs_comptent_capacite_fiches_et_manques()
    {
        var sheets = new[] { new SheetState(Ana.Id, W10, DisplayStatus.VALIDATED), new SheetState(Ana.Id, W11, DisplayStatus.SUBMITTED), new SheetState(Ben.Id, W10, DisplayStatus.MISSING), new SheetState(Ben.Id, W11, DisplayStatus.DRAFT) };
        ReportRules.Kpis(14, sheets, 2, [5, 4]).Should().Be(new ReportKpis(14, 18, 2, 2, 4, 1, 1, 1, 4));
    }

    [Fact]
    public void le_csv_suit_l_usage_d_excel_en_francais()
    {
        var csv = Encoding.UTF8.GetString(TableExport.Csv([["Projet", "Part"], ["Refonte; souscription", 41.9m], ["Total", null]]));
        csv.Should().Be("﻿Projet;Part\r\n\"Refonte; souscription\";41,9\r\nTotal;\r\n");
        TableExport.Column(0).Should().Be("A");
        TableExport.Column(26).Should().Be("AA");
    }

    [Fact]
    public void le_classeur_s_ouvre_par_le_mot_timesheet()
    {
        var bytes = TableExport.Xlsx("Reporting", [["Projet", "Total"], ["Refonte", 12]]);
        using var zip = new ZipArchive(new MemoryStream(bytes));
        using var reader = new StreamReader(zip.GetEntry("xl/worksheets/sheet1.xml")!.Open());
        var sheet = reader.ReadToEnd();
        sheet.Should().Contain("<t>Time</t>").And.Contain("<c r=\"A3\" t=\"inlineStr\" s=\"1\"><is><t xml:space=\"preserve\">Projet</t>").And.Contain("<c r=\"B4\"><v>12</v></c>");
    }

    [Fact]
    public void les_periodes_et_les_parts_s_ecrivent_comme_a_l_ecran()
    {
        FrenchFormat.FromTo(new DateOnly(2026, 3, 2), new DateOnly(2026, 3, 20)).Should().Be("Du 2 au 20 mars 2026");
        FrenchFormat.FromTo(new DateOnly(2026, 2, 23), new DateOnly(2026, 3, 6)).Should().Be("Du 23 février au 6 mars 2026");
        FrenchFormat.Share(268, 640).Should().Be("41,9 %");
        FrenchFormat.Share(640, 640).Should().Be("100 %");
        DocumentHtml.Number("RPT", new DateTimeOffset(2026, 10, 12, 14, 42, 0, TimeSpan.Zero)).Should().Be("RPT-20261012-1542");
    }
}
