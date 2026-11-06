namespace TimeSheet.Api.Domain.Divisions;

/// <summary>
/// Règles d'une division (écran 12), valeurs par défaut du §8. Saisie en jours entiers
/// (point 82) : une journée par jour ouvré, plus d'unité ni de pas.
/// </summary>
public class DivisionSettings
{
    public Guid DivisionId { get; private set; }
    public DayOfWeek[] WorkingDays { get; private set; } = [DayOfWeek.Monday, DayOfWeek.Tuesday, DayOfWeek.Wednesday, DayOfWeek.Thursday, DayOfWeek.Friday];
    public DayOfWeek DeadlineDay { get; private set; } = DayOfWeek.Friday;
    /// <summary>Heure d'échéance « hh:mm », à Douala.</summary>
    public string DeadlineTime { get; private set; } = "18:00";
    public int FillAlertThreshold { get; private set; } = 80;
    public bool AllowFutureWeeks { get; private set; }
    public bool LockAfterValidation { get; private set; } = true;
    public bool OwnerValidation { get; private set; }
    public string? HrEmail { get; private set; }
    public bool HrAutoSend { get; private set; } = true;
    public int ReminderAfterWorkingDays { get; private set; } = 3;
    public bool DelegateToOwner { get; private set; } = true;

    public static DivisionSettings Defaults(Guid divisionId) => new() { DivisionId = divisionId };

    public DivisionSettings WithFutureWeeks(bool allowed)
    {
        AllowFutureWeeks = allowed;
        return this;
    }

    protected DivisionSettings() { } // EF
}

/// <summary>Jour férié d'une division : aucune journée n'est attendue ce jour-là.</summary>
public class Holiday
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public Guid DivisionId { get; private set; }
    public DateOnly Date { get; private set; }
    public string Label { get; private set; } = "";

    public static Holiday Create(Guid divisionId, DateOnly date, string label) => new() { DivisionId = divisionId, Date = date, Label = label };

    protected Holiday() { } // EF
}
