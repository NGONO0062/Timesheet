namespace TimeSheet.Api.Domain.Tasks;

using TimeSheet.Api.Domain.Projects;

/// <summary>Colonnes du tableau Kanban (PROMPT.md §9.12), dans l'ordre d'affichage.</summary>
public enum KanbanStatus
{
    BACKLOG,
    TODO,
    IN_PROGRESS,
    REVIEW,
    DONE,
}

/// <summary>
/// Tâche d'un projet, sur son tableau Kanban (PROMPT.md §9.12). Une suppression est
/// réversible (« Annuler ») : la tâche est marquée, pas effacée.
/// </summary>
public class ProjectTask
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public Guid DivisionId { get; private set; }
    public Guid ProjectId { get; private set; }
    public string Title { get; private set; } = "";
    public KanbanStatus Status { get; private set; } = KanbanStatus.BACKLOG;
    public int Position { get; private set; }
    public Guid CreatedById { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset? DeletedAt { get; private set; }

    public static ProjectTask Create(Guid divisionId, Guid projectId, string title, int position, Guid createdById, DateTimeOffset now) =>
        new() { DivisionId = divisionId, ProjectId = projectId, Title = title, Status = KanbanStatus.BACKLOG, Position = position, CreatedById = createdById, CreatedAt = now };

    public void MoveTo(KanbanStatus status, int position)
    {
        Status = status;
        Position = position;
    }

    public void Rename(string title) => Title = title;

    public void SetDeleted(bool deleted, DateTimeOffset now) => DeletedAt = deleted ? DeletedAt ?? now : null;

    protected ProjectTask() { } // EF
}

/// <summary>Règles pures du tableau (reprises de lib/tasks/rules.ts).</summary>
public static class TaskRules
{
    public const int TitleMax = 140;

    /// <summary>Titre nettoyé (espaces superflus retirés), ou le code d'erreur : « titleEmpty », « titleLong ».</summary>
    public static (string? Value, string? Error) CheckTitle(string? raw)
    {
        var value = string.Join(' ', (raw ?? "").Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
        if (value.Length == 0) return (null, "titleEmpty");
        if (value.Length > TitleMax) return (null, "titleLong");
        return (value, null);
    }

    /// <summary>Un projet terminé ou archivé garde son tableau en lecture seule.</summary>
    public static bool BoardEditable(Project p) => p.Status != ProjectStatus.DONE && p.ArchivedAt is null;

    /// <summary>Raison de la lecture seule : « archived », « done », ou null.</summary>
    public static string? ReadOnlyReason(Project p) => p.ArchivedAt is not null ? "archived" : p.Status == ProjectStatus.DONE ? "done" : null;

    /// <summary>Position d'une carte posée en bas d'une colonne.</summary>
    public static int Bottom(IEnumerable<int> positions)
    {
        var list = positions.ToList();
        return list.Count == 0 ? 0 : list.Max() + 1;
    }

    public static KanbanStatus? ParseStatus(string? s) => Enum.TryParse<KanbanStatus>(s, out var k) && s == k.ToString() ? k : null;
}
