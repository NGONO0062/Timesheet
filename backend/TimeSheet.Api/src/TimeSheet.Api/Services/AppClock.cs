namespace TimeSheet.Api.Services;

using System.Globalization;

/// <summary>
/// Horloge de l'application (reprise de lib/clock.ts). En démonstration, TIMESHEET_NOW fixe
/// le point de départ (ex. « 2026-03-19T09:42:00Z », semaine 12 des maquettes) et le temps
/// avance ensuite normalement. Vide : l'heure réelle. Les fenêtres de sécurité (limitation
/// des tentatives) utilisent toujours l'heure réelle, jamais cette horloge.
/// </summary>
public sealed class AppClock : TimeProvider
{
    private readonly DateTimeOffset? _origin;
    private readonly DateTimeOffset _startedAt = System.GetUtcNow();

    public AppClock(string? fixedNow)
    {
        if (string.IsNullOrWhiteSpace(fixedNow)) return;
        if (!DateTimeOffset.TryParse(fixedNow, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var origin))
            throw new InvalidOperationException($"TIMESHEET_NOW invalide : « {fixedNow} »");
        _origin = origin.ToUniversalTime();
    }

    public override DateTimeOffset GetUtcNow() => _origin is { } origin ? origin + (System.GetUtcNow() - _startedAt) : System.GetUtcNow();
}
