namespace TimeSheet.Api.Domain.Projects;

/// <summary>Statut d'un projet (planche C4). Seul « En cours » ouvre la saisie à ses membres.</summary>
public enum ProjectStatus
{
    NOT_STARTED,
    IN_PROGRESS,
    ON_HOLD,
    DONE,
}

/// <summary>
/// Projet d'une division (PROMPT.md §9.4). L'activité système « Absence » (§20) est un
/// projet marqué IsSystem : toujours ouvert à la saisie, sans membres.
/// </summary>
public class Project : BaseEntity
{
    public Guid DivisionId { get; private set; }
    public string Code { get; private set; } = "";
    public string Name { get; private set; } = "";
    public DateOnly StartDate { get; private set; }
    public DateOnly? EndDate { get; private set; }
    /// <summary>Budget en jours (saisie en jours entiers, point 82).</summary>
    public int? BudgetDays { get; private set; }
    public ProjectStatus Status { get; private set; } = ProjectStatus.NOT_STARTED;
    public DateTimeOffset StatusChangedAt { get; private set; }
    public Guid? StatusChangedById { get; private set; }
    public DateTimeOffset? ArchivedAt { get; private set; }
    public bool IsSystem { get; private set; }
    /// <summary>Responsable : le manager qui pilote le projet.</summary>
    public Guid? ManagerId { get; private set; }

    private readonly List<Activity> _activities = [];
    public IReadOnlyCollection<Activity> Activities => _activities;

    private readonly List<ProjectMember> _members = [];
    public IReadOnlyCollection<ProjectMember> Members => _members;

    public static Project Create(Guid divisionId, string code, string name, DateOnly start, DateOnly? end, int? budgetDays, ProjectStatus status, DateTimeOffset now, Guid? managerId, bool isSystem = false) =>
        new()
        {
            DivisionId = divisionId,
            Code = code,
            Name = name.Trim(),
            StartDate = start,
            EndDate = end,
            BudgetDays = budgetDays,
            Status = status,
            StatusChangedAt = now,
            StatusChangedById = managerId,
            ManagerId = managerId,
            IsSystem = isSystem,
        };

    public Activity AddActivity(string name)
    {
        var activity = new Activity(Id, name.Trim());
        _activities.Add(activity);
        return activity;
    }

    public void AddMember(Guid userId)
    {
        if (_members.All(m => m.UserId != userId)) _members.Add(new ProjectMember(Id, userId));
    }

    /// <summary>
    /// Ouvert à la saisie d'une semaine : non archivé, « En cours », et la période du projet
    /// recouvre la semaine. L'absence est toujours ouverte.
    /// </summary>
    public bool AcceptsEntry(DateOnly weekStart, DateOnly weekEnd) =>
        ArchivedAt is null && (IsSystem || (Status == ProjectStatus.IN_PROGRESS && StartDate <= weekEnd && (EndDate is null || EndDate >= weekStart)));

    protected Project() { } // EF
}

public class Activity
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public Guid ProjectId { get; private set; }
    public string Name { get; private set; } = "";

    internal Activity(Guid projectId, string name)
    {
        ProjectId = projectId;
        Name = name;
    }

    protected Activity() { } // EF
}

public class ProjectMember
{
    public Guid ProjectId { get; private set; }
    public Guid UserId { get; private set; }

    internal ProjectMember(Guid projectId, Guid userId)
    {
        ProjectId = projectId;
        UserId = userId;
    }

    protected ProjectMember() { } // EF
}
