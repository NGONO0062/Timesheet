namespace TimeSheet.Api.Domain.Tasks.Features;

using MediatR;
using Microsoft.EntityFrameworkCore;
using TimeSheet.Api.Databases;
using TimeSheet.Api.Domain.Access;
using TimeSheet.Api.Domain.Projects;
using TimeSheet.Api.Domain.Projects.Features;
using TimeSheet.Api.Exceptions;
using TimeSheet.Api.Services.Access;

public sealed record BoardProjectDto(Guid Id, string Code, string Name, string Status, bool Archived);

public sealed record BoardTaskDto(Guid Id, string Title, string Status, int Position, string CreatedBy);

/// <summary>Tableau d'un projet : le projet, s'il est modifiable (ou pourquoi il ne l'est pas), ses cartes.</summary>
public sealed record BoardDto(BoardProjectDto Project, bool Editable, string? ReadOnlyReason, IReadOnlyList<BoardTaskDto> Tasks);

public sealed record TaskSaved(Guid Id, string Title);

/// <summary>Déplacement : la place d'origine, pour « Annuler ».</summary>
public sealed record TaskMoved(string Title, string PreviousStatus, int PreviousPosition);

/// <summary>
/// Tableau Kanban d'un projet (PROMPT.md §9.12, écran 15, repris de lib/data/tasks.ts). Il se lit
/// et s'écrit par les membres du projet (« Saisir ses temps ») et par ceux qui le gèrent (« Gérer
/// les projets », même portée que l'écran Projets). Jamais depuis une autre division.
/// </summary>
public static class Board
{
    /// <summary>Projets dont le contexte peut ouvrir le tableau ; 404 sans aucune des deux permissions.</summary>
    internal static IQueryable<Project> BoardProjects(TimeSheetDbContext db, Viewer viewer)
    {
        var scope = viewer.Scope;
        var member = viewer.Has(Permission.ENTER_TIME);
        var manager = viewer.Has(Permission.MANAGE_PROJECTS);
        if (!member && !manager) throw new NotFoundException("Ressource introuvable.");
        var managed = manager ? Projects.InScope(db, scope).Select(p => p.Id) : db.Projects.Where(_ => false).Select(p => p.Id);
        return db.Projects.Where(p => p.DivisionId == scope.DivisionId && !p.IsSystem
                                      && ((member && p.Members.Any(m => m.UserId == scope.UserId)) || managed.Contains(p.Id)));
    }

    private static async Task<Project> ProjectAsync(TimeSheetDbContext db, Viewer viewer, Guid id, CancellationToken cancellationToken) =>
        await BoardProjects(db, viewer).AsNoTracking().FirstOrDefaultAsync(p => p.Id == id, cancellationToken) ?? throw new NotFoundException("Projet introuvable.");

    private static async Task<Project> EditableAsync(TimeSheetDbContext db, Viewer viewer, Guid id, CancellationToken cancellationToken)
    {
        var project = await ProjectAsync(db, viewer, id, cancellationToken);
        if (!TaskRules.BoardEditable(project)) throw new RuleException("readOnly");
        return project;
    }

    /// <summary>Tâche de la portée, sur un tableau modifiable ; `withDeleted` pour « Annuler » une suppression.</summary>
    private static async Task<ProjectTask> TaskAsync(TimeSheetDbContext db, Viewer viewer, Guid id, bool withDeleted, CancellationToken cancellationToken)
    {
        var scope = viewer.Scope;
        var task = await db.ProjectTasks.FirstOrDefaultAsync(t => t.Id == id && t.DivisionId == scope.DivisionId && (withDeleted || t.DeletedAt == null), cancellationToken)
                   ?? throw new NotFoundException("Tâche introuvable.");
        await EditableAsync(db, viewer, task.ProjectId, cancellationToken);
        return task;
    }

    private static async Task<int> BottomAsync(TimeSheetDbContext db, Guid projectId, KanbanStatus status, Guid? except, CancellationToken cancellationToken) =>
        TaskRules.Bottom(await db.ProjectTasks.Where(t => t.ProjectId == projectId && t.Status == status && t.DeletedAt == null && t.Id != except).Select(t => t.Position).ToListAsync(cancellationToken));

    private static string Title(string? raw)
    {
        var (value, error) = TaskRules.CheckTitle(raw);
        return value ?? throw new RuleException("invalid", [error!]);
    }

    public sealed record ProjectsQuery : IRequest<IReadOnlyList<BoardProjectDto>>;

    /// <summary>Projets ouverts au tableau : en cours d'abord, puis par code ; archivés à la fin.</summary>
    public sealed class ProjectsHandler(TimeSheetDbContext db, IViewerAccessor viewers) : IRequestHandler<ProjectsQuery, IReadOnlyList<BoardProjectDto>>
    {
        public async Task<IReadOnlyList<BoardProjectDto>> Handle(ProjectsQuery request, CancellationToken cancellationToken)
        {
            var viewer = await viewers.RequireAsync(cancellationToken);
            var projects = await BoardProjects(db, viewer).AsNoTracking().OrderBy(p => p.Code).ToListAsync(cancellationToken);
            static int Rank(Project p) => p.ArchivedAt is not null ? 2 : p.Status == ProjectStatus.IN_PROGRESS ? 0 : 1;
            return projects.OrderBy(Rank).ThenBy(p => p.Code, StringComparer.Ordinal)
                .Select(p => new BoardProjectDto(p.Id, p.Code, p.Name, p.Status.ToString(), p.ArchivedAt is not null)).ToList();
        }
    }

    public sealed record BoardQuery(Guid ProjectId) : IRequest<BoardDto>;

    public sealed class BoardHandler(TimeSheetDbContext db, IViewerAccessor viewers) : IRequestHandler<BoardQuery, BoardDto>
    {
        public async Task<BoardDto> Handle(BoardQuery request, CancellationToken cancellationToken)
        {
            var viewer = await viewers.RequireAsync(cancellationToken);
            var project = await ProjectAsync(db, viewer, request.ProjectId, cancellationToken);
            var tasks = await (from t in db.ProjectTasks
                               join u in db.Users on t.CreatedById equals u.Id
                               where t.ProjectId == project.Id && t.DivisionId == project.DivisionId && t.DeletedAt == null
                               orderby t.Position, t.CreatedAt
                               select new BoardTaskDto(t.Id, t.Title, t.Status.ToString(), t.Position, u.FirstName + " " + u.LastName)).ToListAsync(cancellationToken);
            return new BoardDto(new BoardProjectDto(project.Id, project.Code, project.Name, project.Status.ToString(), project.ArchivedAt is not null),
                TaskRules.BoardEditable(project), TaskRules.ReadOnlyReason(project), tasks);
        }
    }

    public sealed record CreateCommand(Guid ProjectId, string? Title) : IRequest<TaskSaved>;

    /// <summary>Nouvelle tâche, en bas de la colonne Backlog.</summary>
    public sealed class CreateHandler(TimeSheetDbContext db, IViewerAccessor viewers, TimeProvider clock) : IRequestHandler<CreateCommand, TaskSaved>
    {
        public async Task<TaskSaved> Handle(CreateCommand request, CancellationToken cancellationToken)
        {
            var viewer = await viewers.RequireAsync(cancellationToken);
            var title = Title(request.Title);
            var project = await EditableAsync(db, viewer, request.ProjectId, cancellationToken);
            var task = ProjectTask.Create(project.DivisionId, project.Id, title, await BottomAsync(db, project.Id, KanbanStatus.BACKLOG, null, cancellationToken), viewer.UserId, clock.GetUtcNow());
            db.ProjectTasks.Add(task);
            await db.SaveChangesAsync(cancellationToken);
            return new TaskSaved(task.Id, task.Title);
        }
    }

    public sealed record MoveCommand(Guid Id, string? Status, int? Position) : IRequest<TaskMoved>;

    /// <summary>Déplacement : en bas de la colonne choisie, ou à `Position` pour « Annuler ».</summary>
    public sealed class MoveHandler(TimeSheetDbContext db, IViewerAccessor viewers) : IRequestHandler<MoveCommand, TaskMoved>
    {
        public async Task<TaskMoved> Handle(MoveCommand request, CancellationToken cancellationToken)
        {
            var viewer = await viewers.RequireAsync(cancellationToken);
            var status = TaskRules.ParseStatus(request.Status) ?? throw new RuleException("status");
            if (request.Position is < 0 or > 1_000_000) throw new RuleException("position");
            var task = await TaskAsync(db, viewer, request.Id, false, cancellationToken);
            var previous = (task.Status, task.Position);
            task.MoveTo(status, request.Position ?? await BottomAsync(db, task.ProjectId, status, task.Id, cancellationToken));
            await db.SaveChangesAsync(cancellationToken);
            return new TaskMoved(task.Title, previous.Status.ToString(), previous.Position);
        }
    }

    public sealed record RenameCommand(Guid Id, string? Title) : IRequest<TaskSaved>;

    public sealed class RenameHandler(TimeSheetDbContext db, IViewerAccessor viewers) : IRequestHandler<RenameCommand, TaskSaved>
    {
        public async Task<TaskSaved> Handle(RenameCommand request, CancellationToken cancellationToken)
        {
            var viewer = await viewers.RequireAsync(cancellationToken);
            var title = Title(request.Title);
            var task = await TaskAsync(db, viewer, request.Id, false, cancellationToken);
            task.Rename(title);
            await db.SaveChangesAsync(cancellationToken);
            return new TaskSaved(task.Id, task.Title);
        }
    }

    public sealed record DeleteCommand(Guid Id, bool Deleted) : IRequest<TaskSaved>;

    /// <summary>Suppression réversible : la tâche est marquée, « Annuler » la remet à sa place.</summary>
    public sealed class DeleteHandler(TimeSheetDbContext db, IViewerAccessor viewers, TimeProvider clock) : IRequestHandler<DeleteCommand, TaskSaved>
    {
        public async Task<TaskSaved> Handle(DeleteCommand request, CancellationToken cancellationToken)
        {
            var viewer = await viewers.RequireAsync(cancellationToken);
            var task = await TaskAsync(db, viewer, request.Id, true, cancellationToken);
            task.SetDeleted(request.Deleted, clock.GetUtcNow());
            await db.SaveChangesAsync(cancellationToken);
            return new TaskSaved(task.Id, task.Title);
        }
    }
}
