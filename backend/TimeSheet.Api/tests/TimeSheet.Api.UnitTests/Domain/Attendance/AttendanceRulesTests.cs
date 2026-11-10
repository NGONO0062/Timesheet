namespace TimeSheet.Api.UnitTests.Domain.Attendance;

using TimeSheet.Api.Domain.Access;
using TimeSheet.Api.Domain.Attendance;
using TimeSheet.Api.Domain.Timesheets;

public class AttendanceRulesTests
{
    private static readonly Internship Stage = Internship.Create(Guid.NewGuid(), InternshipKind.PROFESSIONAL, "DEC", "CX", "CX Expertise", new DateOnly(2026, 1, 5), new DateOnly(2026, 6, 26));

    [Fact]
    public void fevrier_2026_compte_quatre_semaines_et_janvier_ignore_la_semaine_d_avant_le_stage()
    {
        AttendanceRules.MondaysOfMonth(2026, 2).Should().Equal(new DateOnly(2026, 2, 2), new DateOnly(2026, 2, 9), new DateOnly(2026, 2, 16), new DateOnly(2026, 2, 23));
        // Le lundi 29 décembre 2025 ouvre une semaine qui touche janvier, mais le stage commence le 5.
        AttendanceRules.WeeksOfMonth(2026, 1).Should().HaveCount(5);
        AttendanceRules.WeeksOfMonth(2026, 1, Stage.StartDate, Stage.EndDate).Should().Equal(Enumerable.Range(2, 4).Select(w => new IsoWeek(2026, w)));
        // Semaine 14 (30 mars – 3 avril) : à cheval sur deux mois.
        AttendanceRules.MonthsOfWeek(new IsoWeek(2026, 14)).Should().Equal((2026, 3), (2026, 4));
        AttendanceRules.MonthLabel(2026, 2).Should().Be("Février 2026");
    }

    [Fact]
    public void la_feuille_imprime_les_horaires_habituels_et_compte_les_absences()
    {
        var days = new[] { new DayEntry(new DateOnly(2026, 2, 2), false), new DayEntry(new DateOnly(2026, 2, 13), true) };
        var m = AttendanceRules.Build(2026, 2, "Aïcha", "Ndongo", Stage, "08:30", "17:30", days, null);
        m.Name.Should().Be("NDONGO Aïcha");
        (m.From, m.To).Should().Be(("05/01/2026", "26/06/2026"));
        m.Blocks.Should().HaveCount(6);
        m.Blocks.Count(b => b.Used).Should().Be(4);
        m.Blocks[0].Rows[0].Should().Be(new SheetRow("Lundi 02/02", "08:30", "17:30"));
        m.Blocks[0].Rows[1].Should().Be(new SheetRow("Mardi 03/02", "", ""));
        m.Blocks[1].Rows[4].Should().Be(new SheetRow("Vendredi 13/02", "", ""));
        m.AbsenceDays.Should().Be(1);
        m.Blocks[5].Rows[2].Label.Should().Be("Mercredi ........");
        m.Blocks[5].Rows[0].Label.Should().Be("Lundi ............");
    }

    [Fact]
    public void un_jour_d_un_autre_mois_reste_vide_sur_la_fiche()
    {
        // Mars 2026 commence un dimanche ; avril 2026 commence un mercredi : la semaine du 30 mars est partagée.
        var april = AttendanceRules.Build(2026, 4, "A", "B", Stage, "08:00", "17:00", [new DayEntry(new DateOnly(2026, 3, 30), false)], null);
        april.Blocks[0].Rows[0].Label.Should().Be("Lundi ............");
        april.Blocks[0].Rows[2].Label.Should().Be("Mercredi 01/04");
    }

    [Fact]
    public void noms_de_fichier_et_numero_sans_accent()
    {
        AttendanceRules.FileName(2026, 2, "Ndongo").Should().Be("Fiche_presence_2026-02_NDONGO.pdf");
        AttendanceRules.FileName(2026, 11, "Bikoï").Should().Be("Fiche_presence_2026-11_BIKOI.pdf");
        AttendanceRules.Number(2026, 2, "Mbarga Owona").Should().Be("FP-2026-02-MBARGA-OWONA");
    }

    [Fact]
    public void seul_un_trace_de_la_zone_de_signature_est_accepte()
    {
        AttendanceRules.IsDrawing("M 10 20 L 30 40 L -5 60").Should().BeTrue();
        AttendanceRules.IsDrawing("").Should().BeFalse();
        AttendanceRules.IsDrawing("M 10 20 L 30").Should().BeFalse();
        AttendanceRules.IsDrawing("M 10 20 C 30 40").Should().BeFalse();
        AttendanceRules.IsDrawing("M 10 20 L 30 40\"/><script>").Should().BeFalse();
    }

    [Fact]
    public void le_renvoi_annule_la_signature_du_stagiaire_sans_la_supprimer()
    {
        var sheet = AttendanceSheet.Generate(Guid.NewGuid(), Guid.NewGuid(), 2026, 2, DateTimeOffset.UtcNow);
        sheet.SignAsIntern(sheet.UserId, SignatureMethod.PASSWORD, null, "abc", DateTimeOffset.UtcNow, null, null);
        sheet.Status.Should().Be(AttendanceStatus.SIGNED_BY_INTERN);
        sheet.Reject("Le 13 février était un jour d'absence.", DateTimeOffset.UtcNow);
        sheet.Status.Should().Be(AttendanceStatus.GENERATED);
        sheet.Signatures.Should().ContainSingle(s => s.CancelledAt != null);
        sheet.InternSignature.Should().BeNull();
        sheet.SignAsIntern(sheet.UserId, SignatureMethod.DRAWN, "M 1 1 L 2 2", "def", DateTimeOffset.UtcNow, null, null);
        sheet.RejectionReason.Should().BeNull();
        sheet.SignAsSupervisor(Guid.NewGuid(), Role.MANAGER, SignatureMethod.PASSWORD, null, "RAS", "x.pdf", "123", DateTimeOffset.UtcNow, null, null);
        sheet.SupervisorSignature!.SignerRole.Should().Be(Role.MANAGER);
        sheet.MarkSent("rh@exemple.com", DateTimeOffset.UtcNow);
        sheet.Status.Should().Be(AttendanceStatus.SENT);
        var again = () => sheet.SignAsIntern(sheet.UserId, SignatureMethod.DRAWN, "M 1 1 L 2 2", "x", DateTimeOffset.UtcNow, null, null);
        again.Should().Throw<InvalidOperationException>();
    }

    [Fact]
    public void le_gabarit_est_le_modele_papier_et_echappe_le_contenu()
    {
        var m = AttendanceRules.Build(2026, 2, "Aïcha", "Ndongo", Stage, "08:00", "17:00", [], "<b>Assidue</b>");
        var html = SheetHtml.Document(m, new SheetMeta("CX Expertise", "FP-2026-02-NDONGO", "09/03/2026", "février 2026"), new PrintedSignature("Samuel Etoga", "M 1 1 L 9 9", "signé le 20 mars 2026"), "Fiche");
        html.Should().Contain("FICHE DE PRESENCE STAGIAIRE").And.Contain("OCM/PS-01/SE/049 · Version 1.0").And.Contain("15/06/2023");
        html.Should().Contain("aria-label=\"coché\"").And.Contain("Samuel Etoga").And.Contain("Page 1/1");
        html.Should().Contain("&lt;b&gt;Assidue&lt;/b&gt;").And.NotContain("<b>Assidue</b>");
        System.Text.RegularExpressions.Regex.Matches(html, "aria-label=\"non coché\"").Should().HaveCount(2);
    }
}
