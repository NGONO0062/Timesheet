namespace TimeSheet.Api.Domain.Timesheets;

/// <summary>
/// Fiche de temps d'une personne pour une semaine (PROMPT.md §9.3). Saisie par jour
/// (docs/design-v2.md) : au plus une journée par date, qui porte l'activité choisie
/// (donc son projet) et, après un rejet, le signalement du manager.
/// </summary>
public class Timesheet : BaseEntity
{
    public Guid DivisionId { get; private set; }
    public Guid UserId { get; private set; }
    public int WeekYear { get; private set; }
    public int WeekNumber { get; private set; }
    public TimesheetStatus Status { get; private set; } = TimesheetStatus.DRAFT;
    public string? Comment { get; private set; }
    public DateTimeOffset? SubmittedAt { get; private set; }
    public int SubmissionCount { get; private set; }
    public Guid? DecidedById { get; private set; }
    public DateTimeOffset? DecidedAt { get; private set; }
    public string? RejectionReason { get; private set; }
    /// <summary>Dernier enregistrement, sur l'horloge de l'application (indicateur « Brouillon enregistré à … »).</summary>
    public DateTimeOffset UpdatedAt { get; private set; }

    private readonly List<TimesheetDay> _days = [];
    public IReadOnlyCollection<TimesheetDay> Days => _days;

    private readonly List<TimesheetEvent> _events = [];
    public IReadOnlyCollection<TimesheetEvent> Events => _events;

    public IsoWeek Week => new(WeekYear, WeekNumber);

    public static Timesheet Create(Guid divisionId, Guid userId, IsoWeek week, DateTimeOffset now)
    {
        var sheet = new Timesheet { DivisionId = divisionId, UserId = userId, WeekYear = week.Year, WeekNumber = week.Week, UpdatedAt = now };
        sheet._events.Add(new TimesheetEvent(sheet.Id, "CREATED", userId, now, null));
        return sheet;
    }

    /// <summary>
    /// Brouillon : remplace les journées et le commentaire. Une journée signalée garde son
    /// signalement tant que la fiche n'est pas soumise de nouveau.
    /// </summary>
    public void SaveDraft(IReadOnlyDictionary<DateOnly, Guid> days, string? comment, DateTimeOffset now)
    {
        var flagged = _days.Where(d => d.Flagged).Select(d => d.Date).ToHashSet();
        _days.RemoveAll(d => !days.ContainsKey(d.Date));
        foreach (var (date, activityId) in days)
        {
            var existing = _days.FirstOrDefault(d => d.Date == date);
            if (existing is null) _days.Add(new TimesheetDay(Id, date, activityId, flagged.Contains(date)));
            else existing.ActivityId = activityId;
        }
        Comment = string.IsNullOrWhiteSpace(comment) ? null : comment.Trim();
        UpdatedAt = now;
    }

    /// <summary>Soumission : les signalements sont traités par cette nouvelle soumission.</summary>
    public void Submit(Guid actorId, DateTimeOffset now)
    {
        if (Status is not (TimesheetStatus.DRAFT or TimesheetStatus.REJECTED)) throw new InvalidOperationException("Fiche non soumettable.");
        Status = TimesheetStatus.SUBMITTED;
        SubmittedAt = now;
        SubmissionCount++;
        DecidedAt = null;
        DecidedById = null;
        RejectionReason = null;
        foreach (var day in _days) day.Flagged = false;
        UpdatedAt = now;
        _events.Add(new TimesheetEvent(Id, "SUBMITTED", actorId, now, Comment));
    }

    /// <summary>Validation par le manager (jalon 3) ; employée ici par les données de démonstration.</summary>
    public void Validate(Guid deciderId, DateTimeOffset now)
    {
        if (Status != TimesheetStatus.SUBMITTED) throw new InvalidOperationException("Fiche non soumise.");
        Status = TimesheetStatus.VALIDATED;
        DecidedById = deciderId;
        DecidedAt = now;
        _events.Add(new TimesheetEvent(Id, "VALIDATED", deciderId, now, null));
    }

    /// <summary>Rejet avec motif et journées signalées (jalon 3) ; employé ici par les données de démonstration.</summary>
    public void Reject(Guid deciderId, DateTimeOffset now, string reason, IEnumerable<DateOnly> flaggedDays)
    {
        if (Status != TimesheetStatus.SUBMITTED) throw new InvalidOperationException("Fiche non soumise.");
        Status = TimesheetStatus.REJECTED;
        DecidedById = deciderId;
        DecidedAt = now;
        RejectionReason = reason.Trim();
        var flags = flaggedDays.ToHashSet();
        foreach (var day in _days) day.Flagged = flags.Contains(day.Date);
        _events.Add(new TimesheetEvent(Id, "REJECTED", deciderId, now, RejectionReason));
    }

    protected Timesheet() { } // EF
}

public class TimesheetDay
{
    public Guid TimesheetId { get; private set; }
    public DateOnly Date { get; private set; }
    public Guid ActivityId { get; internal set; }
    /// <summary>Journée signalée par le manager lors d'un rejet.</summary>
    public bool Flagged { get; internal set; }

    internal TimesheetDay(Guid timesheetId, DateOnly date, Guid activityId, bool flagged)
    {
        TimesheetId = timesheetId;
        Date = date;
        ActivityId = activityId;
        Flagged = flagged;
    }

    protected TimesheetDay() { } // EF
}

/// <summary>Historique d'une fiche (écran 08) : création, soumissions, décisions.</summary>
public class TimesheetEvent
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public Guid TimesheetId { get; private set; }
    public string Type { get; private set; } = "";
    public Guid ActorId { get; private set; }
    public DateTimeOffset At { get; private set; }
    public string? Note { get; private set; }

    internal TimesheetEvent(Guid timesheetId, string type, Guid actorId, DateTimeOffset at, string? note)
    {
        TimesheetId = timesheetId;
        Type = type;
        ActorId = actorId;
        At = at;
        Note = note;
    }

    protected TimesheetEvent() { } // EF
}
