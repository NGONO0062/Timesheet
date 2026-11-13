namespace TimeSheet.Api.Domain.Projects.Features;

using MediatR;
using Microsoft.EntityFrameworkCore;
using TimeSheet.Api.Databases;
using TimeSheet.Api.Domain.Access;
using TimeSheet.Api.Domain.Timesheets;
using TimeSheet.Api.Exceptions;
using TimeSheet.Api.Services.Access;
using TimeSheet.Api.Services.Audit;

public sealed record TeamMemberDto(Guid Id, string Name);

/// <summary>Projet de l'écran 09 : jours consommés (fiches soumises ou validées) et membres.</summary>
public sealed record ProjectDto(
    Guid Id,
    string Code,
    string Name,
    string Status,
    DateOnly Start,
    DateOnly? End,
    int? Budget,
    int Consumed,
    bool Archived,
    bool EndDatePassed,
    IReadOnlyList<Guid> MemberIds,
    IReadOnlyList<string> Activities,
    string? Manager);

public sealed record ProjectsDto(IReadOnlyList<ProjectDto> Projects, IReadOnlyList<TeamMemberDto> Team);

public sealed record ProjectSaved(Guid Id, string Name, string Code);

public sealed record StatusChanged(string Name, string Previous);

/// <summary>
/// Projets (PROMPT.md §9.4, repris de lib/data/projects.ts). Portée : un manager voit les projets
/// dont il est responsable ou qui comptent un de ses rattachés ; owner et admin de division
/// voient toute la division. Un projet hors de la portée n'existe pas (404).
/// </summary>
public static class Projects
{
    private static bool WholeDivision(DivisionScope scope) => scope.Role is Role.OWNER or Role.DIVISION_ADMIN;

    internal static IQueryable<Project> InScope(TimeSheetDbContext db, DivisionScope scope)
    {
        var projects = db.Projects.Where(p => p.DivisionId == scope.DivisionId && !p.IsSystem);
        if (WholeDivision(scope)) return projects;
        var team = db.Users.Where(u => u.DivisionId == scope.DivisionId && u.ManagerId == scope.UserId).Select(u => u.Id);
        return projects.Where(p => p.ManagerId == scope.UserId || p.Members.Any(m => team.Contains(m.UserId)));
    }

    /// <summary>Personnes qu'on peut affecter : l'équipe du manager, ou toute la division pour owner et admin.</summary>
    private static Task<List<TeamMemberDto>> AssignableAsync(TimeSheetDbContext db, DivisionScope scope, CancellationToken cancellationToken)
    {
        var users = db.Users.AsNoTracking().Where(u => u.DivisionId == scope.DivisionId && u.Active && (u.Role == Role.STAFF || u.Role == Role.MANAGER));
        if (!WholeDivision(scope)) users = users.Where(u => u.ManagerId == scope.UserId);
        return users.OrderBy(u => u.FirstName).ThenBy(u => u.LastName).Select(u => new TeamMemberDto(u.Id, u.FirstName + " " + u.LastName)).ToListAsync(cancellationToken);
    }

    private static async Task<Project> FindAsync(TimeSheetDbContext db, DivisionScope scope, Guid id, CancellationToken cancellationToken) =>
        await InScope(db, scope).Include(p => p.Activities).Include(p => p.Members).FirstOrDefaultAsync(p => p.Id == id, cancellationToken)
        ?? throw new NotFoundException("Projet introuvable.");

    private static string Label(Project p) => $"{p.Code} · {p.Name}";

    // ------------------------------------------------------------------------------------

    public sealed record ListQuery : IRequest<ProjectsDto>;

    public sealed class ListHandler(TimeSheetDbContext db, IViewerAccessor viewers, TimeProvider clock) : IRequestHandler<ListQuery, ProjectsDto>
    {
        public async Task<ProjectsDto> Handle(ListQuery request, CancellationToken cancellationToken)
        {
            var scope = (await viewers.RequireAsync(cancellationToken)).Require(Permission.MANAGE_PROJECTS).Scope;
            var projects = await InScope(db, scope).AsNoTracking().Include(p => p.Activities).Include(p => p.Members).ToListAsync(cancellationToken);
            var ids = projects.Select(p => p.Id).ToList();

            // Jours consommés : journées des fiches soumises ou validées.
            var consumed = await (from d in db.TimesheetDays
                                  join t in db.Timesheets on d.TimesheetId equals t.Id
                                  join a in db.Activities on d.ActivityId equals a.Id
                                  where t.DivisionId == scope.DivisionId && ids.Contains(a.ProjectId)
                                        && (t.Status == TimesheetStatus.SUBMITTED || t.Status == TimesheetStatus.VALIDATED)
                                  group d by a.ProjectId into g
                                  select new { ProjectId = g.Key, Days = g.Count() }).ToDictionaryAsync(x => x.ProjectId, x => x.Days, cancellationToken);

            var managerIds = projects.Where(p => p.ManagerId != null).Select(p => p.ManagerId!.Value).Distinct().ToList();
            var managers = await db.Users.AsNoTracking().Where(u => managerIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u.FirstName + " " + u.LastName, cancellationToken);
            var today = WeekRules.DoualaDay(clock.GetUtcNow());

            var dto = projects.Select(p => new ProjectDto(
                p.Id, p.Code, p.Name, p.Status.ToString(), p.StartDate, p.EndDate, p.BudgetDays, consumed.GetValueOrDefault(p.Id), p.ArchivedAt != null, p.EndDatePassed(today),
                p.Members.Select(m => m.UserId).ToList(), p.Activities.Select(a => a.Name).Order(StringComparer.Create(new System.Globalization.CultureInfo("fr-FR"), false)).ToList(),
                p.ManagerId is { } m ? managers.GetValueOrDefault(m) : null)).ToList();
            return new ProjectsDto(dto, await AssignableAsync(db, scope, cancellationToken));
        }
    }

    // ------------------------------------------------------------------------------------

    /// <summary>Création (<c>Id</c> null) ou modification depuis le panneau.</summary>
    public sealed record SaveCommand(Guid? Id, ProjectInput Input) : IRequest<ProjectSaved>;

    public sealed class SaveHandler(TimeSheetDbContext db, IViewerAccessor viewers, IAuditWriter audit, TimeProvider clock) : IRequestHandler<SaveCommand, ProjectSaved>
    {
        public async Task<ProjectSaved> Handle(SaveCommand request, CancellationToken cancellationToken)
        {
            var viewer = (await viewers.RequireAsync(cancellationToken)).Require(Permission.MANAGE_PROJECTS);
            var scope = viewer.Scope;
            var (value, errors) = ProjectRules.Check(request.Input);
            if (value is null) throw new RuleException("invalid", errors);
            var team = (await AssignableAsync(db, scope, cancellationToken)).Select(u => u.Id).ToHashSet();
            if (value.MemberIds.Any(m => !team.Contains(m))) throw new RuleException("members");
            var now = clock.GetUtcNow();

            if (request.Id is null)
            {
                var division = await db.Divisions.AsNoTracking().FirstAsync(d => d.Id == scope.DivisionId, cancellationToken);
                var prefix = ProjectRules.Prefix(division.Department, division.Slug);
                var head = $"{prefix}-{value.Start.Year}-";
                var codes = await db.Projects.Where(p => p.DivisionId == scope.DivisionId && p.Code.StartsWith(head)).Select(p => p.Code).ToListAsync(cancellationToken);
                var project = Project.Create(scope.DivisionId, ProjectRules.NextCode(prefix, value.Start.Year, codes), value.Name, value.Start, value.End, value.Budget, value.Status, now, scope.UserId);
                foreach (var name in value.Activities) project.AddActivity(name);
                foreach (var member in value.MemberIds) project.AddMember(member);
                db.Projects.Add(project);
                await db.SaveChangesAsync(cancellationToken);
                await audit.AppendAsync("PROJECT_CREATED", viewer.FullName, Label(project), AuditResult.SUCCESS, viewer.UserId, scope.DivisionId, new { status = value.Status.ToString() }, cancellationToken);
                return new ProjectSaved(project.Id, project.Name, project.Code);
            }

            var existing = await FindAsync(db, scope, request.Id.Value, cancellationToken);
            // Une activité qui porte déjà des jours ne peut pas être retirée.
            var removed = existing.Activities.Where(a => !value.Activities.Contains(a.Name)).ToList();
            var removedIds = removed.Select(a => a.Id).ToList();
            var used = await db.TimesheetDays.Where(d => removedIds.Contains(d.ActivityId)).Select(d => d.ActivityId).FirstOrDefaultAsync(cancellationToken);
            if (used != Guid.Empty) throw new RuleException("activityInUse", detail: removed.First(a => a.Id == used).Name);
            foreach (var a in removed) existing.RemoveActivity(a.Id);
            foreach (var name in value.Activities.Where(n => existing.Activities.All(a => a.Name != n))) existing.AddActivity(name);

            // Membres : seuls ceux que le contexte peut affecter sont modifiés.
            foreach (var userId in team.Where(u => !value.MemberIds.Contains(u))) existing.RemoveMember(userId);
            foreach (var userId in value.MemberIds) existing.AddMember(userId);

            existing.Update(value.Name, value.Start, value.End, value.Budget);
            var previous = existing.Status;
            var statusChanged = existing.ChangeStatus(value.Status, scope.UserId, now);
            await db.SaveChangesAsync(cancellationToken);
            await audit.AppendAsync(statusChanged ? "PROJECT_STATUS_CHANGED" : "PROJECT_UPDATED", viewer.FullName, Label(existing), AuditResult.SUCCESS, viewer.UserId, scope.DivisionId,
                statusChanged ? new { from = previous.ToString(), to = value.Status.ToString() } : null, cancellationToken);
            return new ProjectSaved(existing.Id, existing.Name, existing.Code);
        }
    }

    // ------------------------------------------------------------------------------------

    /// <summary>Changement de statut immédiat ; renvoie l'ancien statut pour « Annuler ».</summary>
    public sealed record StatusCommand(Guid Id, ProjectStatus Status) : IRequest<StatusChanged>;

    public sealed class StatusHandler(TimeSheetDbContext db, IViewerAccessor viewers, IAuditWriter audit, TimeProvider clock) : IRequestHandler<StatusCommand, StatusChanged>
    {
        public async Task<StatusChanged> Handle(StatusCommand request, CancellationToken cancellationToken)
        {
            var viewer = (await viewers.RequireAsync(cancellationToken)).Require(Permission.MANAGE_PROJECTS);
            var project = await FindAsync(db, viewer.Scope, request.Id, cancellationToken);
            var previous = project.Status;
            if (project.ChangeStatus(request.Status, viewer.UserId, clock.GetUtcNow()))
            {
                await db.SaveChangesAsync(cancellationToken);
                await audit.AppendAsync("PROJECT_STATUS_CHANGED", viewer.FullName, Label(project), AuditResult.SUCCESS, viewer.UserId, viewer.Scope.DivisionId,
                    new { from = previous.ToString(), to = request.Status.ToString() }, cancellationToken);
            }
            return new StatusChanged(project.Name, previous.ToString());
        }
    }

    // ------------------------------------------------------------------------------------

    /// <summary>Archivage depuis le panneau de modification ; réversible.</summary>
    public sealed record ArchiveCommand(Guid Id, bool Archived) : IRequest<ProjectSaved>;

    public sealed class ArchiveHandler(TimeSheetDbContext db, IViewerAccessor viewers, IAuditWriter audit, TimeProvider clock) : IRequestHandler<ArchiveCommand, ProjectSaved>
    {
        public async Task<ProjectSaved> Handle(ArchiveCommand request, CancellationToken cancellationToken)
        {
            var viewer = (await viewers.RequireAsync(cancellationToken)).Require(Permission.MANAGE_PROJECTS);
            var project = await FindAsync(db, viewer.Scope, request.Id, cancellationToken);
            project.SetArchived(request.Archived, clock.GetUtcNow());
            await db.SaveChangesAsync(cancellationToken);
            await audit.AppendAsync(request.Archived ? "PROJECT_ARCHIVED" : "PROJECT_UNARCHIVED", viewer.FullName, Label(project), AuditResult.SUCCESS, viewer.UserId, viewer.Scope.DivisionId, cancellationToken: cancellationToken);
            return new ProjectSaved(project.Id, project.Name, project.Code);
        }
    }
}
