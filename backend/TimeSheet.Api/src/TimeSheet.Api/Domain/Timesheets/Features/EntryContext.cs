namespace TimeSheet.Api.Domain.Timesheets.Features;

using Microsoft.EntityFrameworkCore;
using TimeSheet.Api.Databases;
using TimeSheet.Api.Domain.Divisions;
using TimeSheet.Api.Exceptions;
using TimeSheet.Api.Services;
using TimeSheet.Api.Services.Access;

/// <summary>Choix d'une journée : une activité d'un projet ouvert à la personne.</summary>
public sealed record DayChoiceDto(Guid Key, string Project, string Activity, string Code, bool Closed);

/// <summary>Jour ouvré d'une semaine : 1 journée attendue, 0 si férié.</summary>
public sealed record FrameDay(DateOnly Date, int Expected, string? Holiday, bool IsFuture);

/// <summary>Cadre d'une semaine pour une personne : jours, échéance, réglages de la division.</summary>
public sealed record WeekFrame(IsoWeek Week, IsoWeek Current, DateTimeOffset Now, DateTimeOffset Deadline, IReadOnlyList<FrameDay> Days, DivisionSettings Settings)
{
    public bool IsOpen => WeekRules.IsWeekOpen(Week, Current, Settings.AllowFutureWeeks);
}

public interface IEntryContext : ITimeSheetApiScopedService
{
    Task<WeekFrame> FrameAsync(DivisionScope scope, IsoWeek week, CancellationToken cancellationToken);

    /// <summary>Projets en cours dont la personne est membre, qui couvrent la semaine, plus l'absence.</summary>
    Task<List<DayChoiceDto>> ChoicesAsync(DivisionScope scope, IsoWeek week, CancellationToken cancellationToken);

    /// <summary>Validateur : le manager de la personne (jalon 3 : délégation à l'owner).</summary>
    Task<string?> ValidatorNameAsync(DivisionScope scope, CancellationToken cancellationToken);
}

public sealed class EntryContext(TimeSheetDbContext db, TimeProvider clock) : IEntryContext
{
    public async Task<WeekFrame> FrameAsync(DivisionScope scope, IsoWeek week, CancellationToken cancellationToken)
    {
        var settings = await db.DivisionSettings.AsNoTracking().FirstOrDefaultAsync(s => s.DivisionId == scope.DivisionId, cancellationToken)
                       ?? DivisionSettings.Defaults(scope.DivisionId);
        var monday = week.Monday;
        var holidays = await db.Holidays.AsNoTracking()
            .Where(h => h.DivisionId == scope.DivisionId && h.Date >= monday && h.Date <= monday.AddDays(6))
            .ToDictionaryAsync(h => h.Date, h => h.Label, cancellationToken);
        var now = clock.GetUtcNow();
        var today = WeekRules.DoualaDay(now);
        var days = WeekRules.WorkingDays(week, settings.WorkingDays)
            .Select(d => new FrameDay(d, holidays.ContainsKey(d) ? 0 : 1, holidays.GetValueOrDefault(d), d > today))
            .ToList();
        return new WeekFrame(week, WeekRules.CurrentWeek(now), now, WeekRules.Deadline(week, settings.DeadlineDay, settings.DeadlineTime), days, settings);
    }

    public async Task<List<DayChoiceDto>> ChoicesAsync(DivisionScope scope, IsoWeek week, CancellationToken cancellationToken)
    {
        var start = week.Monday;
        var end = start.AddDays(6);
        var projects = await db.Projects.AsNoTracking()
            .Include(p => p.Activities)
            .Where(p => p.DivisionId == scope.DivisionId && p.ArchivedAt == null && (p.IsSystem || p.Members.Any(m => m.UserId == scope.UserId)))
            .OrderBy(p => p.IsSystem).ThenBy(p => p.Code)
            .ToListAsync(cancellationToken);
        return projects
            .SelectMany(p => p.Activities.OrderBy(a => a.Name).Select(a => new DayChoiceDto(a.Id, p.Name, a.Name, p.Code, !p.AcceptsEntry(start, end))))
            .ToList();
    }

    public async Task<string?> ValidatorNameAsync(DivisionScope scope, CancellationToken cancellationToken)
    {
        var manager = await db.Users.AsNoTracking()
            .Where(u => u.Id == scope.UserId && u.ManagerId != null)
            .Select(u => db.Users.Where(m => m.Id == u.ManagerId && m.Active).Select(m => m.FirstName + " " + m.LastName).FirstOrDefault())
            .FirstOrDefaultAsync(cancellationToken);
        return manager;
    }
}

public static class WeekRequest
{
    /// <summary>Semaine de l'adresse ; une semaine qui n'existe pas n'existe pas pour l'API (404).</summary>
    public static IsoWeek Parse(int year, int week) => IsoWeek.IsValid(year, week) ? new IsoWeek(year, week) : throw new NotFoundException("Semaine introuvable.");
}
