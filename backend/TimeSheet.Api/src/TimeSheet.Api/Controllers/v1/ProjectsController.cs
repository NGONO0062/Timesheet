namespace TimeSheet.Api.Controllers.v1;

using Asp.Versioning;
using MediatR;
using Microsoft.AspNetCore.Mvc;
using TimeSheet.Api.Domain.Projects;
using TimeSheet.Api.Domain.Projects.Features;

public sealed record StatusInput(string? Status);

public sealed record ArchiveInput(bool Archived);

/// <summary>Écran 09 (jalon 4). Permission « Gérer les projets ».</summary>
[ApiController]
[Route("api/v{v:apiVersion}/projets")]
[ApiVersion("1.0")]
public sealed class ProjectsController(IMediator mediator) : ControllerBase
{
    [HttpGet]
    public Task<ProjectsDto> List(CancellationToken cancellationToken) => mediator.Send(new Projects.ListQuery(), cancellationToken);

    [HttpPost]
    [Consumes("application/json")]
    public Task<ProjectSaved> Create([FromBody] ProjectInput body, CancellationToken cancellationToken) => mediator.Send(new Projects.SaveCommand(null, body), cancellationToken);

    [HttpPut("{id:guid}")]
    [Consumes("application/json")]
    public Task<ProjectSaved> Update(Guid id, [FromBody] ProjectInput body, CancellationToken cancellationToken) => mediator.Send(new Projects.SaveCommand(id, body), cancellationToken);

    [HttpPut("{id:guid}/statut")]
    [Consumes("application/json")]
    public Task<StatusChanged> Status(Guid id, [FromBody] StatusInput body, CancellationToken cancellationToken) => mediator.Send(new Projects.StatusCommand(id, ProjectRules.ParseStatus(body.Status) ?? throw new Exceptions.RuleException("status")), cancellationToken);

    [HttpPut("{id:guid}/archive")]
    [Consumes("application/json")]
    public Task<ProjectSaved> Archive(Guid id, [FromBody] ArchiveInput body, CancellationToken cancellationToken) => mediator.Send(new Projects.ArchiveCommand(id, body.Archived), cancellationToken);
}
