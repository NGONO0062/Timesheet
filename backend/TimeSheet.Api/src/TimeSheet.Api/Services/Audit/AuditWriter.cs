namespace TimeSheet.Api.Services.Audit;

using System.Text.Json;
using TimeSheet.Api.Databases;
using TimeSheet.Api.Domain.Access;
using TimeSheet.Api.Domain.Audit;

public interface IAuditWriter : ITimeSheetApiScopedService
{
    /// <summary>Ajoute une ligne au journal (en ajout seul) et l'enregistre tout de suite.</summary>
    Task AppendAsync(string action, string actorLabel, string objectLabel, AuditResult result, Guid? actorId = null, Guid? divisionId = null, object? metadata = null, CancellationToken cancellationToken = default);
}

public sealed class AuditWriter(TimeSheetDbContext db, TimeProvider clock) : IAuditWriter
{
    public async Task AppendAsync(string action, string actorLabel, string objectLabel, AuditResult result, Guid? actorId = null, Guid? divisionId = null, object? metadata = null, CancellationToken cancellationToken = default)
    {
        // `At` sur l'horloge de l'application ; `RecordedAt` en heure réelle (fenêtres de limitation).
        var entry = AuditEntry.Create(clock.GetUtcNow(), TimeProvider.System.GetUtcNow(), action, actorLabel, objectLabel, result, actorId, divisionId, JsonSerializer.Serialize(metadata ?? new { }));
        db.AuditLog.Add(entry);
        await db.SaveChangesAsync(cancellationToken);
    }
}
