namespace TimeSheet.Api.Controllers.v1;

using Asp.Versioning;
using MediatR;
using Microsoft.AspNetCore.Mvc;
using TimeSheet.Api.Domain.Timesheets.Features;

public sealed record WeekInput(IReadOnlyList<DayInput>? Days, string? Comment);

/// <summary>Saisie hebdomadaire et tableau de bord (jalon 2). Permission « Saisir ses temps ».</summary>
[ApiController]
[Route("api/v{v:apiVersion}")]
[ApiVersion("1.0")]
public sealed class EntryController(IMediator mediator) : ControllerBase
{
    [HttpGet("tableau-de-bord")]
    public Task<DashboardDto> Dashboard(CancellationToken cancellationToken) => mediator.Send(new Dashboard.Query(), cancellationToken);

    [HttpGet("saisie/{year:int}/{week:int}")]
    public Task<WeekDto> Week(int year, int week, CancellationToken cancellationToken) => mediator.Send(new WeekEntry.Query(year, week), cancellationToken);

    /// <summary>Sauvegarde automatique du brouillon.</summary>
    [HttpPut("saisie/{year:int}/{week:int}")]
    [Consumes("application/json")]
    public Task<SaveResult> Save(int year, int week, [FromBody] WeekInput body, CancellationToken cancellationToken) =>
        mediator.Send(new WeekEntry.Command(year, week, body.Days ?? [], body.Comment, Submit: false), cancellationToken);

    /// <summary>Soumission : enregistre la saisie reçue, puis la soumet au manager.</summary>
    [HttpPost("saisie/{year:int}/{week:int}/soumission")]
    [Consumes("application/json")]
    public Task<SaveResult> Submit(int year, int week, [FromBody] WeekInput body, CancellationToken cancellationToken) =>
        mediator.Send(new WeekEntry.Command(year, week, body.Days ?? [], body.Comment, Submit: true), cancellationToken);
}
