namespace TimeSheet.Api.UnitTests.Domain.Tasks;

using TimeSheet.Api.Domain.Projects;
using TimeSheet.Api.Domain.Tasks;

public class TaskRulesTests
{
    [Fact]
    public void le_titre_est_nettoye_et_borne()
    {
        TaskRules.CheckTitle("  Préparer   l'atelier \n").Should().Be(("Préparer l'atelier", null));
        TaskRules.CheckTitle("   ").Should().Be((null, "titleEmpty"));
        TaskRules.CheckTitle(new string('a', 141)).Should().Be((null, "titleLong"));
        TaskRules.CheckTitle(new string('a', 140)).Value.Should().HaveLength(140);
    }

    [Fact]
    public void un_projet_termine_ou_archive_reste_en_lecture_seule()
    {
        var now = DateTimeOffset.UtcNow;
        var open = Project.Create(Guid.NewGuid(), "P-1", "Projet", new DateOnly(2026, 1, 1), null, null, ProjectStatus.IN_PROGRESS, now, null);
        TaskRules.BoardEditable(open).Should().BeTrue();
        TaskRules.ReadOnlyReason(open).Should().BeNull();
        var done = Project.Create(Guid.NewGuid(), "P-2", "Projet", new DateOnly(2026, 1, 1), null, null, ProjectStatus.DONE, now, null);
        TaskRules.ReadOnlyReason(done).Should().Be("done");
        open.SetArchived(true, now);
        TaskRules.BoardEditable(open).Should().BeFalse();
        TaskRules.ReadOnlyReason(open).Should().Be("archived");
    }

    [Fact]
    public void une_carte_arrive_en_bas_de_sa_colonne_et_la_suppression_se_defait()
    {
        TaskRules.Bottom([]).Should().Be(0);
        TaskRules.Bottom([0, 3, 1]).Should().Be(4);
        TaskRules.ParseStatus("IN_PROGRESS").Should().Be(KanbanStatus.IN_PROGRESS);
        TaskRules.ParseStatus("in_progress").Should().BeNull();
        var task = ProjectTask.Create(Guid.NewGuid(), Guid.NewGuid(), "Tâche", 0, Guid.NewGuid(), DateTimeOffset.UtcNow);
        task.SetDeleted(true, DateTimeOffset.UtcNow);
        task.DeletedAt.Should().NotBeNull();
        task.SetDeleted(false, DateTimeOffset.UtcNow);
        task.DeletedAt.Should().BeNull();
    }
}
