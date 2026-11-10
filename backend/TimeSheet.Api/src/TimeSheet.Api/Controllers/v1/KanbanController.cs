namespace TimeSheet.Api.Controllers.v1;

using Asp.Versioning;
using MediatR;
using Microsoft.AspNetCore.Mvc;
using TimeSheet.Api.Domain.Tasks.Features;

public sealed record TaskTitleInput(string? Title);

public sealed record TaskMoveInput(string? Status, int? Position);

public sealed record TaskDeleteInput(bool Deleted);

/// <summary>
/// Écran 15 (jalon 8) : tableau Kanban d'un projet. Ouvert aux membres du projet et à ceux qui
/// le gèrent. (« taches » est pris par les tâches planifiées : d'où « kanban ».)
/// </summary>
[ApiController]
[Route("api/v{v:apiVersion}/kanban")]
[ApiVersion("1.0")]
public sealed class KanbanController(IMediator mediator) : ControllerBase
{
    [HttpGet("projets")]
    public Task<IReadOnlyList<BoardProjectDto>> Projects(CancellationToken cancellationToken) => mediator.Send(new Board.ProjectsQuery(), cancellationToken);

    [HttpGet("projets/{id:guid}")]
    public Task<BoardDto> Board(Guid id, CancellationToken cancellationToken) => mediator.Send(new Board.BoardQuery(id), cancellationToken);

    [HttpPost("projets/{id:guid}/taches")]
    [Consumes("application/json")]
    public Task<TaskSaved> Create(Guid id, [FromBody] TaskTitleInput body, CancellationToken cancellationToken) => mediator.Send(new Board.CreateCommand(id, body.Title), cancellationToken);

    /// <summary>Déplacement ; renvoie la place d'origine pour « Annuler ».</summary>
    [HttpPut("taches/{id:guid}/colonne")]
    [Consumes("application/json")]
    public Task<TaskMoved> Move(Guid id, [FromBody] TaskMoveInput body, CancellationToken cancellationToken) => mediator.Send(new Board.MoveCommand(id, body.Status, body.Position), cancellationToken);

    [HttpPut("taches/{id:guid}/titre")]
    [Consumes("application/json")]
    public Task<TaskSaved> Rename(Guid id, [FromBody] TaskTitleInput body, CancellationToken cancellationToken) => mediator.Send(new Board.RenameCommand(id, body.Title), cancellationToken);

    /// <summary>Suppression (réversible) ou retour d'une tâche supprimée (« Annuler »).</summary>
    [HttpPut("taches/{id:guid}/suppression")]
    [Consumes("application/json")]
    public Task<TaskSaved> Delete(Guid id, [FromBody] TaskDeleteInput body, CancellationToken cancellationToken) => mediator.Send(new Board.DeleteCommand(id, body.Deleted), cancellationToken);
}
