namespace TimeSheet.Api.Controllers.v1;

using Asp.Versioning;
using MediatR;
using Microsoft.AspNetCore.Mvc;
using TimeSheet.Api.Domain.Divisions;
using TimeSheet.Api.Domain.Divisions.Features;

/// <summary>
/// Écran 11 (jalon 4) : vue consolidée, trois blocs chargés séparément, et relances par e-mail.
/// Permission « Voir la vue consolidée de la division ».
/// </summary>
[ApiController]
[Route("api/v{v:apiVersion}/division")]
[ApiVersion("1.0")]
public sealed class DivisionController(IMediator mediator) : ControllerBase
{
    [HttpGet]
    public Task<DivisionHeadDto> Head([FromQuery] int? annee, [FromQuery] int? semaine, CancellationToken cancellationToken) =>
        mediator.Send(new Consolidated.HeadQuery(annee, semaine), cancellationToken);

    [HttpGet("semaine")]
    public Task<WeekBlockDto> Week([FromQuery] int? annee, [FromQuery] int? semaine, CancellationToken cancellationToken) =>
        mediator.Send(new Consolidated.WeekQuery(annee, semaine), cancellationToken);

    [HttpGet("derives")]
    public Task<IReadOnlyList<Drift>> Drifts([FromQuery] int? annee, [FromQuery] int? semaine, CancellationToken cancellationToken) =>
        mediator.Send(new Consolidated.DriftsQuery(annee, semaine), cancellationToken);

    [HttpPost("relances/manager/{managerId:guid}")]
    public Task<Reminded> RemindManager(Guid managerId, CancellationToken cancellationToken) =>
        mediator.Send(new Consolidated.RemindManagerCommand(managerId), cancellationToken);

    [HttpPost("relances/personne/{personId:guid}/{annee:int}/{semaine:int}")]
    public Task<Reminded> RemindPerson(Guid personId, int annee, int semaine, CancellationToken cancellationToken) =>
        mediator.Send(new Consolidated.RemindPersonCommand(personId, annee, semaine), cancellationToken);
}
