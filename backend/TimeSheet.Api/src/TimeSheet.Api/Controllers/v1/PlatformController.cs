namespace TimeSheet.Api.Controllers.v1;

using Asp.Versioning;
using MediatR;
using Microsoft.AspNetCore.Mvc;
using TimeSheet.Api.Domain.Admin;
using TimeSheet.Api.Domain.Platform;
using TimeSheet.Api.Domain.Platform.Features;

public sealed record DivisionStatusInput(string? Status);

public sealed record RolesStepInput(Dictionary<string, string[]>? Matrix, WorkflowInput Workflow);

/// <summary>Écran 13 (jalon 7) : divisions, onboarding, journal d'audit. Admin plateforme seulement (404 sinon).</summary>
[ApiController]
[Route("api/v{v:apiVersion}/plateforme")]
[ApiVersion("1.0")]
public sealed class PlatformController(IMediator mediator) : ControllerBase
{
    [HttpGet("divisions")]
    public Task<IReadOnlyList<DivisionRowDto>> Divisions(CancellationToken cancellationToken) => mediator.Send(new Platform.ListQuery(), cancellationToken);

    [HttpGet("divisions/{id:guid}")]
    public Task<DivisionDetailDto> Division(Guid id, CancellationToken cancellationToken) => mediator.Send(new Platform.DetailQuery(id), cancellationToken);

    /// <summary>Suspension ou réactivation ; renvoie l'ancien état pour « Annuler ».</summary>
    [HttpPut("divisions/{id:guid}/etat")]
    [Consumes("application/json")]
    public Task<StatusChangedDto> Status(Guid id, [FromBody] DivisionStatusInput body, CancellationToken cancellationToken) =>
        mediator.Send(new Platform.StatusCommand(id, body.Status), cancellationToken);

    [HttpGet("onboarding/{id:guid}")]
    public Task<OnboardingDto> Onboarding(Guid id, CancellationToken cancellationToken) => mediator.Send(new Platform.OnboardingQuery(id), cancellationToken);

    /// <summary>Étape 1 : crée la division, en onboarding.</summary>
    [HttpPost("onboarding")]
    [Consumes("application/json")]
    public Task<StepSaved> Create([FromBody] IdentityInput body, CancellationToken cancellationToken) => mediator.Send(new Platform.IdentityCommand(null, body), cancellationToken);

    [HttpPut("onboarding/{id:guid}/identite")]
    [Consumes("application/json")]
    public Task<StepSaved> Identity(Guid id, [FromBody] IdentityInput body, CancellationToken cancellationToken) => mediator.Send(new Platform.IdentityCommand(id, body), cancellationToken);

    [HttpPut("onboarding/{id:guid}/administrateur")]
    [Consumes("application/json")]
    public Task<StepSaved> Admin(Guid id, [FromBody] OnboardingAdminInput body, CancellationToken cancellationToken) => mediator.Send(new Platform.AdminCommand(id, body), cancellationToken);

    [HttpPut("onboarding/{id:guid}/roles")]
    [Consumes("application/json")]
    public Task<StepSaved> Roles(Guid id, [FromBody] RolesStepInput body, CancellationToken cancellationToken) =>
        mediator.Send(new Platform.RolesCommand(id, body.Matrix, body.Workflow), cancellationToken);

    [HttpPut("onboarding/{id:guid}/regles")]
    [Consumes("application/json")]
    public Task<StepSaved> Rules(Guid id, [FromBody] RulesInput body, CancellationToken cancellationToken) => mediator.Send(new Platform.RulesCommand(id, body), cancellationToken);

    /// <summary>Étape 5 : la division devient active, l'invitation de l'administrateur part.</summary>
    [HttpPost("onboarding/{id:guid}/creation")]
    public Task<DivisionCreated> Finish(Guid id, CancellationToken cancellationToken) => mediator.Send(new Platform.FinishCommand(id), cancellationToken);

    /// <summary>Journal d'audit : division, type d'action, période (jj/mm/aaaa), acteur ou objet, page.</summary>
    [HttpGet("journal")]
    public Task<AuditPageDto> Journal([FromQuery] Guid? division, [FromQuery] string? type, [FromQuery] string? du, [FromQuery] string? au, [FromQuery] string? q,
        [FromQuery] int page = 1, CancellationToken cancellationToken = default) =>
        mediator.Send(new AuditLog.Query(new AuditParams(division, type, du, au, q, page)), cancellationToken);

    [HttpGet("journal/export")]
    public async Task<IActionResult> Export([FromQuery] Guid? division, [FromQuery] string? type, [FromQuery] string? du, [FromQuery] string? au, [FromQuery] string? q,
        [FromQuery] string? format, CancellationToken cancellationToken)
    {
        var file = await mediator.Send(new AuditLog.ExportQuery(new AuditParams(division, type, du, au, q, 1), format ?? ""), cancellationToken);
        Response.Headers.CacheControl = "no-store";
        return File(file.Content, file.ContentType, file.FileName);
    }
}
