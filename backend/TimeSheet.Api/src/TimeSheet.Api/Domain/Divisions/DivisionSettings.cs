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
    public int ReminderAfterWorkingDays { get; private set; } = 3;
    public bool DelegateToOwner { get; private set; } = true;

    public static DivisionSettings Defaults(Guid divisionId) => new() { DivisionId = divisionId };

    public DivisionSettings WithFutureWeeks(bool allowed)
    {
        AllowFutureWeeks = allowed;
        return this;
    }

    /// <summary>
    /// Workflow (écran 12). La validation par l'owner (N+2) n'est pas encore branchée (point 52) :
    /// elle reste désactivée.
    /// </summary>
    public DivisionSettings WithWorkflow(int reminderAfterWorkingDays, bool delegateToOwner)
    {
        OwnerValidation = false;
        ReminderAfterWorkingDays = reminderAfterWorkingDays;
        DelegateToOwner = delegateToOwner;
        return this;
    }

    /// <summary>
    /// Configuration de départ d'une division en onboarding : celle de la division pilote, ou les
    /// valeurs par défaut.
    /// </summary>
    public DivisionSettings CopyFrom(DivisionSettings source)
    {
        WorkingDays = [.. source.WorkingDays];
        DeadlineDay = source.DeadlineDay;
        DeadlineTime = source.DeadlineTime;
        FillAlertThreshold = source.FillAlertThreshold;
        AllowFutureWeeks = source.AllowFutureWeeks;
        LockAfterValidation = source.LockAfterValidation;
        OwnerValidation = source.OwnerValidation;
        ReminderAfterWorkingDays = source.ReminderAfterWorkingDays;
        DelegateToOwner = source.DelegateToOwner;
        return this;
    }

    /// <summary>Règles de saisie (écran 12), contrôlées par <see cref="Admin.AdminRules.CheckRules"/>.</summary>
    public DivisionSettings WithRules(DayOfWeek[] workingDays, DayOfWeek deadlineDay, string deadlineTime, int fillAlertThreshold, bool allowFutureWeeks, bool lockAfterValidation)
    {
        WorkingDays = workingDays;
        DeadlineDay = deadlineDay;
        DeadlineTime = deadlineTime.Trim();
        FillAlertThreshold = fillAlertThreshold;
        AllowFutureWeeks = allowFutureWeeks;
        LockAfterValidation = lockAfterValidation;
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
