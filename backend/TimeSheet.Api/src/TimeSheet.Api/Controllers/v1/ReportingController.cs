namespace TimeSheet.Api.Controllers.v1;

using Asp.Versioning;
using MediatR;
using Microsoft.AspNetCore.Mvc;
using TimeSheet.Api.Domain.Reporting.Features;

/// <summary>Écran 10 (jalon 4) et ses exports. Permission « Consulter le reporting ».</summary>
[ApiController]
[Route("api/v{v:apiVersion}/reporting")]
[ApiVersion("1.0")]
public sealed class ReportingController(IMediator mediator) : ControllerBase
{
    /// <summary>Axe (project, person, activity), semaines de début et de fin (« 2026-10 »), personne.</summary>
    [HttpGet]
    public Task<ReportDto> Report([FromQuery] string? axe, [FromQuery] string? de, [FromQuery] string? a, [FromQuery] Guid? personne, CancellationToken cancellationToken) =>
        mediator.Send(new Report.Query(new Report.Filters(axe, de, a, personne)), cancellationToken);

    /// <summary>Export CSV, Excel (xlsx) ou PDF, avec les mêmes filtres.</summary>
    [HttpGet("export")]
    public async Task<IActionResult> Export([FromQuery] string? format, [FromQuery] string? axe, [FromQuery] string? de, [FromQuery] string? a, [FromQuery] Guid? personne, CancellationToken cancellationToken)
    {
        var file = await mediator.Send(new Report.ExportQuery(new Report.Filters(axe, de, a, personne), format ?? ""), cancellationToken);
        Response.Headers.CacheControl = "no-store";
        return File(file.Content, file.ContentType, file.FileName);
    }
}
