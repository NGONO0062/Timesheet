namespace TimeSheet.Api.UnitTests.Domain.Timesheets;

using TimeSheet.Api.Domain.Timesheets;
using TimeSheet.Api.Services.Mail;

public class ValidationRulesTests
{
    private static readonly IsoWeek W12 = new(2026, 12);
    private static readonly DayOfWeek[] Week = [DayOfWeek.Monday, DayOfWeek.Tuesday, DayOfWeek.Wednesday, DayOfWeek.Thursday, DayOfWeek.Friday];
    private static readonly HashSet<DateOnly> NoHoliday = [];

    [Fact]
    public void la_periode_par_defaut_couvre_les_quatre_dernieres_semaines()
    {
        ValidationRules.PeriodWeeks(null, W12).Should().Equal(new IsoWeek(2026, 12), new IsoWeek(2026, 11), new IsoWeek(2026, 10), new IsoWeek(2026, 9));
        ValidationRules.PeriodWeeks("inconnue", W12).Should().HaveCount(4);
        ValidationRules.PeriodWeeks("s-2026-60", W12).Should().HaveCount(4, "une semaine qui n'existe pas vaut la période par défaut");
    }

    [Fact]
    public void une_semaine_un_mois_ou_toutes_les_periodes()
    {
        ValidationRules.PeriodWeeks("s-2026-11", W12).Should().Equal(new IsoWeek(2026, 11));
        ValidationRules.PeriodWeeks("tout", W12).Should().BeNull();
        // Mars 2026 : lundis 2, 9, 16, 23 et 30 (semaines 10 à 14).
        ValidationRules.PeriodWeeks("m-2026-3", W12).Should().Equal(Enumerable.Range(10, 5).Select(w => new IsoWeek(2026, w)));
    }

    [Fact]
    public void une_semaine_appartient_au_mois_de_son_lundi()
    {
        // Le lundi 29 décembre 2025 ouvre la semaine 1 de 2026 : elle est en décembre.
        ValidationRules.WeeksOfMonth(2025, 12).Should().Contain(new IsoWeek(2026, 1));
        ValidationRules.WeeksOfMonth(2026, 1).Should().NotContain(new IsoWeek(2026, 1));
    }

    [Fact]
    public void les_jours_ouvres_sautent_le_week_end_et_les_feries()
    {
        var friday = new DateOnly(2026, 3, 20);
        ValidationRules.AddWorkingDays(friday, 1, Week, NoHoliday).Should().Be(new DateOnly(2026, 3, 23));
        ValidationRules.AddWorkingDays(friday, 3, Week, new HashSet<DateOnly> { new(2026, 3, 24) }).Should().Be(new DateOnly(2026, 3, 26));
    }

    [Fact]
    public void la_relance_part_apres_trois_jours_ouvres_revolus_une_seule_fois()
    {
        var submitted = new DateOnly(2026, 3, 20); // vendredi ; 3e jour ouvré après : mercredi 25
        ValidationRules.ReminderDue(submitted, new DateOnly(2026, 3, 25), 3, Week, NoHoliday, alreadyReminded: false).Should().BeFalse();
        ValidationRules.ReminderDue(submitted, new DateOnly(2026, 3, 26), 3, Week, NoHoliday, alreadyReminded: false).Should().BeTrue();
        ValidationRules.ReminderDue(submitted, new DateOnly(2026, 3, 26), 3, Week, NoHoliday, alreadyReminded: true).Should().BeFalse();
    }

    [Fact]
    public void la_relance_est_tracee_et_ne_repart_pas_avant_une_nouvelle_soumission()
    {
        var at = new DateTimeOffset(2026, 3, 20, 15, 0, 0, TimeSpan.Zero);
        var sheet = Timesheet.Create(Guid.NewGuid(), Guid.NewGuid(), W12, at);
        sheet.SaveDraft(new Dictionary<DateOnly, Guid> { [W12.Monday] = Guid.NewGuid() }, null, at);
        sheet.Submit(sheet.UserId, at);
        sheet.RemindedThisStage.Should().BeFalse();
        sheet.RecordReminder(Guid.NewGuid(), at.AddDays(5));
        sheet.RemindedThisStage.Should().BeTrue();
        sheet.Reject(Guid.NewGuid(), at.AddDays(6), "Motif", []);
        sheet.Submit(sheet.UserId, at.AddDays(7));
        sheet.RemindedThisStage.Should().BeFalse();
    }

    [Fact]
    public void en_circuit_a_deux_etapes_chaque_fiche_va_au_bon_validateur()
    {
        // Circuit à une étape : le manager et l'owner décident de toute fiche en attente de leur portée.
        ValidationRules.Actionable(viewerIsOwner: false, ownerValidation: false, approvedByManager: false, ownerIsValidator: false).Should().BeTrue();
        ValidationRules.Actionable(viewerIsOwner: true, ownerValidation: false, approvedByManager: false, ownerIsValidator: false).Should().BeTrue();
        // Deux étapes : avant la validation du manager, l'owner n'agit que s'il est le validateur attendu.
        ValidationRules.Actionable(viewerIsOwner: true, ownerValidation: true, approvedByManager: false, ownerIsValidator: false).Should().BeFalse();
        ValidationRules.Actionable(viewerIsOwner: true, ownerValidation: true, approvedByManager: false, ownerIsValidator: true).Should().BeTrue();
        ValidationRules.Actionable(viewerIsOwner: false, ownerValidation: true, approvedByManager: false, ownerIsValidator: false).Should().BeTrue();
        // Après la validation du manager, la fiche n'attend plus que l'owner, même si le réglage a été coupé depuis.
        ValidationRules.Actionable(viewerIsOwner: false, ownerValidation: true, approvedByManager: true, ownerIsValidator: false).Should().BeFalse();
        ValidationRules.Actionable(viewerIsOwner: false, ownerValidation: false, approvedByManager: true, ownerIsValidator: false).Should().BeFalse();
        ValidationRules.Actionable(viewerIsOwner: true, ownerValidation: false, approvedByManager: true, ownerIsValidator: false).Should().BeTrue();
    }

    [Fact]
    public void la_validation_du_manager_passe_a_l_owner_seulement_si_un_owner_peut_la_recevoir()
    {
        ValidationRules.ForwardToOwner(ownerValidation: true, deciderIsOwner: false, ownerAvailable: true).Should().BeTrue();
        ValidationRules.ForwardToOwner(ownerValidation: false, deciderIsOwner: false, ownerAvailable: true).Should().BeFalse();
        ValidationRules.ForwardToOwner(ownerValidation: true, deciderIsOwner: true, ownerAvailable: true).Should().BeFalse("la décision d'un owner est définitive");
        ValidationRules.ForwardToOwner(ownerValidation: true, deciderIsOwner: false, ownerAvailable: false).Should().BeFalse("sans owner actif, la validation du manager est définitive");
    }

    [Fact]
    public void la_validation_du_manager_garde_la_fiche_en_attente_et_ouvre_l_etape_de_l_owner()
    {
        var at = new DateTimeOffset(2026, 3, 20, 15, 0, 0, TimeSpan.Zero);
        var manager = Guid.NewGuid();
        var sheet = Timesheet.Create(Guid.NewGuid(), Guid.NewGuid(), W12, at);
        sheet.SaveDraft(new Dictionary<DateOnly, Guid> { [W12.Monday] = Guid.NewGuid() }, null, at);
        sheet.Submit(sheet.UserId, at);
        sheet.RecordReminder(manager, at.AddDays(4));

        sheet.Approve(manager, at.AddDays(5));
        sheet.Status.Should().Be(TimesheetStatus.SUBMITTED);
        sheet.ApprovedById.Should().Be(manager);
        sheet.StageStartedAt.Should().Be(at.AddDays(5));
        sheet.RemindedThisStage.Should().BeFalse("la relance du manager ne compte pas pour l'étape de l'owner");
        sheet.Events.Select(e => e.Type).Should().Contain("APPROVED");
        var twice = () => sheet.Approve(manager, at.AddDays(6));
        twice.Should().Throw<InvalidOperationException>();

        // Rejet par l'owner puis nouvelle soumission : le circuit repart du manager.
        sheet.Reject(Guid.NewGuid(), at.AddDays(6), "Motif", []);
        sheet.Submit(sheet.UserId, at.AddDays(7));
        sheet.ApprovedById.Should().BeNull();
        sheet.StageStartedAt.Should().Be(at.AddDays(7));
    }

    [Fact]
    public void un_rejet_sans_motif_est_refuse()
    {
        var at = DateTimeOffset.UtcNow;
        var sheet = Timesheet.Create(Guid.NewGuid(), Guid.NewGuid(), W12, at);
        sheet.Submit(sheet.UserId, at);
        var reject = () => sheet.Reject(Guid.NewGuid(), at, "  ", []);
        reject.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void les_formats_des_e_mails_sont_ceux_de_l_interface()
    {
        FrenchFormat.Range(new DateOnly(2026, 3, 16), new DateOnly(2026, 3, 20)).Should().Be("16–20 mars 2026");
        FrenchFormat.Range(new DateOnly(2026, 9, 28), new DateOnly(2026, 10, 2)).Should().Be("28 sept. – 2 oct. 2026");
        FrenchFormat.Range(new DateOnly(2025, 12, 29), new DateOnly(2026, 1, 2)).Should().Be("29 déc. 2025 – 2 janv. 2026");
        FrenchFormat.Days(1).Should().Be("1 jour");
        FrenchFormat.Days(5).Should().Be("5 jours");
        FrenchFormat.Date(new DateOnly(2026, 3, 20)).Should().Be("20 mars 2026");
    }

    [Fact]
    public void les_e_mails_echappent_le_contenu_saisi()
    {
        var mail = MailTemplates.Rejected("a@exemple.com", "Aïcha", "Samuel Etoga", 12, "16–20 mars 2026", "<b>jeudi</b> & \"vendredi\"", "http://localhost:5173/saisie/2026/12");
        mail.Subject.Should().Be("Semaine 12 rejetée : à corriger");
        mail.Text.Should().Contain("Motif : « <b>jeudi</b> & \"vendredi\" »").And.Contain("Ouvrir la fiche : http://localhost:5173/saisie/2026/12");
        mail.Html.Should().Contain("&lt;b&gt;jeudi&lt;/b&gt; &amp;").And.NotContain("<b>jeudi</b>");
        MailTemplates.Validated("a@exemple.com", "Aïcha", "Samuel Etoga", 12, "16–20 mars 2026", "5 jours", "u").Text
            .Should().Contain("Samuel Etoga a validé votre fiche de la semaine 12 (16–20 mars 2026) : 5 jours. La fiche est verrouillée.");
    }
}
