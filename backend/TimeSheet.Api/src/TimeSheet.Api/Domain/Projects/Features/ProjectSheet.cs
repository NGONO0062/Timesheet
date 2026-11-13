namespace TimeSheet.Api.Domain.Projects.Features;

using MediatR;
using Microsoft.EntityFrameworkCore;
using TimeSheet.Api.Databases;
using TimeSheet.Api.Domain.Access;
using TimeSheet.Api.Domain.Tasks;
using TimeSheet.Api.Domain.Timesheets;
using TimeSheet.Api.Exceptions;
using TimeSheet.Api.Services.Access;

/// <summary>Jours d'une personne sur le projet. <c>Name</c> null : personnes d'autres équipes, regroupées.</summary>
public sealed record SheetPersonDto(Guid? Id, string? Name, int Days, bool Member);

public sealed record SheetActivityDto(string Name, int Days);

public sealed record SheetWeekDto(int Year, int Week, DateOnly Monday, int Days);

/// <summary>Tâches du tableau Kanban, par colonne.</summary>
public sealed record SheetTasksDto(int Backlog, int Todo, int InProgress, int Review, int Done, int Total);

/// <summary>
/// Fiche d'un projet : budget, délai, points d'attention, équipe, activités, tendance, tâches.
/// <c>Consumed</c> : journées des fiches soumises ou validées (comme l'écran Projets) ;
/// <c>Pending</c> : celles qui attendent encore la validation.
/// </summary>
public sealed record ProjectSheetDto(
    Guid Id,
    string Code,
    string Name,
    string Status,
    DateOnly Start,
    DateOnly? End,
    bool Archived,
    string? Manager,
    int? Budget,
    int Consumed,
    int Pending,
    int? BudgetPercent,
    int? ElapsedPercent,
    DateOnly? LastDay,
    IReadOnlyList<string> Attention,
    SheetTasksDto Tasks,
    IReadOnlyList<SheetPersonDto> People,
    IReadOnlyList<SheetActivityDto> Activities,
    IReadOnlyList<SheetWeekDto> Weeks);

/// <summary>
/// Fiche projet (suivi de projet, après la bascule). Même portée que l'écran Projets : permission
/// « Gérer les projets », projet de la portée du manager ou toute la division pour owner et admin.
/// Un manager qui n'est pas le responsable du projet ne voit par leur nom que ses rattachés ;
/// les journées des autres équipes sont regroupées.
/// </summary>
public static class ProjectSheet
{
    public sealed record Query(Guid Id) : IRequest<ProjectSheetDto>;

    public sealed class Handler(TimeSheetDbContext db, IViewerAccessor viewers, TimeProvider clock) : IRequestHandler<Query, ProjectSheetDto>
    {
        public async Task<ProjectSheetDto> Handle(Query request, CancellationToken cancellationToken)
        {
            var scope = (await viewers.RequireAsync(cancellationToken)).Require(Permission.MANAGE_PROJECTS).Scope;
            var project = await Projects.InScope(db, scope).AsNoTracking().Include(p => p.Activities).Include(p => p.Members)
                              .FirstOrDefaultAsync(p => p.Id == request.Id, cancellationToken)
                          ?? throw new NotFoundException("Projet introuvable.");

            // Journées consommées : celles des fiches soumises ou validées, dans la division.
            var activityIds = project.Activities.Select(a => a.Id).ToList();
            var days = await (from d in db.TimesheetDays
                              join t in db.Timesheets on d.TimesheetId equals t.Id
                              where t.DivisionId == scope.DivisionId && activityIds.Contains(d.ActivityId)
                                    && (t.Status == TimesheetStatus.SUBMITTED || t.Status == TimesheetStatus.VALIDATED)
                              select new { d.Date, d.ActivityId, t.UserId, t.Status }).ToListAsync(cancellationToken);

            var today = WeekRules.DoualaDay(clock.GetUtcNow());
            var consumed = days.Count;
            DateOnly? lastDay = days.Count > 0 ? days.Max(d => d.Date) : null;

            // Personnes : les membres (même sans journée) et ceux qui ont des journées sans être membres.
            var memberIds = project.Members.Select(m => m.UserId).ToHashSet();
            var byUser = days.GroupBy(d => d.UserId).ToDictionary(g => g.Key, g => g.Count());
            var userIds = memberIds.Union(byUser.Keys).ToList();
            var users = await db.Users.AsNoTracking().Where(u => userIds.Contains(u.Id) && u.DivisionId == scope.DivisionId)
                .Select(u => new { u.Id, Name = u.FirstName + " " + u.LastName, u.ManagerId }).ToListAsync(cancellationToken);
            var seesEveryone = scope.Role is Role.OWNER or Role.DIVISION_ADMIN || project.ManagerId == scope.UserId;
            var named = users.Where(u => seesEveryone || u.ManagerId == scope.UserId || u.Id == scope.UserId).ToList();
            var people = named
                .Select(u => new SheetPersonDto(u.Id, u.Name, byUser.GetValueOrDefault(u.Id), memberIds.Contains(u.Id)))
                .OrderByDescending(p => p.Days).ThenBy(p => p.Name, StringComparer.Create(new System.Globalization.CultureInfo("fr-FR"), false))
                .ToList();
            var others = consumed - people.Sum(p => p.Days);
            if (others > 0) people.Add(new SheetPersonDto(null, null, others, false));

            var byActivity = days.GroupBy(d => d.ActivityId).ToDictionary(g => g.Key, g => g.Count());
            var activities = project.Activities
                .Select(a => new SheetActivityDto(a.Name, byActivity.GetValueOrDefault(a.Id)))
                .OrderByDescending(a => a.Days).ThenBy(a => a.Name, StringComparer.Create(new System.Globalization.CultureInfo("fr-FR"), false))
                .ToList();

            // Tendance : les dernières semaines, de la plus ancienne à la semaine en cours.
            var current = IsoWeek.Of(today);
            var byWeek = days.GroupBy(d => IsoWeek.Of(d.Date)).ToDictionary(g => g.Key, g => g.Count());
            var weeks = Enumerable.Range(0, ProjectSheetRules.TrendWeeks)
                .Select(i => current.Shift(i - ProjectSheetRules.TrendWeeks + 1))
                .Select(w => new SheetWeekDto(w.Year, w.Week, w.Monday, byWeek.GetValueOrDefault(w)))
                .ToList();

            var taskCounts = await db.ProjectTasks.AsNoTracking()
                .Where(t => t.ProjectId == project.Id && t.DivisionId == scope.DivisionId && t.DeletedAt == null)
                .GroupBy(t => t.Status).Select(g => new { Status = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.Status, x => x.Count, cancellationToken);
            int Tasks(KanbanStatus s) => taskCounts.GetValueOrDefault(s);
            var tasks = new SheetTasksDto(Tasks(KanbanStatus.BACKLOG), Tasks(KanbanStatus.TODO), Tasks(KanbanStatus.IN_PROGRESS), Tasks(KanbanStatus.REVIEW), Tasks(KanbanStatus.DONE), taskCounts.Values.Sum());

            var manager = project.ManagerId is { } managerId
                ? await db.Users.AsNoTracking().Where(u => u.Id == managerId).Select(u => u.FirstName + " " + u.LastName).FirstOrDefaultAsync(cancellationToken)
                : null;

            return new ProjectSheetDto(
                project.Id, project.Code, project.Name, project.Status.ToString(), project.StartDate, project.EndDate, project.ArchivedAt != null, manager,
                project.BudgetDays, consumed, days.Count(d => d.Status == TimesheetStatus.SUBMITTED),
                ProjectSheetRules.BudgetPercent(consumed, project.BudgetDays),
                ProjectSheetRules.ElapsedPercent(project.StartDate, project.EndDate, today),
                lastDay,
                ProjectSheetRules.Attention(project.Status, consumed, project.BudgetDays, project.StartDate, project.EndDate, today, lastDay),
                tasks, people, activities, weeks);
        }
    }
}
