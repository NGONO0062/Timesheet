namespace TimeSheet.Api.Domain.Timesheets.Features;

using MediatR;
using Microsoft.EntityFrameworkCore;
using TimeSheet.Api.Databases;
using TimeSheet.Api.Domain.Access;
using TimeSheet.Api.Services.Access;

/// <summary>Semaine résumée : jours saisis sur jours attendus, statut affiché.</summary>
public sealed record WeekSummaryDto(int Year, int Week, DateOnly Monday, int Filled, int Expected, string Status, DateTimeOffset Deadline);

/// <summary>Une action « À faire » : semaine rejetée à corriger, ou semaine manquante.</summary>
public sealed record TodoDto(string Kind, WeekSummaryDto Week);

/// <summary>Jour de la semaine en cours ; <c>Flagged</c> : signalé par le manager lors d'un rejet (« À corriger »).</summary>
public sealed record CurrentDayDto(DateOnly Date, int Expected, bool IsFuture, bool Filled, bool Flagged);

public sealed record CurrentWeekDto(WeekSummaryDto Week, IReadOnlyList<CurrentDayDto> Days);

public sealed record DashboardProjectDto(string Code, string Name, string Status, DateOnly Start, DateOnly? End, IReadOnlyList<string> Activities, int DaysThisWeek, bool AcceptsEntry);

/// <summary>Tableau de bord staff (écran 02, règles v2 : une action principale, pas de doublon).</summary>
public sealed record DashboardDto(
    string FirstName,
    string? DivisionName,
    string? ManagerName,
    bool IsIntern,
    IReadOnlyList<TodoDto> Todo,
    CurrentWeekDto Current,
    IReadOnlyList<DashboardProjectDto> Projects,
    IReadOnlyList<WeekSummaryDto> Recent);

public static class Dashboard
{
    /// <summary>Semaines regardées en arrière pour « À faire » (au-delà, la relance passe par le manager).</summary>
    public const int LookBackWeeks = 8;

    public sealed record Query : IRequest<DashboardDto>;

    public sealed class Handler(TimeSheetDbContext db, IViewerAccessor viewers, IEntryContext entry, TimeProvider clock) : IRequestHandler<Query, DashboardDto>
    {
        public async Task<DashboardDto> Handle(Query request, CancellationToken cancellationToken)
        {
            var viewer = (await viewers.RequireAsync(cancellationToken)).Require(Permission.ENTER_TIME);
            var scope = viewer.Scope;
            var current = await entry.FrameAsync(scope, WeekRules.CurrentWeek(clock.GetUtcNow()), cancellationToken);

            var sheets = await db.Timesheets.AsNoTracking().Include(t => t.Days).Where(t => t.UserId == scope.UserId).ToListAsync(cancellationToken);
            var user = await db.Users.AsNoTracking().FirstAsync(u => u.Id == scope.UserId, cancellationToken);

            // Les semaines antérieures à l'arrivée ne comptent pas (première fiche, ou création du compte).
            var arrival = sheets.Select(s => s.Week).Append(IsoWeek.Of(WeekRules.DoualaDay(user.CreatedOn))).Min();

            async Task<WeekSummaryDto> Summary(IsoWeek week)
            {
                var frame = week == current.Week ? current : await entry.FrameAsync(scope, week, cancellationToken);
                var sheet = sheets.FirstOrDefault(s => s.Week == week);
                var expectedDays = frame.Days.Where(d => d.Expected > 0).Select(d => d.Date).ToHashSet();
                var filled = sheet?.Days.Count(d => expectedDays.Contains(d.Date)) ?? 0;
                return new WeekSummaryDto(week.Year, week.Week, week.Monday, filled, expectedDays.Count, WeekRules.Display(sheet?.Status, frame.Deadline, current.Now).ToString(), frame.Deadline);
            }

            var past = new List<WeekSummaryDto>();
            for (var w = current.Current.Shift(-1); w >= arrival && past.Count < LookBackWeeks; w = w.Shift(-1)) past.Add(await Summary(w));

            // Une fiche rejetée est à corriger, semaine en cours comprise (§9.1).
            var currentSummary = await Summary(current.Week);
            var todo = past.Prepend(currentSummary).Where(s => s.Status == nameof(DisplayStatus.REJECTED)).Select(s => new TodoDto("rejected", s))
                .Concat(past.Where(s => s.Status == nameof(DisplayStatus.MISSING)).OrderBy(s => s.Monday).Select(s => new TodoDto("missing", s)))
                .ToList();
            var inTodo = todo.Select(t => (t.Week.Year, t.Week.Week)).ToHashSet();
            var recent = past.Where(s => !inTodo.Contains((s.Year, s.Week))).Take(3).ToList();

            var currentSheet = sheets.FirstOrDefault(s => s.Week == current.Week);
            var currentDays = current.Days.Select(d => new CurrentDayDto(d.Date, d.Expected, d.IsFuture, currentSheet?.Days.Any(x => x.Date == d.Date) ?? false,
                currentSheet?.Days.Any(x => x.Date == d.Date && x.Flagged) ?? false)).ToList();

            var monday = current.Week.Monday;
            var projects = await db.Projects.AsNoTracking().Include(p => p.Activities)
                .Where(p => p.DivisionId == scope.DivisionId && !p.IsSystem && p.ArchivedAt == null && p.Status != Projects.ProjectStatus.DONE && p.Members.Any(m => m.UserId == scope.UserId))
                .OrderBy(p => p.Code)
                .ToListAsync(cancellationToken);
            var daysByActivity = currentSheet?.Days.GroupBy(d => d.ActivityId).ToDictionary(g => g.Key, g => g.Count()) ?? [];

            var manager = user.ManagerId is { } managerId
                ? await db.Users.AsNoTracking().Where(m => m.Id == managerId).Select(m => m.FirstName + " " + m.LastName).FirstOrDefaultAsync(cancellationToken)
                : null;

            return new DashboardDto(
                viewer.FirstName,
                viewer.DivisionName,
                manager,
                viewer.IsIntern,
                todo,
                new CurrentWeekDto(currentSummary, currentDays),
                projects.Select(p => new DashboardProjectDto(
                    p.Code,
                    p.Name,
                    p.Status.ToString(),
                    p.StartDate,
                    p.EndDate,
                    p.Activities.OrderBy(a => a.Name).Select(a => a.Name).ToList(),
                    p.Activities.Sum(a => daysByActivity.GetValueOrDefault(a.Id)),
                    p.AcceptsEntry(monday, monday.AddDays(6)))).ToList(),
                recent);
        }
    }
}
