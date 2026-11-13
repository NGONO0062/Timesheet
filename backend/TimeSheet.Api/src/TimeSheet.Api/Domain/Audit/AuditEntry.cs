namespace TimeSheet.Api.Domain.Audit;

using TimeSheet.Api.Domain.Access;

/// <summary>
/// Journal d'audit, en ajout seul : la base refuse toute modification et toute suppression
/// (déclencheur créé par la migration). `At` suit l'horloge de l'application ; `RecordedAt`
/// est l'heure réelle, toujours croissante, pour les fenêtres de limitation.
/// </summary>
public class AuditEntry
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public DateTimeOffset At { get; private set; }
    public DateTimeOffset RecordedAt { get; private set; }
    public Guid? ActorId { get; private set; }
    public string ActorLabel { get; private set; } = "";
    public Guid? DivisionId { get; private set; }
    public string Action { get; private set; } = "";
    public string ObjectLabel { get; private set; } = "";
    public AuditResult Result { get; private set; }
    /// <summary>Détails en JSON (adresse IP, raison d'un échec…).</summary>
    public string Metadata { get; private set; } = "{}";

    public static AuditEntry Create(DateTimeOffset at, DateTimeOffset recordedAt, string action, string actorLabel, string objectLabel, AuditResult result, Guid? actorId = null, Guid? divisionId = null, string metadata = "{}") =>
        new()
        {
            At = at,
            RecordedAt = recordedAt,
            Action = action,
            ActorLabel = actorLabel,
            ObjectLabel = objectLabel,
            Result = result,
            ActorId = actorId,
            DivisionId = divisionId,
            Metadata = metadata,
        };

    protected AuditEntry() { } // EF
}
