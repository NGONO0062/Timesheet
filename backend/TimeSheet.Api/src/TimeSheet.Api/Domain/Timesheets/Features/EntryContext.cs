namespace TimeSheet.Api.Domain.Timesheets.Features;

using Microsoft.EntityFrameworkCore;
using TimeSheet.Api.Databases;
using TimeSheet.Api.Domain.Access;
using TimeSheet.Api.Domain.Divisions;
using TimeSheet.Api.Exceptions;
using TimeSheet.Api.Services;
using TimeSheet.Api.Services.Access;

/// <summary>Choix d'une journée : une activité d'un projet ouvert à la personne.</summary>
/// <summary>Choix d'une journée. <c>Absence</c> : projet système (congé, maladie), jamais repris d'une semaine à l'autre.</summary>
public sealed record DayChoiceDto(Guid Key, string Project, string Activity, string Code, bool Closed, bool Absence = false);

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

    /// <summary>Nom du validateur de la personne connectée (voir <see cref="ValidatorOfAsync"/>).</summary>
    Task<string?> ValidatorNameAsync(DivisionScope scope, CancellationToken cancellationToken);

    /// <summary>
    /// Validateur d'une personne : son manager s'il est actif dans la division ; sinon, si la
    /// division délègue au N+2 (par défaut), un owner actif de la division ; sinon personne.
    /// </summary>
    Task<ValidatorInfo?> ValidatorOfAsync(Guid divisionId, Guid userId, CancellationToken cancellationToken);
}

public sealed record ValidatorInfo(Guid Id, string Email, string FirstName, string FullName);

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
            .SelectMany(p => p.Activities.OrderBy(a => a.Name).Select(a => new DayChoiceDto(a.Id, p.Name, a.Name, p.Code, !p.AcceptsEntry(start, end), p.IsSystem)))
            .ToList();
    }

    public async Task<string?> ValidatorNameAsync(DivisionScope scope, CancellationToken cancellationToken) =>
        (await ValidatorOfAsync(scope.DivisionId, scope.UserId, cancellationToken))?.FullName;

    public async Task<ValidatorInfo?> ValidatorOfAsync(Guid divisionId, Guid userId, CancellationToken cancellationToken)
    {
        var managerId = await db.Users.AsNoTracking().Where(u => u.Id == userId && u.DivisionId == divisionId).Select(u => u.ManagerId).FirstOrDefaultAsync(cancellationToken);
        var manager = managerId is null
            ? null
            : await db.Users.AsNoTracking()
                .Where(m => m.Id == managerId && m.DivisionId == divisionId && m.Active)
                .Select(m => new ValidatorInfo(m.Id, m.Email, m.FirstName, m.FirstName + " " + m.LastName))
                .FirstOrDefaultAsync(cancellationToken);
        if (manager is not null) return manager;

        var delegateToOwner = await db.DivisionSettings.AsNoTracking().Where(s => s.DivisionId == divisionId).Select(s => (bool?)s.DelegateToOwner).FirstOrDefaultAsync(cancellationToken) ?? true;
        if (!delegateToOwner) return null;
        return await db.Users.AsNoTracking()
            .Where(o => o.DivisionId == divisionId && o.Role == Role.OWNER && o.Active && o.Id != userId)
            .OrderBy(o => o.LastName).ThenBy(o => o.FirstName)
            .Select(o => new ValidatorInfo(o.Id, o.Email, o.FirstName, o.FirstName + " " + o.LastName))
            .FirstOrDefaultAsync(cancellationToken);
    }
}

public static class WeekRequest
{
    /// <summary>Semaine de l'adresse ; une semaine qui n'existe pas n'existe pas pour l'API (404).</summary>
    public static IsoWeek Parse(int year, int week) => IsoWeek.IsValid(year, week) ? new IsoWeek(year, week) : throw new NotFoundException("Semaine introuvable.");
}
