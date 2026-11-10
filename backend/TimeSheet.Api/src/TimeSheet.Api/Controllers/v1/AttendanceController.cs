namespace TimeSheet.Api.Controllers.v1;

using Asp.Versioning;
using MediatR;
using Microsoft.AspNetCore.Mvc;
using TimeSheet.Api.Domain.Attendance.Features;

public sealed record RejectInput(string? Reason);

/// <summary>
/// Fiche de présence (jalon 5, écran 06) : côté stagiaire (« Saisir ses temps », ses propres
/// fiches) et côté superviseur (« Valider les fiches de son équipe », les fiches de ses stagiaires).
/// </summary>
[ApiController]
[Route("api/v{v:apiVersion}/fiches-presence")]
[ApiVersion("1.0")]
public sealed class AttendanceController(IMediator mediator) : ControllerBase
{
    private SignerContext Context() => new(HttpContext.Connection.RemoteIpAddress?.ToString(), Request.Headers.UserAgent.ToString());

    [HttpGet]
    public Task<IReadOnlyList<MonthDto>> Months(CancellationToken cancellationToken) => mediator.Send(new AttendanceFeatures.MyMonthsQuery(), cancellationToken);

    [HttpGet("{year:int}/{month:int}")]
    public Task<AttendanceDto> Mine(int year, int month, CancellationToken cancellationToken) => mediator.Send(new AttendanceFeatures.MySheetQuery(year, month), cancellationToken);

    [HttpPost("{id:guid}/signature")]
    [Consumes("application/json")]
    public Task<SignResult> Sign(Guid id, [FromBody] SignInput body, CancellationToken cancellationToken) =>
        mediator.Send(new AttendanceFeatures.SignCommand(id, body, Context(), Supervisor: false), cancellationToken);

    /// <summary>PDF : le stagiaire ou son superviseur ; le PDF signé stocké s'il existe.</summary>
    [HttpGet("{id:guid}/pdf")]
    public async Task<IActionResult> Pdf(Guid id, CancellationToken cancellationToken)
    {
        var file = await mediator.Send(new AttendanceFeatures.PdfQuery(id), cancellationToken);
        Response.Headers.CacheControl = "no-store";
        return File(file.Content, file.ContentType, file.FileName);
    }

    [HttpGet("a-signer")]
    public Task<SupervisedListDto> ToSign(CancellationToken cancellationToken) => mediator.Send(new AttendanceFeatures.SupervisedListQuery(), cancellationToken);

    [HttpGet("a-signer/{id:guid}")]
    public Task<AttendanceDto> Supervised(Guid id, CancellationToken cancellationToken) => mediator.Send(new AttendanceFeatures.SupervisedSheetQuery(id), cancellationToken);

    [HttpPost("a-signer/{id:guid}/signature")]
    [Consumes("application/json")]
    public Task<SignResult> Countersign(Guid id, [FromBody] SignInput body, CancellationToken cancellationToken) =>
        mediator.Send(new AttendanceFeatures.SignCommand(id, body, Context(), Supervisor: true), cancellationToken);

    [HttpPost("a-signer/{id:guid}/renvoi")]
    [Consumes("application/json")]
    public async Task<object> Reject(Guid id, [FromBody] RejectInput body, CancellationToken cancellationToken) =>
        new { name = await mediator.Send(new AttendanceFeatures.RejectCommand(id, body.Reason), cancellationToken) };

    [HttpPost("a-signer/{id:guid}/envoi")]
    public async Task<object> Send(Guid id, CancellationToken cancellationToken) =>
        new { to = await mediator.Send(new AttendanceFeatures.SendCommand(id), cancellationToken) };
}
