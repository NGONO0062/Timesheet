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
    IReadOnlyList<WeekSummaryDto> Recent,
    IReadOnlyList<AttendanceTodoDto> Attendance);

/// <summary>Fiche de présence à signer (stagiaire) : mois, date de génération, jours validés du mois.</summary>
public sealed record AttendanceTodoDto(int Year, int Month, DateTimeOffset GeneratedAt, int ValidatedDays);

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
            var currentWeek = WeekRules.CurrentWeek(clock.GetUtcNow());

            var sheets = await db.Timesheets.AsNoTracking().Include(t => t.Days).Where(t => t.UserId == scope.UserId).ToListAsync(cancellationToken);
            var user = await db.Users.AsNoTracking().FirstAsync(u => u.Id == scope.UserId, cancellationToken);

            // Les semaines antérieures à l'arrivée ne comptent pas (première fiche, ou création du compte).
            var arrival = sheets.Select(s => s.Week).Append(IsoWeek.Of(WeekRules.DoualaDay(user.CreatedOn))).Min();

            // Semaines regardées : la semaine en cours et les précédentes, depuis l'arrivée. Leurs
            // cadres (réglages, jours fériés) sont lus en une fois, pas semaine par semaine.
            var pastWeeks = new List<IsoWeek>();
            for (var w = currentWeek.Shift(-1); w >= arrival && pastWeeks.Count < LookBackWeeks; w = w.Shift(-1)) pastWeeks.Add(w);
            var frames = await entry.FramesAsync(scope, [currentWeek, .. pastWeeks], cancellationToken);
            var current = frames[currentWeek];

            WeekSummaryDto Summary(IsoWeek week)
            {
                var frame = frames[week];
                var sheet = sheets.FirstOrDefault(s => s.Week == week);
                var expectedDays = frame.Days.Where(d => d.Expected > 0).Select(d => d.Date).ToHashSet();
                var filled = sheet?.Days.Count(d => expectedDays.Contains(d.Date)) ?? 0;
                return new WeekSummaryDto(week.Year, week.Week, week.Monday, filled, expectedDays.Count, WeekRules.Display(sheet?.Status, frame.Deadline, current.Now).ToString(), frame.Deadline);
            }

            var past = pastWeeks.Select(Summary).ToList();

            // Une fiche rejetée est à corriger, semaine en cours comprise (§9.1).
            var currentSummary = Summary(current.Week);
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

            // Fiches de présence à signer (stagiaire, §9.1) : les jours validés du mois, d'après les fiches de temps.
            var toSign = await db.AttendanceSheets.AsNoTracking()
                .Where(s => s.DivisionId == scope.DivisionId && s.UserId == scope.UserId && s.Status == Attendance.AttendanceStatus.GENERATED)
                .OrderBy(s => s.Year).ThenBy(s => s.Month)
                .ToListAsync(cancellationToken);
            var attendance = new List<AttendanceTodoDto>();
            foreach (var s in toSign)
            {
                var first = new DateOnly(s.Year, s.Month, 1);
                var next = first.AddMonths(1);
                var validatedDays = sheets.Where(t => t.Status == TimesheetStatus.VALIDATED).SelectMany(t => t.Days).Count(d => d.Date >= first && d.Date < next);
                attendance.Add(new AttendanceTodoDto(s.Year, s.Month, s.GeneratedAt, validatedDays));
            }

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
                recent,
                attendance);
        }
    }
}
